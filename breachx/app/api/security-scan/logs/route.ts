/* eslint-disable @typescript-eslint/no-unused-vars */
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

// Constants for polling
const MAX_LOGS_PER_REQUEST = 100;
const POLL_TIMEOUT = 50000; // 50 seconds (leaving 10s buffer for Vercel)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('scanId');
  const lastToken = searchParams.get('lastToken');
  const lastTimestamp = searchParams.get('lastTimestamp');

  if (!scanId) {
    return new Response(
      JSON.stringify({ error: 'Scan ID is required' }),
      { status: 400 }
    );
  }

  const scanSession = scanSessions.get(scanId);
  if (!scanSession) {
    return new Response(
      JSON.stringify({ 
        error: 'Scan session not found',
        scanId: scanId,
        availableSessions: Array.from(scanSessions.keys())
      }),
      { status: 404 }
    );
  }

  try {
    // Get task status
    const taskStatus = await getTaskStatus(scanSession.taskArn);
    
    // Get log stream name
    const logStreamName = getLogStreamName(scanSession.taskArn);
    
    // Verify log stream exists
    const streamExists = await verifyLogStream(logStreamName);
    if (!streamExists) {
      return new Response(
        JSON.stringify({
          status: 'waiting',
          message: 'Log stream not yet available',
          taskStatus,
          nextPollDelay: 5000 // Poll again in 5 seconds
        })
      );
    }

    // Get logs
    const params = {
      logGroupName: '/ecs/security-scanner',
      logStreamName: logStreamName,
      limit: MAX_LOGS_PER_REQUEST,
      startFromHead: !lastToken,
      ...(lastToken && { nextToken: lastToken }),
      ...(lastTimestamp && { startTime: parseInt(lastTimestamp) })
    };

    const command = new GetLogEventsCommand(params);
    const response = await logsClient.send(command);

    const logs = response.events?.map(event => ({
      message: event.message,
      timestamp: event.timestamp || Date.now(),
      level: detectLogLevel(event.message),
      type: 'log'
    })) || [];

    // Determine next poll delay based on task status and log availability
    let nextPollDelay = 5000; // Default 5 seconds
    if (taskStatus === 'STOPPED') {
      nextPollDelay = 0; // No need to poll further
    } else if (taskStatus === 'STOPPING') {
      nextPollDelay = 2000; // Poll more frequently when stopping
    } else if (logs.length === 0) {
      nextPollDelay = 10000; // Poll less frequently if no new logs
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        logs,
        taskStatus,
        nextToken: response.nextForwardToken,
        nextPollDelay,
        hasMore: response.events?.length === MAX_LOGS_PER_REQUEST
      })
    );

  } catch (error: any) {
    console.error('Error fetching logs:', error);
    
    // Determine retry delay based on error type
    let nextPollDelay = 5000;
    if (error.name === 'ResourceNotFoundException') {
      nextPollDelay = 10000; // Wait longer if resource not found
    } else if (error.name === 'ThrottlingException') {
      nextPollDelay = 15000; // Wait even longer if throttled
    }

    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message,
        nextPollDelay
      }),
      { status: 500 }
    );
  }
}

// Helper functions
function getLogStreamName(taskArn: string): string {
  const taskId = taskArn.split('/').pop();
  return `security-scanner/security-scanner/${taskId}`;
}

async function getTaskStatus(taskArn: string): Promise<string> {
  try {
    const params = {
      cluster: 'security-scanner-cluster',
      tasks: [taskArn],
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
}

async function verifyLogStream(logStreamName: string): Promise<boolean> {
  try {
    const describeParams = {
      logGroupName: '/ecs/security-scanner',
      logStreamNamePrefix: logStreamName,
      limit: 1
    };
    
    const describeCommand = new DescribeLogStreamsCommand(describeParams);
    const describeResponse = await logsClient.send(describeCommand);
    
    return !!(describeResponse.logStreams && describeResponse.logStreams.length > 0);
  } catch (error) {
    console.error('Error verifying log stream:', error);
    return false;
  }
}

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