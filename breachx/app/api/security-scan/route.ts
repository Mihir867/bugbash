/* eslint-disable @typescript-eslint/prefer-as-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ECSClient, RunTaskCommand, RunTaskCommandInput } from '@aws-sdk/client-ecs';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    const { targetUrl }: { targetUrl: string } = await request.json();

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Target URL is required' },
        { status: 400 }
      );
    }

    const scanId = uuidv4();

    const taskParams: RunTaskCommandInput = {
      cluster: 'security-scanner-cluster',
      taskDefinition: 'security-scanner-task',
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [
            'subnet-04cd21cb681bf5211',
            'subnet-025e6ccc6189c082b',
            'subnet-0c9ab40bdcea50e97',
            'subnet-0f08c117d2d101dcc',
            'subnet-016d044efab82cc35',
            'subnet-03a09e227c212818b',
          ],
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

    const taskArn = response.tasks?.[0]?.taskArn ?? null;

    if (!taskArn) {
      throw new Error('Task failed to start');
    }

    const sessionData = {
      taskArn,
      targetUrl,
      startTime: new Date().toISOString(),
      status: 'RUNNING' as 'RUNNING', // now it's a literal type
    };    

    scanSessions.set(scanId, sessionData);

    return NextResponse.json({
      scanId,
      taskArn,
    });

  } catch (error) {
    console.error('Error starting security scan:', error);
    return NextResponse.json(
      { error: 'Failed to start security scan' },
      { status: 500 }
    );
  }
}
