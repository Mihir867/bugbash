/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CodeBuildClient,
  StartBuildCommand,
  CreateProjectCommand,
  BatchGetProjectsCommand,
  StartBuildCommandInput,
  CreateProjectCommandInput,
  EnvironmentVariableType
} from "@aws-sdk/client-codebuild";
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand
} from "@aws-sdk/client-cloudwatch-logs";
import AWS from 'aws-sdk';
import { WebSocket } from 'ws';
import { PrismaClient, Repository, RepositoryConfig } from '@prisma/client';

// Enhanced logging
const logger = {
  info: (message: string, data?: any) => {
    const logMessage = data ? `${message}: ${JSON.stringify(data, null, 2)}` : message;
    console.log(`[INFO] ${new Date().toISOString()} - ${logMessage}`);
  },
  error: (message: string, error: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}:`, error);
    if (error instanceof Error) {
      console.error(`Stack trace: ${error.stack}`);
    }
  },
  debug: (message: string, data?: any) => {
    const logMessage = data ? `${message}: ${JSON.stringify(data, null, 2)}` : message;
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${logMessage}`);
  }
};

logger.info("Initializing AWS CodeBuild deployment module");

const prisma = new PrismaClient();

logger.info("Setting up AWS clients with region", { region: process.env.AWS_REGION || 'us-east-1' });

const codeBuildClient = new CodeBuildClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

const cloudWatchLogsClient = new CloudWatchLogsClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

