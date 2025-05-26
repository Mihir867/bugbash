import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { CloudWatchLogsClient, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';
import { scanSessions } from '@/lib/scanSessions';

const ecsClient = new ECSClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const logsClient = new CloudWatchLogsClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    const { targetUrl } = await request.json();
    
    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Target URL is required' },
        { status: 400 }
      );
    }

    const scanId = uuidv4();
    
    // ECS Task Definition for running ECR container
    const taskParams = {
      cluster: 'security-scanner-cluster',
      taskDefinition: 'security-scanner-task',
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
            subnets: ['subnet-04cd21cb681bf5211', 'subnet-025e6ccc6189c082b', 'subnet-0c9ab40bdcea50e97', 'subnet-0f08c117d2d101dcc', 'subnet-016d044efab82cc35', 'subnet-03a09e227c212818b'],
            securityGroups: ['sg-06c4cedda7ca73e60'],
  
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'security-scanner',
            environment: [
              {
                name: 'TARGET_URL',
                value: targetUrl,
              },
              {
                name: 'SCAN_ID',
                value: scanId,
              },
            ],
          },
        ],
      },
    };

    const command = new RunTaskCommand(taskParams);
    const response = await ecsClient.send(command);

    // Store scan session info
    const sessionData = {
      taskArn: response.tasks[0].taskArn,
      targetUrl,
      startTime: new Date(),
      status: 'running'
    };
    
    scanSessions.set(scanId, sessionData);
    
    // Debug logging
    console.log('Created scan session:', scanId);
    console.log('Session data:', sessionData);
    console.log('Total sessions after creation:', scanSessions.size);
    console.log('All session IDs:', Array.from(scanSessions.keys()));

    return NextResponse.json({ 
      scanId, 
      taskArn: response.tasks[0].taskArn 
    });

  } catch (error) {
    console.error('Error starting security scan:', error);
    return NextResponse.json(
      { error: 'Failed to start security scan' },
      { status: 500 }
    );
  }
}