// src/lib/aws/codebuild.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CodeBuildClient, StartBuildCommand, CreateProjectCommand, BatchGetProjectsCommand, StartBuildCommandInput, CreateProjectCommandInput, EnvironmentVariableType } from "@aws-sdk/client-codebuild";

// Trigger build for a repository
// src/lib/aws/codebuild.ts
// Add these imports at the top of your file
import { CloudWatchLogsClient, GetLogEventsCommand, DescribeLogStreamsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { WebSocket } from 'ws';
import { PrismaClient, Repository, RepositoryConfig } from '@prisma/client';

const prisma = new PrismaClient();



// Initialize AWS CodeBuild client
const codeBuildClient = new CodeBuildClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

// Function to check if a CodeBuild project exists
async function projectExists(projectName: string): Promise<boolean> {
  try {
    const command = new BatchGetProjectsCommand({ names: [projectName] });
    const response = await codeBuildClient.send(command);
    return !!(response.projects && response.projects.length > 0);
  } catch (error) {
    console.error(`Error checking if project ${projectName} exists:`, error);
    return false;
  }
}

// Function to create CodeBuild project for a repository
export async function createCodeBuildProject(repository: Repository, config: RepositoryConfig) {
  const projectName = `repo-${repository.id}`;
  
  // Check if project already exists
  const exists = await projectExists(projectName);
  if (exists) {
    return { project: { name: projectName } };
  }
  
  // Parse environment variables from JSON
  let environmentVariables = [];
  try {
    if (config.environmentVariables) {
      if (typeof config.environmentVariables === 'string') {
        environmentVariables = JSON.parse(config.environmentVariables);
      } else {
        environmentVariables = config.environmentVariables as any;
      }
    }
  } catch (error) {
    console.error('Error parsing environment variables:', error);
    environmentVariables = [];
  }
  
  // Convert to CodeBuild environment variables format
    const envVars = Array.isArray(environmentVariables) 
      ? environmentVariables.map(({ key, value }: { key: string, value: string }) => ({
          name: key,
          value: value,
          type: 'PLAINTEXT' as EnvironmentVariableType
        }))
      : Object.entries(environmentVariables).map(([key, value]) => ({
          name: key,
          value: String(value),
          type: 'PLAINTEXT' as EnvironmentVariableType
        }));
  
  // Add ngrok auth token to env vars
  envVars.push({
    name: 'NGROK_AUTH_TOKEN',
    value: process.env.NGROK_AUTH_TOKEN || '',
    type: 'PLAINTEXT'
  });
  
  // Create CodeBuild project
  const createProjectParams: CreateProjectCommandInput = {
    name: projectName,
    description: `Build project for ${repository.name}`,
    source: {
      type: "GITHUB",
      location: repository.url,
      buildspec: generateBuildSpec(config),
    },
    artifacts: {
      type: "NO_ARTIFACTS",
    },
    environment: {
      type: "LINUX_CONTAINER",
      image: 'aws/codebuild/standard:6.0', // ✅ Node.js 16+ compatible
      computeType: "BUILD_GENERAL1_MEDIUM",
      privilegedMode: config.hasDocker,
      environmentVariables: envVars
    },
    logsConfig: {
      cloudWatchLogs: {
        status: "ENABLED",
        groupName: 'codebuild-logs',
      },
    },
    serviceRole: process.env.CODEBUILD_SERVICE_ROLE_ARN!,
  };

  try {
    const command = new CreateProjectCommand(createProjectParams);
    const response = await codeBuildClient.send(command);
    return response;
  } catch (error) {
    console.error('Error creating CodeBuild project:', error);
    throw error;
  }
}

// Generate buildspec.yml content based on repository config
function generateBuildSpec(config: RepositoryConfig): string {
    // Set default values if not provided
    const rootDir = config.rootDirectory || '.';
    const buildCmd = config.buildCommand || 'npm install && npm run build';
    const runCmd = config.runCommand || 'npm start';
    
    return `
  version: 0.2
  phases:
    install:
      runtime-versions:
        nodejs: 16
      commands:
        - npm install -g ngrok
    pre_build:
      commands:
        - echo Logging in to Docker...
        ${config.hasDocker ? '- aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY_URI' : '# No Docker configuration'}
        ${config.hasDocker && config.dockerConfig ? `- ${config.dockerConfig}` : ''}
        - cd ${rootDir}
        - echo Installing dependencies...
        - npm install
    build:
      commands:
        - echo Build started on \`date\`
        - ${buildCmd}
    post_build:
      commands:
        - echo Starting application with ngrok tunnel...
        - nohup ${runCmd} &
        - sleep 10
        - ngrok http 3000 --authtoken=$NGROK_AUTH_TOKEN --log=stdout > ngrok_output.log &
        - sleep 5
        - NGROK_URL=$(grep -o 'https://[0-9a-z\\-]*.ngrok.io' ngrok_output.log | head -1)
        - echo $NGROK_URL
        - |
          curl -X POST $WEBHOOK_URL -H 'Content-Type: application/json' -d "{\\\"repositoryId\\\":\\\"${config.repositoryId}\\\",\\\"url\\\":\\\"$NGROK_URL\\\"}"
  artifacts:
    files:
      - ngrok_output.log
    `;
  }



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
export async function streamBuildLogs(buildId: string, websocket: WebSocket): Promise<void> {
  let logStreamName: string | null = null;
  let nextToken: string | undefined = undefined;
  let retryCount = 0;
  const MAX_RETRIES = 30; // Retry for up to ~30 seconds to find the log stream
  const POLL_INTERVAL = 5000; // Poll for new logs every 5 seconds
  
  // First, try to get the log stream name (may take a few seconds to be created)
  while (!logStreamName && retryCount < MAX_RETRIES) {
    logStreamName = await getLogStreamName(buildId);
    
    if (!logStreamName) {
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
    }
  }
  
  if (!logStreamName) {
    websocket.send(JSON.stringify({
      type: 'error',
      message: 'Could not find log stream for build'
    }));
    return;
  }
  
  websocket.send(JSON.stringify({
    type: 'info',
    message: `Connected to log stream: ${logStreamName}`
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
            websocket.send(JSON.stringify({
              type: 'log',
              timestamp: event.timestamp,
              message: event.message
            }));
          }
        }
      }
      
      // Store the next token for the next poll
      nextToken = response.nextForwardToken;
      
      // Check if the build is complete
      // This is a simplistic approach - in a real implementation you would
      // check the build status from CodeBuild API
      if (response.events?.some(e => e.message?.includes('Build complete'))) {
        clearInterval(intervalId);
        websocket.send(JSON.stringify({
          type: 'info',
          message: 'Build completed'
        }));
      }
    } catch (error) {
      console.error('Error streaming logs:', error);
      websocket.send(JSON.stringify({
        type: 'error',
        message: 'Error retrieving logs'
      }));
      clearInterval(intervalId);
    }
  }, POLL_INTERVAL);
  
  // Clean up when the WebSocket closes
  websocket.on('close', () => {
    clearInterval(intervalId);
  });
}

// Replace your existing triggerBuild function with this one
export async function triggerBuild(repository: any) {
  const projectName = `repo-${repository.id}`;

  // Check if project exists, if not create it
  const exists = await projectExists(projectName);
  if (!exists) {
    await createCodeBuildProject(repository, repository.config);
  }

  // Start the build
  const startBuildParams: StartBuildCommandInput = {
    projectName,
    environmentVariablesOverride: [
      {
        name: 'WEBHOOK_URL',
        value: `${process.env.APP_URL}/api/webhooks/deployment`,
        type: 'PLAINTEXT'
      }
    ]
  };

  try {
    const command = new StartBuildCommand(startBuildParams);
    const response = await codeBuildClient.send(command);
    const buildId = response.build?.id;
    
    // Update repository status in database
    await prisma.repositoryConfig.update({
      where: { id: repository.config.id },
      data: { 
        buildStatus: 'BUILDING',
        lastBuildId: buildId,
        lastBuildStartTime: new Date()
      }
    });
    
    return {
      buildResponse: response,
      buildId: buildId
    };
  } catch (error) {
    console.error('Error starting build:', error);
    throw error;
  }
}