function sanitizeLogStreamName(name: string): string {
  if (!name) return 'unknown';
  const sanitized = name
    .replace(/:/g, '-')
    .replace(/\*/g, '_')
    .replace(/[^a-zA-Z0-9\.\-_\/\#]/g, '_');
  logger.debug(`Sanitized log stream name from "${name}" to "${sanitized}"`);
  return sanitized;
}

async function projectExists(projectName: string): Promise<boolean> {
  logger.debug(`Checking if CodeBuild project "${projectName}" exists`);
  try {
    const command = new BatchGetProjectsCommand({ names: [projectName] });
    const response = await codeBuildClient.send(command);
    const exists = !!(response.projects && response.projects.length > 0);
    logger.info(`Project "${projectName}" ${exists ? 'exists' : 'does not exist'}`);
    if (exists) {
      logger.debug(`Project details:`, response.projects?.[0]);
    }
    return exists;
  } catch (error) {
    logger.error(`Error checking if project ${projectName} exists`, error);
    return false;
  }
}

export async function createCodeBuildProject(repository: Repository, config: RepositoryConfig) {
  logger.info(`Creating CodeBuild project for repository ${repository.id} (${repository.name})`, { 
    repositoryUrl: repository.url 
  });
  
  const projectName = `repo-${repository.id}`;
  const exists = await projectExists(projectName);
  if (exists) {
    logger.info(`Project ${projectName} already exists, skipping creation`);
    return { project: { name: projectName } };
  }

  let environmentVariables = [];
  try {
    if (config.environmentVariables) {
      logger.debug(`Parsing environment variables for ${projectName}`);
      environmentVariables = typeof config.environmentVariables === 'string'
        ? JSON.parse(config.environmentVariables)
        : config.environmentVariables;
      logger.debug(`Environment variables parsed successfully`, { 
        count: Array.isArray(environmentVariables) ? environmentVariables.length : Object.keys(environmentVariables).length 
      });
    }
  } catch (error) {
    logger.error('Error parsing environment variables', error);
    environmentVariables = [];
  }

  const envVars = Array.isArray(environmentVariables)
    ? environmentVariables.map(({ key, value }: { key: string, value: string }) => ({
        name: key,
        value,
        type: 'PLAINTEXT' as EnvironmentVariableType
      }))
    : Object.entries(environmentVariables).map(([key, value]) => ({
        name: key,
        value: String(value),
        type: 'PLAINTEXT' as EnvironmentVariableType
      }));

  envVars.push({
    name: 'NGROK_AUTH_TOKEN',
    value: process.env.NGROK_AUTH_TOKEN || '',
    type: 'PLAINTEXT'
  });
  
  logger.debug(`Configured ${envVars.length} environment variables`);

  // Generate buildspec and log it for debugging
  const buildspec = generateBuildSpec(config);
  logger.debug(`Generated buildspec:`, { buildspec });

  // Verify service role
  if (!process.env.CODEBUILD_SERVICE_ROLE_ARN) {
    throw new Error('CODEBUILD_SERVICE_ROLE_ARN environment variable is required');
  }
  logger.debug(`Using service role: ${process.env.CODEBUILD_SERVICE_ROLE_ARN}`);

  const createProjectParams: CreateProjectCommandInput = {
    name: projectName,
    description: `Build project for ${repository.name}`,
    source: {
      type: "GITHUB",
      location: repository.url,
      buildspec: buildspec,
      // Add auth type if using GitHub
      auth: {
        type: "OAUTH",
      },
    },
    artifacts: { type: "NO_ARTIFACTS" },
    environment: {
      type: "LINUX_CONTAINER",
      image: 'aws/codebuild/standard:6.0',
      computeType: "BUILD_GENERAL1_MEDIUM",
      privilegedMode: !!config.hasDocker, // Ensure boolean
      environmentVariables: envVars
    },
    logsConfig: {
      cloudWatchLogs: {
        status: "ENABLED",
        groupName: `/aws/codebuild/${projectName}`,
      }
    },
    serviceRole: process.env.CODEBUILD_SERVICE_ROLE_ARN,
  };

  logger.info(`Creating CodeBuild project with params:`, {
    projectName,
    repoUrl: repository.url,
    serviceRole: process.env.CODEBUILD_SERVICE_ROLE_ARN,
    hasDocker: !!config.hasDocker
  });

  try {
    const command = new CreateProjectCommand(createProjectParams);
    logger.debug('Sending CreateProjectCommand to AWS');
    const result = await codeBuildClient.send(command);
    logger.info(`Successfully created CodeBuild project ${projectName}`, {
      projectArn: result.project?.arn
    });
    return result;
  } catch (error) {
    logger.error('Error creating CodeBuild project', error);
    throw error;
  }
}

function generateBuildSpec(config: RepositoryConfig): string {
  const installCmds = config.installCommand?.trim()
    ? [config.installCommand]
    : ['npm install'];

  const buildCmds = config.buildCommand?.trim()
    ? [config.buildCommand]
    : ['echo "No build command specified"'];

  const formatCommands = (cmds: string[]) =>
    cmds.map(cmd => `      - echo "Running: ${cmd}" && ${cmd}`).join('\n');

  const buildspec = `version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 16
    commands:
${formatCommands(installCmds)}
  build:
    commands:
${formatCommands(buildCmds)}
  post_build:
    commands:
      - echo "Build completed at $(date)"
`;

  logger.debug('Generated buildspec:\n' + buildspec);
  return buildspec;
}



export const streamBuildLogs = async (buildId: string, ws: WebSocket) => {
  logger.info(`Starting log stream for build ${buildId}`);
  const codebuild = new AWS.CodeBuild({ region: process.env.AWS_REGION || 'us-east-1' });

  try {
    logger.debug(`Fetching build information for ${buildId}`);
    const buildInfo = await codebuild.batchGetBuilds({ ids: [buildId] }).promise();
    if (!buildInfo.builds || buildInfo.builds.length === 0) {
      const error = `Build ${buildId} not found`;
      logger.error(error, {});
      throw new Error(error);
    }

    const build = buildInfo.builds[0];
    const logGroupName = build.logs?.groupName;
    const logStreamName = build.logs?.streamName;
    const projectName = build.projectName;

    logger.debug(`Build info for ${buildId}`, { 
      projectName, 
      status: build.buildStatus,
      logGroupName,
      logStreamName 
    });

    if (!logGroupName || !logStreamName) {
      const error = `Missing log group or log stream for build ${buildId}`;
      logger.error(error, { logGroupName, logStreamName });
      throw new Error(error);
    }

    // Check if WebSocket is still open
    if (ws.readyState !== ws.OPEN) {
      logger.error(`WebSocket connection is not open for build ${buildId}`, { readyState: ws.readyState });
      return;
    }

    ws.send(JSON.stringify({
      type: 'info',
      message: `Starting log stream for build ${buildId} of project ${projectName}`,
      timestamp: Date.now()
    }));

    let nextToken: string | undefined;

    const interval = setInterval(async () => {
      if (ws.readyState !== ws.OPEN) {
        logger.info(`WebSocket closed for build ${buildId}, stopping log stream`);
        clearInterval(interval);
        return;
      }

      try {
        logger.debug(`Fetching log events for ${buildId}`, { 
          logGroupName, 
          logStreamName,
          hasNextToken: !!nextToken
        });
        
        const logs = await cloudWatchLogsClient.send(new GetLogEventsCommand({
          logGroupName,
          logStreamName,
          startFromHead: true,
          nextToken
        }));

        const eventCount = logs.events?.length || 0;
        logger.debug(`Received ${eventCount} log events for build ${buildId}`);
        
        logs.events?.forEach(event => {
          if (event.message && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              type: 'log',
              message: event.message,
              timestamp: event.timestamp
            }));
          }
        });

        nextToken = logs.nextForwardToken;

        // Check build status
        logger.debug(`Checking build status for ${buildId}`);
        const updatedBuild = (await codebuild.batchGetBuilds({ ids: [buildId] }).promise()).builds?.[0];
        
        if (updatedBuild) {
          logger.debug(`Current build status: ${updatedBuild.buildStatus}`);
          
          if (['SUCCEEDED', 'FAILED', 'STOPPED', 'FAULT', 'TIMED_OUT'].includes(updatedBuild.buildStatus || '')) {
            logger.info(`Build ${buildId} completed with status: ${updatedBuild.buildStatus}`);
            
            // Send any available phase information
            if (updatedBuild.phases && updatedBuild.phases.length > 0) {
              logger.debug(`Build phases for ${buildId}`, { phases: updatedBuild.phases });
              
              // Find any failed phases
              const failedPhases = updatedBuild.phases.filter(phase => 
                phase.phaseStatus === 'FAILED' || phase.contextStatus
              );
              
              if (failedPhases.length > 0) {
                failedPhases.forEach(phase => {
                  ws.send(JSON.stringify({
                    type: 'error',
                    message: `Phase ${phase.phaseType} failed: ${phase.contextStatus || 'Unknown error'}`,
                    timestamp: Date.now()
                  }));
                  logger.error(`Build ${buildId} phase ${phase.phaseType} failed`, { 
                    phaseStatus: phase.phaseStatus,
                    contextStatus: phase.contextStatus
                  });
                });
              }
            }
            
            ws.send(JSON.stringify({
              type: 'info',
              message: `Build ${buildId} completed with status: ${updatedBuild.buildStatus}`,
              timestamp: Date.now()
            }));
            
            clearInterval(interval);
            logger.info(`Closing WebSocket connection for build ${buildId} in 5 seconds`);
            setTimeout(() => { 
              if (ws.readyState === ws.OPEN) {
                ws.close();
                logger.info(`WebSocket connection closed for build ${buildId}`);
              }
            }, 5000);
          }
        }
      } catch (err) {
        logger.error('Error fetching logs', err);
        ws.send(JSON.stringify({
          type: 'error',
          message: `Log fetch error: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now()
        }));
      }
    }, 3000);

    ws.on('close', () => {
      logger.info(`WebSocket connection closed by client for build ${buildId}`);
      clearInterval(interval);
    });

  } catch (error) {
    logger.error('Error setting up log stream', error);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Error setting up log stream: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      }));
      ws.close();
    }
  }
};

export async function triggerBuild(repository: Repository) {
  logger.info(`Triggering build for repository ${repository.id} (${repository.name})`, {
    repositoryUrl: repository.url
  });
  
  const projectName = `repo-${repository.id}`;
  
  try {
    // Check if project exists and create if it doesn't
    const exists = await projectExists(projectName);
    if (!exists) {
      logger.info(`Project ${projectName} does not exist. Creating...`);
      await createCodeBuildProject(repository, repository.config);
      logger.info(`Project ${projectName} created successfully`);
    }

    // Double-check project exists now
    const projectConfirmed = await projectExists(projectName);
    if (!projectConfirmed) {
      throw new Error(`Failed to confirm project ${projectName} exists after creation`);
    }

    // Validate webhook URL
    if (!process.env.APP_URL) {
      logger.error('APP_URL environment variable is not set');
      throw new Error('APP_URL environment variable is required');
    }
    
    const webhookUrl = `${process.env.APP_URL}/api/webhooks/deployment`;
    logger.debug(`Using webhook URL: ${webhookUrl}`);

    const buildspecOverride = generateBuildSpec(repository.config);

const startBuildParams: StartBuildCommandInput = {
  projectName,
  buildspecOverride,
  environmentVariablesOverride: [
    {
      name: 'WEBHOOK_URL',
      value: webhookUrl,
      type: 'PLAINTEXT'
    },
    {
      name: 'DEBUG',
      value: 'true',
      type: 'PLAINTEXT'
    },
    {
      name: 'BUILD_TIMESTAMP',
      value: new Date().toISOString(),
      type: 'PLAINTEXT'
    }
  ]
};


    logger.info(`Starting build for project ${projectName}`);
    logger.debug('StartBuildCommand parameters', startBuildParams);
    
    const command = new StartBuildCommand(startBuildParams);
    const response = await codeBuildClient.send(command);
    const buildId = response.build?.id;
    
    if (!buildId) {
      logger.error(`Failed to get buildId from response`, response);
      throw new Error('No buildId returned from AWS CodeBuild');
    }
    
    logger.info(`Build started successfully with ID: ${buildId}`);
    logger.debug('Build response', {
      buildId,
      status: response.build?.buildStatus,
      projectName: response.build?.projectName
    });

    // Update database
    logger.debug(`Updating repository config in database`, {
      configId: repository.config.id,
      buildId,
      buildStatus: 'BUILDING'
    });
    
    await prisma.repositoryConfig.update({
      where: { id: repository.config.id },
      data: {
        buildStatus: 'BUILDING',
        lastBuildId: buildId,
        lastBuildStartTime: new Date()
      }
    });
    logger.info(`Database updated with build information`);

    return { buildResponse: response, buildId };
  } catch (error) {
    logger.error('Error starting build', error);
    
    // Update database with failed status
    try {
      await prisma.repositoryConfig.update({
        where: { id: repository.config.id },
        data: {
          buildStatus: 'FAILED',
          lastBuildErrorMessage: error instanceof Error ? error.message : String(error)
        }
      });
      logger.info(`Database updated with build failure`);
    } catch (dbError) {
      logger.error('Error updating database with build failure', dbError);
    }
    
    throw error;
  }
}