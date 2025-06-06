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
});

const logsClient = new CloudWatchLogsClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

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
      const MAX_RETRIES = 30;
      const INITIAL_RETRY_DELAY = 2000;

      // Function to extract log stream name from task ARN
      const getLogStreamName = (taskArn: string): string => {
        const taskId = taskArn.split('/').pop();
        return `security-scanner/security-scanner/${taskId}`;
      };

      // Function to get task status
      const getTaskStatus = async (): Promise<string> => {
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
          console.error('Error getting task status:', error);
          return 'ERROR';
        }
      };

      // Function to verify log stream exists
      const verifyLogStream = async (logStreamName: string): Promise<boolean> => {
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
          console.error('Error verifying log stream:', error);
          return false;
        }
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
              }
            }
            
            // Store the forward token for future polling
            lastForwardToken = response.nextForwardToken;
            allLogsSent = true;
            retryCount = 0; // Reset retry count on success
          }

        } catch (error: any) {
          console.error('Error getting all logs:', error);
          throw error; // Re-throw to handle in the retry mechanism
        }
      };

      // Function to continuously try to fetch logs
      const continuouslyFetchLogs = async (): Promise<void> => {
        while (retryCount < MAX_RETRIES && streamingActive) {
          try {
            console.log(`Attempt ${retryCount + 1} to fetch logs...`);
            await getAllLogs();
            
            if (allLogsSent) {
              console.log('Successfully retrieved logs');
              return; // Exit if successful
            }
          } catch (error: any) {
            console.log(`Attempt ${retryCount + 1} failed:`, error.message);
            
            // Calculate delay with exponential backoff and jitter
            const exponentialDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
            const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
            const delay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
            
            console.log(`Waiting ${Math.round(delay/1000)} seconds before next attempt...`);
            
            // Send status update to client
            const statusMessage = `data: ${JSON.stringify({ 
              message: `Waiting for logs to become available (attempt ${retryCount + 1}/${MAX_RETRIES})...`,
              level: 'info',
              timestamp: Date.now(),
              type: 'status'
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(statusMessage));
            
            await new Promise(resolve => setTimeout(resolve, delay));
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
              startFromHead: false, // We're polling for new logs only
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
                }
              }
              
              // Update the forward token
              if (response.nextForwardToken && response.nextForwardToken !== lastForwardToken) {
                lastForwardToken = response.nextForwardToken;
              }
            } else {
              // Send a heartbeat message to keep the connection alive
              const heartbeatMessage = `data: ${JSON.stringify({ 
                message: 'Waiting for new logs...',
                level: 'info',
                timestamp: Date.now(),
                type: 'heartbeat'
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(heartbeatMessage));
            }
          }

          // Continue polling based on task status
          if (taskStatus === 'RUNNING') {
            // Keep polling every 2 seconds while running
            setTimeout(() => pollForNewLogs(), 2000);
          } else if (taskStatus === 'STOPPING') {
            // Poll more frequently while stopping
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
            // Log stream might not exist yet, retry
            setTimeout(() => pollForNewLogs(), 3000);
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
              // For other errors, keep polling
              setTimeout(() => pollForNewLogs(), 3000);
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