/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

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

  // Debug logging
  console.log('Logs request - Scan ID:', scanId);
  console.log('Total sessions available:', scanSessions.size);
  console.log('Available scan sessions:', Array.from(scanSessions.keys()));

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
    console.log('Scan session not found for ID:', scanId);
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

  console.log('Found scan session:', scanSession);

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      let nextToken: string | undefined = undefined;
      let logStreamName: string | undefined = undefined;
      let logStreamExists: boolean = false;
      let taskStatus: string = 'PENDING';
      let streamingActive = true;

      // Function to extract log stream name from task ARN
      const getLogStreamName = (taskArn: string): string => {
        const taskId = taskArn.split('/').pop();
        return `security-scanner/security-scanner/${taskId}`;
      };

      // Function to check if log stream exists
      const checkLogStreamExists = async (): Promise<boolean> => {
        try {
          const params = {
            logGroupName: '/ecs/security-scanner',
            logStreamNamePrefix: logStreamName,
          };
          
          const command = new DescribeLogStreamsCommand(params);
          const response = await logsClient.send(command);
          
          return response.logStreams !== undefined && response.logStreams.length > 0;
        } catch (error) {
          return false;
        }
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

      const streamLogs = async (isFinalAttempt: boolean = false): Promise<void> => {
        if (!streamingActive) return;

        try {
          // Get current task status
          taskStatus = await getTaskStatus();
          
          // Send status update
          const statusMessage = `data: ${JSON.stringify({ 
            message: `Task status: ${taskStatus}`, 
            level: 'info',
            timestamp: Date.now()
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(statusMessage));

          if (!logStreamName) {
            logStreamName = getLogStreamName(scanSession.taskArn);
          }

          // Check if log stream exists
          if (!logStreamExists) {
            logStreamExists = await checkLogStreamExists();
            
            if (!logStreamExists) {
              // If task is still starting up, wait and retry
              if (['PENDING', 'PROVISIONING', 'ACTIVATING'].includes(taskStatus)) {
                const waitMessage = `data: ${JSON.stringify({ 
                  message: 'Waiting for container to start...', 
                  level: 'info',
                  timestamp: Date.now()
                })}\n\n`;
                controller.enqueue(new TextEncoder().encode(waitMessage));
                setTimeout(() => streamLogs(), 3000);
                return;
              } else if (taskStatus === 'RUNNING') {
                const runningMessage = `data: ${JSON.stringify({ 
                  message: 'Container is running, waiting for logs...', 
                  level: 'info',
                  timestamp: Date.now()
                })}\n\n`;
                controller.enqueue(new TextEncoder().encode(runningMessage));
                setTimeout(() => streamLogs(), 2000);
                return;
              } else if (['STOPPED', 'STOPPING'].includes(taskStatus)) {
                const stoppedMessage = `data: ${JSON.stringify({ 
                  message: `Task ${taskStatus.toLowerCase()}, checking for final logs...`, 
                  level: 'warning',
                  timestamp: Date.now()
                })}\n\n`;
                controller.enqueue(new TextEncoder().encode(stoppedMessage));
                setTimeout(() => streamLogs(true), 1000);
                return;
              }
            }
          }

          // Try to fetch logs if stream exists
          if (logStreamExists && logStreamName) {
            const params = {
              logGroupName: '/ecs/security-scanner',
              logStreamName: logStreamName,
              startFromHead: false,
              ...(nextToken && { nextToken })
            };

            const command = new GetLogEventsCommand(params);
            const response = await logsClient.send(command);

            // Send each log event
            for (const event of response.events || []) {
              const logData = {
                message: event.message,
                timestamp: event.timestamp,
                level: detectLogLevel(event.message)
              };

              const logMessage = `data: ${JSON.stringify(logData)}\n\n`;
              controller.enqueue(new TextEncoder().encode(logMessage));
            }

            nextToken = response.nextForwardToken;
          }

          // Continue streaming based on task status
          if (['PENDING', 'PROVISIONING', 'ACTIVATING', 'RUNNING'].includes(taskStatus)) {
            setTimeout(() => streamLogs(), 2000);
          } else {
            // Task has stopped, send completion event
            const completeMessage = `event: complete\ndata: ${JSON.stringify({ 
              summary: `Scan completed with status: ${taskStatus}` 
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(completeMessage));
            controller.close();
            streamingActive = false;
          }

        } catch (error: any) {
          console.error('Error streaming logs:', error);
          
          // If it's a ResourceNotFoundException and task is still starting, retry
          if (error.name === 'ResourceNotFoundException' && 
              ['PENDING', 'PROVISIONING', 'ACTIVATING', 'RUNNING'].includes(taskStatus)) {
            const retryMessage = `data: ${JSON.stringify({ 
              message: 'Log stream not ready yet, retrying...', 
              level: 'info',
              timestamp: Date.now()
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(retryMessage));
            setTimeout(() => streamLogs(), 3000);
          } else {
            const errorMessage = `data: ${JSON.stringify({ 
              error: `Failed to fetch logs: ${error.message}`,
              timestamp: Date.now()
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorMessage));
            controller.close();
            streamingActive = false;
          }
        }
      };

      // Start streaming logs with initial delay
      const startMessage = `data: ${JSON.stringify({ 
        message: 'Starting security scan...', 
        level: 'info',
        timestamp: Date.now()
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(startMessage));
      
      setTimeout(() => streamLogs(), 2000);
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
  if (lowerMessage.includes('error') || lowerMessage.includes('failed')) {
    return 'error';
  } else if (lowerMessage.includes('warning') || lowerMessage.includes('warn')) {
    return 'warning';
  } else if (lowerMessage.includes('success') || lowerMessage.includes('completed')) {
    return 'success';
  }
  return 'info';
}