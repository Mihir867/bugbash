/* eslint-disable @typescript-eslint/no-explicit-any */

// src/server/websocket.ts
import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { CloudWatchLogsClient, GetLogEventsCommand, DescribeLogStreamsCommand } from "@aws-sdk/client-cloudwatch-logs";

// Initialize CloudWatch Logs client
const cloudWatchLogsClient = new CloudWatchLogsClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

// Function to get log stream name for a build
async function getLogStreamName(buildId: string): Promise<string | null> {
  try {
    // The log stream name usually follows the format: "build-id/build-log"
    const logGroupName = 'codebuild-logs';
    const describeStreamsCommand = new DescribeLogStreamsCommand({
      logGroupName,
      logStreamNamePrefix: buildId,
      limit: 1
    });
    
    const response = await cloudWatchLogsClient.send(describeStreamsCommand);
    
    if (response.logStreams && response.logStreams.length > 0) {
      return response.logStreams[0].logStreamName || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting log stream name:', error);
    return null;
  }
}

// Function to stream logs to a WebSocket connection
async function streamBuildLogs(buildId: string, ws: any): Promise<void> {
  let logStreamName: string | null = null;
  let nextToken: string | undefined = undefined;
  let retryCount = 0;
  const MAX_RETRIES = 30; // Retry for up to ~30 seconds to find the log stream
  const POLL_INTERVAL = 3000; // Poll for new logs every 3 seconds
  
  // First, try to get the log stream name (may take a few seconds to be created)
  while (!logStreamName && retryCount < MAX_RETRIES) {
    logStreamName = await getLogStreamName(buildId);
    
    if (!logStreamName) {
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
    }
  }
  
  if (!logStreamName) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Could not find log stream for build. This may happen if the build has not started yet or if the build ID is invalid.'
    }));
    return;
  }
  
  ws.send(JSON.stringify({
    type: 'info',
    message: `Connected to log stream for build ${buildId}`
  }));
  
  // Poll for new logs
  const logGroupName = 'codebuild-logs';
  const intervalId = setInterval(async () => {
    try {
      const getLogsCommand = new GetLogEventsCommand({
        logGroupName,
        logStreamName,
        nextToken,
        startFromHead: true
      });
      
      const response = await cloudWatchLogsClient.send(getLogsCommand);
      
      if (response.events && response.events.length > 0) {
        // Send each log event to the WebSocket
        for (const event of response.events) {
          if (event.message) {
            ws.send(JSON.stringify({
              type: event.message.includes('ERROR') ? 'error' : 'log',
              timestamp: event.timestamp,
              message: event.message
            }));
          }
        }
      }
      
      // Store the next token for the next poll
      nextToken = response.nextForwardToken;
      
      // Check if the build is complete
      if (response.events?.some(e => e.message?.includes('Completed build:'))) {
        clearInterval(intervalId);
        ws.send(JSON.stringify({
          type: 'info',
          message: 'Build completed'
        }));
      }
    } catch (error) {
      console.error('Error streaming logs:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error retrieving logs'
      }));
      clearInterval(intervalId);
    }
  }, POLL_INTERVAL);
  
  // Clean up when the WebSocket closes
  ws.on('close', () => {
    clearInterval(intervalId);
  });
}

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