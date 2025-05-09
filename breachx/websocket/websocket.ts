/* eslint-disable @typescript-eslint/no-explicit-any */

// src/server/websocket.ts
import AWS from 'aws-sdk';
import { parse } from 'url';
import { WebSocketServer } from 'ws';

// Initialize CloudWatch Logs client


// Function to get log stream name for a build

// Function to stream logs to a WebSocket connection
interface WebSocketLike {
    send: (data: string) => void;
    close?: () => void;
    readyState?: number;
    OPEN?: number;
    on?: (event: string, callback: (...args: any[]) => void) => void;
  }
  
  export const streamBuildLogs = async (buildId: string, ws: WebSocketLike) => {
    try {
      // Configure AWS
      const codebuild = new AWS.CodeBuild({
        region: process.env.AWS_REGION || 'us-east-1',
        // Credentials will be automatically loaded from environment variables or IAM role
      });
      
      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'info',
        message: `Starting log stream for build ${buildId}`,
        timestamp: Date.now()
      }));
      
      // Start the log streaming process
      let nextToken: string | undefined;
      const logGroupName = `/aws/codebuild/${process.env.CODEBUILD_PROJECT_NAME || 'your-project-name'}`;
      const logStreamName = `${buildId}`;
      
      // This is potentially a long-running operation, so we need to check if the connection is still open
      const interval = setInterval(async () => {
        // Check if the connection is still open
        const isOpen = ws.readyState !== undefined ? 
          (ws.readyState === (ws.OPEN || 1)) : 
          true; // If no readyState property, assume it's open
        
        if (!isOpen) {
          clearInterval(interval);
          return;
        }
        
        try {
          // Get log events from CloudWatch
          const cloudwatchlogs = new AWS.CloudWatchLogs({
            region: process.env.AWS_REGION || 'us-east-1',
          });
          
          const params = {
            logGroupName,
            logStreamName,
            nextToken,
            startFromHead: true
          };
          
          const logEvents = await cloudwatchlogs.getLogEvents(params).promise();
          
          // Send each log event to the client
          if (logEvents.events && logEvents.events.length > 0) {
            for (const event of logEvents.events) {
              ws.send(JSON.stringify({
                type: 'log',
                message: event.message || '',
                timestamp: event.timestamp
              }));
            }
          }
          
          // Update the next token for pagination
          nextToken = logEvents.nextForwardToken;
          
          // Check if the build is complete
          const buildInfo = await codebuild.batchGetBuilds({
            ids: [buildId]
          }).promise();
          
          if (buildInfo.builds && buildInfo.builds.length > 0) {
            const build = buildInfo.builds[0];
            
            if (['SUCCEEDED', 'FAILED', 'STOPPED', 'FAULT', 'TIMED_OUT'].includes(build.buildStatus || '')) {
              ws.send(JSON.stringify({
                type: 'info',
                message: `Build ${buildId} completed with status: ${build.buildStatus}`,
                timestamp: Date.now()
              }));
              
              clearInterval(interval);
              
              // Give some time for any final logs to be sent
              setTimeout(() => {
                if (ws.close) {
                  ws.close();
                }
              }, 5000);
            }
          }
        } catch (error) {
          console.error('Error fetching logs:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Error fetching logs: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now()
          }));
        }
      }, 3000); // Poll every 3 seconds
      
      // Clean up when the connection is closed
      if (ws.on) {
        ws.on('close', () => {
          clearInterval(interval);
        });
      }
    } catch (error) {
      console.error('Error setting up log stream:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Error setting up log stream: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      }));
      
      // Close the connection in case of setup error
      if (ws.close) {
        ws.close();
      }
    }
  };

// Create WebSocket server
export function createWebSocketServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });
  
  server.on('upgrade', (request: any, socket: any, head: any) => {
    const { pathname, query } = parse(request.url, true);
    
    if (pathname === '/api/ws/build-logs') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, query);
      });
    } else {
      socket.destroy();
    }
  });
  
  wss.on('connection', ({ws, query}:any) => {
    const buildId = query.buildId as string;
    
    if (!buildId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No buildId provided'
      }));
      ws.close();
      return;
    }
    
    // Start streaming logs for the build
    streamBuildLogs(buildId, ws);
    
    ws.on('error', (error:any) => {
      console.error('WebSocket error:', error);
    });
  });
  
  return wss;
}