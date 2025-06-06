/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CloudWatchLogsClient, GetLogEventsCommand, DescribeLogStreamsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ECSClient, DescribeTasksCommand } from '@aws-sdk/client-ecs';
import { NextRequest } from 'next/server';
import { scanSessions } from '@/lib/scanSessions';

const ecsClient = new ECSClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 5,
  retryMode: 'adaptive',
});

const logsClient = new CloudWatchLogsClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 5,
  retryMode: 'adaptive',
});

// Updated constants for better connection management
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - less frequent to reduce noise
const MAX_RECONNECT_ATTEMPTS = 10; // Reduced since we're improving reliability
const RECONNECT_DELAY = 2000; // 2 seconds base delay
const CONNECTION_TIMEOUT = 1800000; // 30 minutes timeout (increased significantly)
const MAX_RETRY_DELAY = 30000; // 30 seconds max delay
const KEEP_ALIVE_INTERVAL = 60000; // 1 minute keep-alive interval
const MAX_INACTIVITY_TIME = 900000; // 15 minutes max inactivity (increased significantly)
const POLLING_INTERVAL = 5000; // 5 seconds polling interval (slightly increased)
const HEALTH_CHECK_INTERVAL = 120000; // 2 minutes health check interval (much less frequent)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('scanId');

  if (!scanId) {
    return new Response(
      `data: ${JSON.stringify({ error: 'Scan ID is required' })}\n\n`,
      {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
          'X-Accel-Buffering': 'no',
        },
      }
    );
  }

  const scanSession = scanSessions.get(scanId);
  if (!scanSession) {
    return new Response(
      `data: ${JSON.stringify({ 
        error: 'Scan session not found',
        scanId: scanId,
        availableSessions: Array.from(scanSessions.keys())
      })}\n\n`,
      {
        status: 404,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
          'X-Accel-Buffering': 'no',
        },
      }
    );
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      let streamingActive = true;
      let allLogsSent = false;
      let lastForwardToken: string | undefined = undefined;
      let retryCount = 0;
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let reconnectTimeout: NodeJS.Timeout | null = null;
      let keepAliveInterval: NodeJS.Timeout | null = null;
      let pollingInterval: NodeJS.Timeout | null = null;
      let healthCheckInterval: NodeJS.Timeout | null = null;
      let lastActivityTime = Date.now();
      let connectionStartTime = Date.now();
      let isPolling = false;
      let lastLogTime = Date.now(); // Track when we last received actual logs
      let hasReceivedLogs = false; // Track if we've received any logs at all

      // Function to send heartbeat (only when no recent activity)
      const sendHeartbeat = () => {
        if (!streamingActive) return;
        
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        // Only send heartbeat if no activity for a while
        if (timeSinceLastActivity > HEARTBEAT_INTERVAL / 2) {
          try {
            const heartbeatMessage = `data: ${JSON.stringify({ 
              message: 'Connection active - waiting for logs...',
              level: 'info',
              timestamp: Date.now(),
              type: 'heartbeat'
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(heartbeatMessage));
            lastActivityTime = Date.now();
          } catch (error) {
            console.error('Error sending heartbeat:', error);
          }
        }
      };

      // Function to send keep-alive message (less frequent)
      const sendKeepAlive = () => {
        if (!streamingActive) return;
        
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        // Only send if we haven't had activity recently
        if (timeSinceLastActivity > KEEP_ALIVE_INTERVAL * 0.8) {
          try {
            const keepAliveMessage = `data: ${JSON.stringify({ 
              message: 'Scan in progress - monitoring for new logs...',
              level: 'info',
              timestamp: Date.now(),
              type: 'keep-alive'
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(keepAliveMessage));
            lastActivityTime = Date.now();
          } catch (error) {
            console.error('Error sending keep-alive:', error);
          }
        }
      };

      // Start heartbeat interval
      heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      
      // Start keep-alive interval
      keepAliveInterval = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL);

      // Function to handle reconnection (more conservative)
      const handleReconnect = (reason: string = 'Unknown') => {
        if (!streamingActive) return;

        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }

        if (retryCount < MAX_RECONNECT_ATTEMPTS) {
          const baseDelay = Math.min(RECONNECT_DELAY * Math.pow(1.5, retryCount), MAX_RETRY_DELAY);
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          retryCount++;

          try {
            const reconnectMessage = `data: ${JSON.stringify({ 
              message: `Connection issue detected (${reason}). Reconnecting in ${Math.round(delay/1000)} seconds... (Attempt ${retryCount}/${MAX_RECONNECT_ATTEMPTS})`,
              level: 'warning',
              timestamp: Date.now(),
              type: 'reconnect'
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(reconnectMessage));
            lastActivityTime = Date.now();
          } catch (error) {
            console.error('Error sending reconnect message:', error);
          }

          reconnectTimeout = setTimeout(() => {
            if (streamingActive) {
              pollForNewLogs();
            }
          }, delay);
        } else {
          try {
            const errorMessage = `data: ${JSON.stringify({ 
              message: 'Connection failed after multiple attempts. Please refresh the page.',
              level: 'error',
              timestamp: Date.now(),
              type: 'error'
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorMessage));
          } catch (error) {
            console.error('Error sending error message:', error);
          }
          controller.close();
          streamingActive = false;
        }
      };

      // More conservative connection health check
      const checkConnectionHealth = () => {
        if (!streamingActive) return;

        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityTime;
        const totalConnectionTime = now - connectionStartTime;
        const timeSinceLastLog = now - lastLogTime;
        
        // Only check for inactivity if we've been connected for a while and haven't received any logs
        if (timeSinceLastActivity > MAX_INACTIVITY_TIME && !hasReceivedLogs && totalConnectionTime > 300000) {
          console.log('Long inactivity without any logs, checking connection...');
          handleReconnect('Long inactivity without logs');
          return;
        }
        
        // Check for total connection timeout (very generous)
        if (totalConnectionTime > CONNECTION_TIMEOUT) {
          console.log('Connection timeout reached, attempting to reconnect...');
          handleReconnect('Connection timeout');
          return;
        }
        
        // Only consider connection stale if no activity for a very long time
        if (timeSinceLastActivity > MAX_INACTIVITY_TIME * 1.5) {
          console.log('Connection appears to be stale, attempting to reconnect...');
          handleReconnect('Stale connection');
        }
      };

      // Start connection health check (much less frequent)
      healthCheckInterval = setInterval(checkConnectionHealth, HEALTH_CHECK_INTERVAL);

      // Function to extract log stream name from task ARN
      const getLogStreamName = (taskArn: string): string => {
        const taskId = taskArn.split('/').pop();
        return `security-scanner/security-scanner/${taskId}`;
      };

      // Function to get task status with retry
      const getTaskStatus = async (): Promise<string> => {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            const params = {
              cluster: 'security-scanner-cluster',
              tasks: [scanSession.taskArn],
            };
            
            const command = new DescribeTasksCommand(params);
            const response = await ecsClient.send(command);
            
            if (response.tasks && response.tasks.length > 0) {
              return response.tasks[0].lastStatus || 'UNKNOWN';
            }
            return 'UNKNOWN';
          } catch (error) {
            attempts++;
            if (attempts === maxAttempts) {
              console.error('Error getting task status:', error);
              return 'ERROR';
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
        return 'ERROR';
      };

      // Function to verify log stream exists with retry
      const verifyLogStream = async (logStreamName: string): Promise<boolean> => {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            const describeParams = {
              logGroupName: '/ecs/security-scanner',
              logStreamNamePrefix: logStreamName,
              limit: 1
            };
            
            const describeCommand = new DescribeLogStreamsCommand(describeParams);
            const describeResponse = await logsClient.send(describeCommand);
            
            console.log('Available log streams:', describeResponse.logStreams?.map(stream => stream.logStreamName));
            
            return !!(describeResponse.logStreams && describeResponse.logStreams.length > 0);
          } catch (error) {
            attempts++;
            if (attempts === maxAttempts) {
              console.error('Error verifying log stream:', error);
              return false;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
        return false;
      };

      // Function to get ALL logs from CloudWatch (complete history)
      const getAllLogs = async (): Promise<void> => {
        try {
          const logStreamName = getLogStreamName(scanSession.taskArn);
          
          console.log('Getting ALL logs for stream:', logStreamName);
          console.log('Task ARN:', scanSession.taskArn);

          // First, verify if the log stream exists
          const streamExists = await verifyLogStream(logStreamName);
          if (!streamExists) {
            throw new Error(`Log stream ${logStreamName} not found`);
          }

          // Get all logs from the beginning
          const params = {
            logGroupName: '/ecs/security-scanner',
            logStreamName: logStreamName,
            startFromHead: true,
          };

          console.log('Fetching ALL logs with params:', params);

          const command = new GetLogEventsCommand(params);
          const response = await logsClient.send(command);

          console.log(`Found ${response.events?.length || 0} total log events`);

          // Send all log events immediately
          if (response.events && response.events.length > 0) {
            hasReceivedLogs = true;
            lastLogTime = Date.now();
            
            for (const event of response.events) {
              if (event.message && event.message.trim()) {
                const logData = {
                  message: event.message,
                  timestamp: event.timestamp || Date.now(),
                  level: detectLogLevel(event.message),
                  type: 'log'
                };

                const logMessage = `data: ${JSON.stringify(logData)}\n\n`;
                controller.enqueue(new TextEncoder().encode(logMessage));
                lastActivityTime = Date.now();
              }
            }
            
            // Store the forward token for future polling
            lastForwardToken = response.nextForwardToken;
            allLogsSent = true;
            retryCount = 0; // Reset retry count on success
          }

        } catch (error: any) {
          console.error('Error getting all logs:', error);
          throw error;
        }
      };

      // Function to continuously try to fetch logs (more patient)
      const continuouslyFetchLogs = async (): Promise<void> => {
        let attempts = 0;
        const maxInitialAttempts = 5; // Fewer attempts for initial fetch
        
        while (attempts < maxInitialAttempts && streamingActive) {
          try {
            console.log(`Attempt ${attempts + 1} to fetch initial logs...`);
            await getAllLogs();
            
            if (allLogsSent) {
              console.log('Successfully retrieved initial logs');
              return;
            }
          } catch (error: any) {
            console.log(`Attempt ${attempts + 1} failed:`, error.message);
            attempts++;
            
            if (attempts < maxInitialAttempts) {
              // Wait longer between attempts
              await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY * attempts));
            }
          }
        }

        if (!allLogsSent) {
          const warningMessage = `data: ${JSON.stringify({ 
            message: 'Initial logs not yet available. Continuing to monitor for new logs...',
            level: 'info',
            timestamp: Date.now(),
            type: 'status'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(warningMessage));
          allLogsSent = true; // Continue with polling
          lastActivityTime = Date.now();
        }
      };

      // Function to poll for new logs (more robust)
      const pollForNewLogs = async (): Promise<void> => {
        if (!streamingActive || isPolling) return;
        
        isPolling = true;
        try {
          const logStreamName = getLogStreamName(scanSession.taskArn);
          const taskStatus = await getTaskStatus();

          // Send periodic status updates for long-running tasks
          const timeSinceLastLog = Date.now() - lastLogTime;
          if (timeSinceLastLog > 300000 && hasReceivedLogs) { // 5 minutes since last log
            const statusMessage = `data: ${JSON.stringify({ 
              message: `Scan still running (${taskStatus}). Waiting for new logs...`,
              level: 'info',
              timestamp: Date.now(),
              type: 'status'
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(statusMessage));
            lastActivityTime = Date.now();
          }

          // Poll for new logs if we have a forward token or try to get initial logs
          if (lastForwardToken || !hasReceivedLogs) {
            const params = lastForwardToken ? {
              logGroupName: '/ecs/security-scanner',
              logStreamName: logStreamName,
              nextToken: lastForwardToken,
              startFromHead: false,
            } : {
              logGroupName: '/ecs/security-scanner',
              logStreamName: logStreamName,
              startFromHead: true,
            };

            const command = new GetLogEventsCommand(params);
            const response = await logsClient.send(command);

            // Send any new log events
            if (response.events && response.events.length > 0) {
              console.log(`Found ${response.events.length} new log events`);
              hasReceivedLogs = true;
              lastLogTime = Date.now();
              
              for (const event of response.events) {
                if (event.message && event.message.trim()) {
                  const logData = {
                    message: event.message,
                    timestamp: event.timestamp || Date.now(),
                    level: detectLogLevel(event.message),
                    type: 'log'
                  };

                  const logMessage = `data: ${JSON.stringify(logData)}\n\n`;
                  controller.enqueue(new TextEncoder().encode(logMessage));
                  lastActivityTime = Date.now();
                }
              }
              
              // Update the forward token
              if (response.nextForwardToken && response.nextForwardToken !== lastForwardToken) {
                lastForwardToken = response.nextForwardToken;
              }
              
              // Reset retry count on successful log retrieval
              retryCount = 0;
            }
          }

          // Continue polling based on task status
          let nextPollDelay = POLLING_INTERVAL;
          
          if (taskStatus === 'RUNNING') {
            nextPollDelay = POLLING_INTERVAL;
          } else if (taskStatus === 'STOPPING') {
            nextPollDelay = POLLING_INTERVAL / 2; // Poll more frequently when stopping
          } else if (taskStatus === 'STOPPED') {
            // Do a few final polls and then close
            nextPollDelay = 2000;
            setTimeout(() => {
              const completeMessage = `event: complete\ndata: ${JSON.stringify({ 
                message: `Scan completed with status: ${taskStatus}`,
                summary: `Security scan completed`,
                timestamp: Date.now(),
                type: 'complete'
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(completeMessage));
              controller.close();
              streamingActive = false;
            }, 10000); // Wait 10 seconds after stopped status
          } else {
            // For any other status, keep polling but less frequently
            nextPollDelay = POLLING_INTERVAL * 2;
          }

          // Schedule next poll
          pollingInterval = setTimeout(() => {
            isPolling = false;
            pollForNewLogs();
          }, nextPollDelay);

        } catch (error: any) {
          console.error('Error polling for new logs:', error);
          isPolling = false;
          
          if (error.name === 'ResourceNotFoundException') {
            // Log stream might not exist yet, retry with longer delay
            const delay = Math.min(RECONNECT_DELAY * Math.pow(1.2, retryCount), MAX_RETRY_DELAY);
            pollingInterval = setTimeout(() => {
              pollForNewLogs();
            }, delay);
          } else if (error.name === 'AccessDeniedException' || error.name === 'InvalidParameterException') {
            // Critical errors - close connection
            try {
              const errorMessage = `data: ${JSON.stringify({ 
                message: `Critical error: ${error.message}`,
                level: 'error',
                timestamp: Date.now(),
                type: 'error'
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(errorMessage));
            } catch (err) {
              console.error('Error sending error message:', err);
            }
            controller.close();
            streamingActive = false;
          } else {
            // For other errors, log them but keep the connection alive with exponential backoff
            try {
              const errorMessage = `data: ${JSON.stringify({ 
                message: `Temporary error polling logs: ${error.message}. Retrying...`,
                level: 'warning',
                timestamp: Date.now(),
                type: 'warning'
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(errorMessage));
              lastActivityTime = Date.now();
            } catch (err) {
              console.error('Error sending error message:', err);
            }
            
            // Exponential backoff for retries
            const delay = Math.min(RECONNECT_DELAY * Math.pow(1.5, retryCount), MAX_RETRY_DELAY);
            retryCount++;
            pollingInterval = setTimeout(() => {
              pollForNewLogs();
            }, delay);
          }
        }
      };

      // Start the process
      const startStreaming = async () => {
        try {
          // Send initial connection message immediately
          const startMessage = `data: ${JSON.stringify({ 
            message: 'Connected to scan logs stream', 
            level: 'info',
            timestamp: Date.now(),
            type: 'status'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(startMessage));
          lastActivityTime = Date.now();

          // Send a message indicating we're waiting for logs
          const waitingMessage = `data: ${JSON.stringify({ 
            message: 'Initializing scan and waiting for logs...', 
            level: 'info',
            timestamp: Date.now(),
            type: 'status'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(waitingMessage));

          // Wait for initial setup (longer delay)
          await new Promise(resolve => setTimeout(resolve, 15000));

          // Start continuous log fetching (more patient)
          await continuouslyFetchLogs();

          // Start polling for new logs
          if (streamingActive) {
            pollForNewLogs();
          }
        } catch (error) {
          console.error('Error in startStreaming:', error);
          // Don't immediately reconnect on startup errors
          setTimeout(() => {
            if (streamingActive) {
              handleReconnect('Startup error');
            }
          }, 5000);
        }
      };

      startStreaming();

      // Cleanup function
      return () => {
        streamingActive = false;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
        }
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
        }
        if (pollingInterval) {
          clearTimeout(pollingInterval);
        }
      };
    },
    cancel() {
      console.log('Stream cancelled by client');
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no',
    },
  });
}

// Helper function to detect log level
function detectLogLevel(message: string | undefined = ''): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('error') || 
      lowerMessage.includes('failed') || 
      lowerMessage.includes('critical') ||
      lowerMessage.includes('fatal') ||
      message.includes('⚠️')) {
    return 'error';
  } else if (lowerMessage.includes('warning') || 
             lowerMessage.includes('warn') ||
             message.includes('[WARNING]')) {
    return 'warning';
  } else if (lowerMessage.includes('success') || 
             lowerMessage.includes('completed') || 
             message.includes('✅')) {
    return 'success';
  } else if (lowerMessage.includes('info') || 
             lowerMessage.includes('starting') || 
             message.includes('🚀') || 
             message.includes('🔍') ||
             message.includes('[INFO]')) {
    return 'info';
  }
  
  return 'info';
}