// src/lib/aws/codebuild.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CodeBuildClient, StartBuildCommand, CreateProjectCommand, BatchGetProjectsCommand } from "@aws-sdk/client-codebuild";
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
    return response.projects && response.projects.length > 0;
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
    console.log(`CodeBuild project ${projectName} already exists.`);
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
        type: 'PLAINTEXT'
      }))
    : Object.entries(environmentVariables).map(([key, value]) => ({
        name: key,
        value: String(value),
        type: 'PLAINTEXT'
      }));
  
  // Add ngrok auth token to env vars
  envVars.push({
    name: 'NGROK_AUTH_TOKEN',
    value: process.env.NGROK_AUTH_TOKEN || '',
    type: 'PLAINTEXT'
  });
  
  // Create CodeBuild project
  const createProjectParams = {
    name: projectName,
    description: `Build project for ${repository.name}`,
    source: {
      type: 'GITHUB',
      location: repository.url,
      buildspec: generateBuildSpec(config),
    },
    artifacts: {
      type: 'NO_ARTIFACTS',
    },
    environment: {
      type: 'LINUX_CONTAINER',
      image: config.hasDocker ? 'aws/codebuild/amazonlinux2-x86_64-standard:4.0' : 'aws/codebuild/amazonlinux2-x86_64-standard:3.0',
      computeType: 'BUILD_GENERAL1_SMALL',
      privilegedMode: config.hasDocker, // Enable for Docker builds
      environmentVariables: envVars
    },
    serviceRole: process.env.CODEBUILD_SERVICE_ROLE_ARN,
    logsConfig: {
      cloudWatchLogs: {
        status: 'ENABLED',
        groupName: 'codebuild-logs',
      },
    }
  };

  try {
    const command = new CreateProjectCommand(createProjectParams);
    const response = await codeBuildClient.send(command);
    console.log(`Created CodeBuild project: ${projectName}`);
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

// Trigger build for a repository
export async function triggerBuild(repositoryId: string) {
  // Fetch repository with its config
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: { config: true }
  });

  if (!repository || !repository.config) {
    throw new Error('Repository or config not found');
  }

  const projectName = `repo-${repository.id}`;

  // Check if project exists, if not create it
  const exists = await projectExists(projectName);
  if (!exists) {
    console.log(`CodeBuild project ${projectName} does not exist. Creating it now...`);
    await createCodeBuildProject(repository, repository.config);
  }

  // Start the build
  const startBuildParams = {
    projectName,
    environmentVariablesOverride: [
      {
        name: 'WEBHOOK_URL',
        value: `${process.env.APP_URL}/api/webhooks/deployment`,
        type: 'PLAINTEXT'
      }
    ]
  };

  console.log('Starting build with params:', startBuildParams);
  try {
    const command = new StartBuildCommand(startBuildParams);
    const response = await codeBuildClient.send(command);
    console.log(`Started build for project: ${projectName}`);
    
    // Update repository status in database
    await prisma.repositoryConfig.update({
      where: { id: repository.config.id },
      data: { 
        buildStatus: 'BUILDING',
        lastBuildId: response.build?.id,
        lastBuildStartTime: new Date()
      }
    });
    
    return response;
  } catch (error) {
    console.error('Error starting build:', error);
    throw error;
  }
}