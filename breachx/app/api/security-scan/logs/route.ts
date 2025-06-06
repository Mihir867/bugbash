/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CloudWatchLogsClient, GetLogEventsCommand, DescribeLogStreamsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ECSClient, DescribeTasksCommand } from '@aws-sdk/client-ecs';
import { NextRequest } from 'next/server';
import { scanSessions } from '@/lib/scanSessions';
import prisma from '@/lib/db';

// Define proper types
type TaskStatus = 'RUNNING' | 'STOPPED' | 'FAILED';

interface ScanSession {
  taskArn: string;
  startTime: string;
  status: TaskStatus;
}

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
const MAX_LOGS_PER_REQUEST = 1000;
const POLL_TIMEOUT = 50000; // 50 seconds (leaving 10s buffer for Vercel)
const MAX_RETRY_ATTEMPTS = 3;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('scanId');
  const lastToken = searchParams.get('lastToken');
  const lastTimestamp = searchParams.get('lastTimestamp');
  const isInitialRequest = searchParams.get('initial') === 'true';
  const retryCount = parseInt(searchParams.get('retryCount') || '0');

  if (!scanId) {
    return new Response(
      JSON.stringify({ error: 'Scan ID is required' }),
      { status: 400 }
    );
  }

  let scanSession = scanSessions.get(scanId);
  
  // If session not found in memory, try to recover from database
  if (!scanSession && retryCount < MAX_RETRY_ATTEMPTS) {
    try {
      const dbScan = await prisma.repositoryConfig.findUnique({
        where: { id: scanId },
        select: {
          id: true,
          taskArn: true,
          securityStatus: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (dbScan) {
        // Reconstruct session from database
        const reconstructedSession: ScanSession = {
          taskArn: dbScan.taskArn || '',
          status: (dbScan.securityStatus as TaskStatus) || 'RUNNING',
          startTime: dbScan.createdAt.toISOString()
        };
        // Restore session in memory
        scanSessions.set(scanId, reconstructedSession);
        scanSession = reconstructedSession;
      }
    } catch (error) {
      console.error('Error recovering scan session from database:', error);
    }
  }

  if (!scanSession) {
    return new Response(
      JSON.stringify({ 
        error: 'Scan session not found',
        scanId: scanId,
        retryCount,
        nextRetryDelay: Math.min(1000 * Math.pow(2, retryCount), 10000),
        shouldRetry: retryCount < MAX_RETRY_ATTEMPTS
      }),
      { status: 404 }
    );
  }

  try {
    // Get task status
    const taskStatus = await getTaskStatus(scanSession.taskArn) as TaskStatus;
    
    // Update session status if task status has changed
    if (taskStatus !== scanSession.status) {
      const updatedSession: ScanSession = {
        ...scanSession,
        status: taskStatus
      };
      scanSessions.set(scanId, updatedSession);
      
      // Update database
      try {
        await prisma.repositoryConfig.update({
          where: { id: scanId },
          data: { 
            securityStatus: taskStatus,
            updatedAt: new Date()
          }
        });
      } catch (error) {
        console.error('Error updating scan status in database:', error);
      }
    }
    
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
          nextPollDelay: 5000
        })
      );
    }

    // Get logs with proper pagination
    const params = {
      logGroupName: '/ecs/security-scanner',
      logStreamName: logStreamName,
      limit: MAX_LOGS_PER_REQUEST,
      startFromHead: isInitialRequest,
      ...(lastToken && !isInitialRequest && { nextToken: lastToken }),
      ...(lastTimestamp && !isInitialRequest && { startTime: parseInt(lastTimestamp) })
    };

    const command = new GetLogEventsCommand(params);
    const response = await logsClient.send(command);

    // Process and deduplicate logs
    const processedLogs = new Map<string, any>();
    response.events?.forEach(event => {
      if (event.message && event.timestamp) {
        const logKey = `${event.timestamp}-${event.message}`;
        if (!processedLogs.has(logKey)) {
          processedLogs.set(logKey, {
            message: event.message,
            timestamp: event.timestamp,
            level: detectLogLevel(event.message),
            type: 'log'
          });
        }
      }
    });

    const logs = Array.from(processedLogs.values());

    // Determine next poll delay based on task status and log availability
    let nextPollDelay = 5000;
    if (taskStatus === 'STOPPED') {
      nextPollDelay = 0;
    } else if (taskStatus === 'FAILED') {
      nextPollDelay = 0;
    } else if (logs.length === 0) {
      nextPollDelay = 10000;
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
    
    let nextPollDelay = 5000;
    if (error.name === 'ResourceNotFoundException') {
      nextPollDelay = 10000;
    } else if (error.name === 'ThrottlingException') {
      nextPollDelay = 15000;
    }

    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message,
        nextPollDelay,
        retryCount,
        shouldRetry: retryCount < MAX_RETRY_ATTEMPTS
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