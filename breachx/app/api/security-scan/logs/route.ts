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
  maxAttempts: 5, // Add retry attempts for AWS SDK
  retryMode: 'adaptive', // Use adaptive retry mode
});

const logsClient = new CloudWatchLogsClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 5, // Add retry attempts for AWS SDK
  retryMode: 'adaptive', // Use adaptive retry mode
});

// Constants for connection management
const HEARTBEAT_INTERVAL = 30000; // Increased to 30 seconds
const MAX_RECONNECT_ATTEMPTS = 30; // Increased max attempts
const RECONNECT_DELAY = 2000; // Base delay of 2 seconds
const CONNECTION_TIMEOUT = 480000; // 8 minutes timeout for initial connection
const MAX_RETRY_DELAY = 30000; // Maximum delay between retries
const KEEP_ALIVE_INTERVAL = 240000; // 4 minutes keep-alive interval
const MAX_INACTIVITY_TIME = 480000; // 8 minutes max inactivity time

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
          'X-Accel-Buffering': 'no', // Disable proxy buffering
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
          'X-Accel-Buffering': 'no', // Disable proxy buffering
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
      let lastActivityTime = Date.now();
      let connectionStartTime = Date.now();

      // Function to send heartbeat
      const sendHeartbeat = () => {
        if (!streamingActive) return;
        
        const heartbeatMessage = `data: ${JSON.stringify({ 
          message: 'Connection heartbeat',
          level: 'info',
          timestamp: Date.now(),
          type: 'heartbeat'
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(heartbeatMessage));
        lastActivityTime = Date.now();
      };

      // Function to send keep-alive message
      const sendKeepAlive = () => {
        if (!streamingActive) return;
        
        const keepAliveMessage = `data: ${JSON.stringify({ 
          message: 'Connection keep-alive',
          level: 'info',
          timestamp: Date.now(),
          type: 'keep-alive'
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(keepAliveMessage));
        lastActivityTime = Date.now();
      };

      // Start heartbeat interval
      heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      
      // Start keep-alive interval
      keepAliveInterval = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL);

      // Function to handle reconnection
      const handleReconnect = () => {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }

        if (retryCount < MAX_RECONNECT_ATTEMPTS) {
          // Use exponential backoff with jitter
          const baseDelay = Math.min(RECONNECT_DELAY * Math.pow(1.5, retryCount), MAX_RETRY_DELAY);
          const jitter = Math.random() * 1000; // Add up to 1 second of jitter
          const delay = baseDelay + jitter;
          retryCount++;

          const reconnectMessage = `data: ${JSON.stringify({ 
            message: `Connection lost. Reconnecting in ${Math.round(delay/1000)} seconds... (Attempt ${retryCount}/${MAX_RECONNECT_ATTEMPTS})`,
            level: 'warning',
            timestamp: Date.now(),
            type: 'reconnect'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(reconnectMessage));

          reconnectTimeout = setTimeout(() => {
            if (streamingActive) {
              pollForNewLogs();
            }
          }, delay);
        } else {
          const errorMessage = `data: ${JSON.stringify({ 
            message: 'Failed to reconnect after multiple attempts. Please refresh the page.',
            level: 'error',
            timestamp: Date.now(),
            type: 'error'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorMessage));
          controller.close();
          streamingActive = false;
        }
      };

      // Function to check connection health
      const checkConnectionHealth = () => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityTime;
        const totalConnectionTime = now - connectionStartTime;
        
        // Check for inactivity timeout
        if (timeSinceLastActivity > MAX_INACTIVITY_TIME) {
          console.log('Connection inactive for too long, attempting to reconnect...');
          handleReconnect();
          return;
        }
        
        // Check for total connection time
        if (totalConnectionTime > CONNECTION_TIMEOUT) {
          console.log('Connection timeout reached, attempting to reconnect...');
          handleReconnect();
          return;
        }
        
        // Check for stale connection
        if (timeSinceLastActivity > HEARTBEAT_INTERVAL * 2) {
          console.log('Connection appears to be stale, attempting to reconnect...');
          handleReconnect();
        }
      };

      // Start connection health check
      const healthCheckInterval = setInterval(checkConnectionHealth, HEARTBEAT_INTERVAL);

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

      // Function to continuously try to fetch logs
      const continuouslyFetchLogs = async (): Promise<void> => {
        while (retryCount < MAX_RECONNECT_ATTEMPTS && streamingActive) {
          try {
            console.log(`Attempt ${retryCount + 1} to fetch logs...`);
            await getAllLogs();
            
            if (allLogsSent) {
              console.log('Successfully retrieved logs');
              return;
            }
          } catch (error: any) {
            console.log(`Attempt ${retryCount + 1} failed:`, error.message);
            handleReconnect();
            await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY * Math.pow(2, retryCount)));
            retryCount++;
          }
        }

        if (!allLogsSent) {
          const errorMessage = `data: ${JSON.stringify({ 
            message: 'Could not fetch initial logs after multiple attempts, will continue polling for new logs',
            level: 'warning',
            timestamp: Date.now(),
            type: 'warning'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorMessage));
          allLogsSent = true;
        }
      };

      // Function to poll for new logs
      const pollForNewLogs = async (): Promise<void> => {
        if (!streamingActive || !allLogsSent) return;

        try {
          const logStreamName = getLogStreamName(scanSession.taskArn);
          const taskStatus = await getTaskStatus();

          // Only poll for new logs if we have a forward token
          if (lastForwardToken) {
            const params = {
              logGroupName: '/ecs/security-scanner',
              logStreamName: logStreamName,
              nextToken: lastForwardToken,
              startFromHead: false,
            };

            const command = new GetLogEventsCommand(params);
            const response = await logsClient.send(command);

            // Send any new log events
            if (response.events && response.events.length > 0) {
              console.log(`Found ${response.events.length} new log events`);
              
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
            } else {
              // If no new logs, send a heartbeat to keep the connection alive
              sendHeartbeat();
            }
          }

          // Continue polling based on task status
          if (taskStatus === 'RUNNING') {
            setTimeout(() => pollForNewLogs(), 2000);
          } else if (taskStatus === 'STOPPING') {
            setTimeout(() => pollForNewLogs(), 1000);
          } else if (taskStatus === 'STOPPED') {
            // Do one final poll and then close
            setTimeout(() => {
              pollForNewLogs().then(() => {
                const completeMessage = `event: complete\ndata: ${JSON.stringify({ 
                  message: `Scan completed with status: ${taskStatus}`,
                  summary: `Security scan completed`,
                  timestamp: Date.now(),
                  type: 'complete'
                })}\n\n`;
                controller.enqueue(new TextEncoder().encode(completeMessage));
                controller.close();
                streamingActive = false;
              });
            }, 1000);
          } else {
            // For any other status, keep polling but log the status
            const statusMessage = `data: ${JSON.stringify({ 
              message: `Task status: ${taskStatus}`,
              level: 'info',
              timestamp: Date.now(),
              type: 'status'
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(statusMessage));
            setTimeout(() => pollForNewLogs(), 2000);
          }

        } catch (error: any) {
          console.error('Error polling for new logs:', error);
          
          if (error.name === 'ResourceNotFoundException') {
            // Log stream might not exist yet, retry with exponential backoff
            const delay = Math.min(RECONNECT_DELAY * Math.pow(1.5, retryCount), MAX_RETRY_DELAY);
            setTimeout(() => pollForNewLogs(), delay);
          } else {
            // For other errors, log them but keep the connection alive
            const errorMessage = `data: ${JSON.stringify({ 
              message: `Error polling logs: ${error.message}`,
              level: 'error',
              timestamp: Date.now(),
              type: 'error'
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorMessage));
            
            // Only close the connection if it's a critical error
            if (error.name === 'AccessDeniedException' || error.name === 'InvalidParameterException') {
              controller.close();
              streamingActive = false;
            } else {
              // For other errors, keep polling with exponential backoff
              const delay = Math.min(RECONNECT_DELAY * Math.pow(1.5, retryCount), MAX_RETRY_DELAY);
              setTimeout(() => pollForNewLogs(), delay);
            }
          }
        }
      };

      // Start the process
      const startStreaming = async () => {
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
          message: 'Waiting for scan to initialize...', 
          level: 'info',
          timestamp: Date.now(),
          type: 'status'
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(waitingMessage));

        // Wait for initial setup
        await new Promise(resolve => setTimeout(resolve, 20000));

        // Start continuous log fetching
        await continuouslyFetchLogs();

        // Start polling for new logs
        if (streamingActive) {
          pollForNewLogs();
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
      'X-Accel-Buffering': 'no', // Disable proxy buffering
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