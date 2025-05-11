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
import * as yaml from 'js-yaml';

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

function getDirectNgrokCheck() {
  return `
    # Additional check for ngrok URL by directly inspecting file system
    echo "Trying alternative methods to get ngrok URL..."
    ps aux | grep ngrok
    
    # Try to get URL directly from ngrok API
    echo "Getting URL from ngrok API..."
    curl -s http://localhost:4040/api/tunnels | jq .
    
    # Check if ngrok is running
    pgrep -l ngrok || echo "ngrok process not found"
    
    # If all else fails, install ngrok-inspect tool to get URL
    npm install -g ngrok-inspect || true
    ngrok-inspect list 2>/dev/null || echo "ngrok-inspect failed"
    
    # Export URL as environment variable so it's available everywhere
    export NGROK_PUBLIC_URL=$NGROK_URL
    echo "Final NGROK_URL: $NGROK_URL"
  `;
}

function generateBuildSpec(config: RepositoryConfig): string {
  const buildSpec = {
    version: '0.2',
    phases: {
      install: {
        'runtime-versions': { nodejs: '20' },
        commands: config.installCommand?.trim() 
          ? [config.installCommand.trim()] 
          : ['npm install'],
      },
      build: {
        commands: config.buildCommand?.trim() 
          ? [config.buildCommand.trim()] 
          : ['echo "No build command specified"'],
      },
      post_build: {
        commands: [
          'npm install -g ngrok wait-port',
          'echo "Starting Next.js application"',
          'npm start > app.log 2>&1 &',
          'echo $! > app.pid',
          'wait-port -t 60000 localhost:3000',
          'curl -v http://localhost:3000/',
          
          'ngrok config add-authtoken $NGROK_AUTH_TOKEN',
          'echo "Starting ngrok..."',
          'nohup ngrok http 3000 --log=stdout --log-level=debug > ngrok.log 2>&1 &',
          
          'echo "Waiting for ngrok tunnel..."',
          'sleep 5', // Give ngrok time to initialize
          'for i in $(seq 1 15); do curl -s http://127.0.0.1:4040/api/tunnels > tunnels.json; NGROK_URL=$(jq -r \'.tunnels[].public_url\' tunnels.json | grep -E \'^https://\' | head -1); if [ ! -z "$NGROK_URL" ]; then echo "Ngrok URL found: $NGROK_URL"; break; fi; echo "Waiting for ngrok tunnel to be ready..."; sleep 2; done',
          
          'NGROK_URL=$(jq -r \'.tunnels[].public_url\' tunnels.json | grep -E \'^https://\' | head -1 || echo "")',
          'echo "NGROK_PUBLIC_URL=${NGROK_URL}"',
          'if [ -z "${NGROK_URL}" ]; then echo "Failed to get ngrok URL" && cat ngrok.log && exit 1; else echo "Verifying ngrok tunnel..." && curl -v "${NGROK_URL}" && echo "Ngrok tunnel verified and accessible" || (echo "Ngrok tunnel not accessible" && cat ngrok.log && exit 1); fi',
          'mkdir -p security-reports',
          'sleep 300'
        ]
      }
    },
    artifacts: {
      'base-directory': '.',
      files: [
        'security-reports/**/*',
        'app.log',
        'ngrok.log'
      ]
    }
  };

  return yaml.dump(buildSpec, { lineWidth: -1 });
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
    
    // Extract repository ID from project name (format: repo-{id})
    const repositoryId = projectName?.replace('repo-', '');
    
    logger.debug(`Build info for ${buildId}`, { 
      projectName, 
      repositoryId,
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
    if (ws.readyState !== WebSocket.OPEN) {
      logger.error(`WebSocket connection is not open for build ${buildId}`, { readyState: ws.readyState });
      return;
    }

    ws.send(JSON.stringify({
      type: 'info',
      message: `Starting log stream for build ${buildId} of project ${projectName}`,
      timestamp: Date.now()
    }));

    let nextToken: string | undefined;
    let ngrokUrlCaptured = false;
    let ngrokUrl: string | undefined;

    const interval = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) {
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
        
        // Process log events
        logs.events?.forEach(event => {
          if (event.message && ws.readyState === ws.OPEN) {
            // Extract ngrok URL if found in logs
            if (!ngrokUrlCaptured && event.message.includes('tunnels') && event.message.includes('public_url')) {
              try {
                // Check for JSON output that might contain the ngrok URL
                const jsonMatch = event.message.match(/\{.*\}/);
                if (jsonMatch) {
                  const tunnelData = JSON.parse(jsonMatch[0]);
                  if (tunnelData.tunnels && tunnelData.tunnels.length > 0) {
                    ngrokUrl = tunnelData.tunnels[0].public_url;
                    ngrokUrlCaptured = true;
                    logger.info(`Extracted ngrok URL from logs: ${ngrokUrl}`);
                    
                    ws.send(JSON.stringify({
                      type: 'info',
                      message: `Deployed application available at: ${ngrokUrl}`,
                      timestamp: Date.now()
                    }));
                  }
                }
              } catch (err) {
                logger.error('Error parsing ngrok URL from logs', err);
              }
            }
            
            // Send log message to WebSocket
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
          
          // Handle build completion
          if (['SUCCEEDED', 'FAILED', 'STOPPED', 'FAULT', 'TIMED_OUT'].includes(updatedBuild.buildStatus || '')) {
            logger.info(`Build ${buildId} completed with status: ${updatedBuild.buildStatus}`);
            
            // Send any available phase information
            if (updatedBuild.phases && updatedBuild.phases.length > 0) {
              logger.debug(`Build phases for ${buildId}`, { phases: updatedBuild.phases });
              
              // Find any failed phases
              const failedPhases = updatedBuild.phases.filter(phase => 
                phase.phaseStatus === 'FAILED'
              );
              
              if (failedPhases.length > 0) {
                failedPhases.forEach((phase:any) => {
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
            
            // Update repository config if build succeeded
            if (updatedBuild.buildStatus === 'SUCCEEDED' && repositoryId) {
              try {
                // Try to extract ngrok URL from logs if not already captured
                if (!ngrokUrlCaptured) {
                  logger.info(`Attempting to extract ngrok URL from build environment`);
                  
                  // Make a final attempt to capture the ngrok URL
                  // This is a fallback for builds where the URL was generated but not parsed from logs
                  try {
                    // Wait for ngrok to be fully initialized
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Send completion status
                    ws.send(JSON.stringify({
                      type: 'info',
                      message: `Build ${buildId} completed with status: ${updatedBuild.buildStatus}`,
                      timestamp: Date.now()
                    }));
                    
                    // Update repository with success status
                    await updateRepositoryConfig(
                      repositoryId,
                      'DEPLOYED',
                      ngrokUrl || 'URL not available',
                      // Set TTL for the ngrok URL (20+ minutes)
                      new Date(Date.now() + 30 * 60 * 1000)
                    );
                    
                    logger.info(`Updated repository config with deployment information for repo: ${repositoryId}`);
                    
                    ws.send(JSON.stringify({
                      type: 'success',
                      message: `Deployment completed successfully. Application available at: ${ngrokUrl || 'URL not available'}`,
                      timestamp: Date.now()
                    }));
                  } catch (innerErr) {
                    logger.error(`Failed to extract ngrok URL`, innerErr);
                  }
                } else {
                  // We already have the ngrok URL, so update the repository config
                  await updateRepositoryConfig(
                    repositoryId,
                    'DEPLOYED',
                    ngrokUrl || 'URL not available',
                    // Set TTL for the ngrok URL (15 minutes)
                    new Date(Date.now() + 15 * 60 * 1000)
                  );
                  
                  logger.info(`Updated repository config with deployment information for repo: ${repositoryId}`);
                  
                  ws.send(JSON.stringify({
                    type: 'success',
                    message: `Deployment completed successfully. Application available at: ${ngrokUrl || 'URL not available'}`,
                    timestamp: Date.now()
                  }));
                }
              } catch (err) {
                logger.error(`Failed to update repository config after successful build`, err);
                ws.send(JSON.stringify({
                  type: 'error',
                  message: `Failed to update repository config: ${err instanceof Error ? err.message : String(err)}`,
                  timestamp: Date.now()
                }));
              }
            } else if (updatedBuild.buildStatus !== 'SUCCEEDED' && repositoryId) {
              // Update repository with failure status
              try {
                await updateRepositoryConfig(
                  repositoryId,
                  'FAILED',
                  undefined,
                  undefined,
                  `Build failed with status: ${updatedBuild.buildStatus}`
                );
                logger.info(`Updated repository config with failure status for repo: ${repositoryId}`);
              } catch (err) {
                logger.error(`Failed to update repository config after failed build`, err);
              }
            }
            
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

// Helper function to update repository config
async function updateRepositoryConfig(
  repositoryId: string, 
  buildStatus: string, 
  publicUrl?: string, 
  urlExpiryTime?: Date,
  errorMessage?: string
) {
  logger.info(`Updating repository config for repo ${repositoryId}`, { 
    buildStatus, 
    publicUrl, 
    urlExpiryTime,
    hasError: !!errorMessage
  });
  
  try {
    // Fetch the repository to get its config ID
    const repository = await prisma.repository.findUnique({
      where: { id: String(repositoryId) },
      include: { config: true }
    });
    
    let finalRepository = repository;
    
    if (!repository) {
      try {
        const result = await prisma.$queryRaw`
          SELECT r.*, rc.id as "configId"
          FROM "Repository" r
          LEFT JOIN "RepositoryConfig" rc ON rc."repositoryId" = r.id
          WHERE r."repoId" = ${repositoryId}
          LIMIT 1;
        `;
        
        if (Array.isArray(result) && result.length > 0) {
          finalRepository = result[0];
          
          // Get the config separately since the raw query only gives us the configId
          
        }
      } catch (sqlError) {
        console.error('Raw SQL repository lookup by repoId also failed:', sqlError);
      }
    }
    
    if (!finalRepository || !finalRepository.config) {
      throw new Error(`Repository ${repositoryId} or its config not found`);
    }
    
    // Update via Prisma
    const updateData: any = { buildStatus };
    
    if (publicUrl) {
      updateData.publicUrl = publicUrl;
    }
    
    if (urlExpiryTime) {
      updateData.urlExpiryTime = urlExpiryTime;
    }
    
    if (errorMessage) {
      updateData.lastBuildErrorMessage = errorMessage;
    }
    
    // Use the repository's config ID for the update
    await prisma.repositoryConfig.update({
      where: { id: finalRepository.config.id },
      data: updateData
    });
    
    logger.info(`Successfully updated repository config for repo ${repositoryId}`);
    
    // Also update the /api/update endpoint to ensure both locations have the latest info
    if (publicUrl) {
      try {
        const apiUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/update/${repositoryId}`;
        
        await fetch(apiUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            publicUrl,
            urlExpiryTime,
            buildStatus
          })
        });
        
        logger.info(`Successfully sent update to API endpoint for repo ${repositoryId}`);
      } catch (apiError) {
        logger.error(`Failed to update API endpoint for repo ${repositoryId}`, apiError);
        // Don't throw here, we already updated the database
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Error updating repository config for repo ${repositoryId}`, error);
    
    // Fallback to raw SQL if needed
    try {
      let sqlQuery = `
        UPDATE "RepositoryConfig" 
        SET "buildStatus" = '${buildStatus}',
            "updatedAt" = NOW()
      `;
      
      const params = [repositoryId];
      
      sqlQuery += ` WHERE "id" = ?`;
      
      await prisma.$executeRawUnsafe(sqlQuery, ...params);
      logger.info(`Successfully updated repository config with raw SQL for repo ${repositoryId}`);
      return true;
    } catch (sqlError) {
      logger.error(`SQL fallback also failed for repo ${repositoryId}`, sqlError);
      throw error; // Re-throw the original error
    }
  }
}

export async function triggerBuild(repository: any) {
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
      logger.debug('APP_URL environment variable is not set');
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
    },
    {
      name: 'SECURITY_REPORTS_BUCKET',
      value: process.env.SECURITY_REPORTS_BUCKET || 'your-security-reports-bucket',
      type: 'PLAINTEXT'
    },
    {
      name: 'REPOSITORY_ID',
      value: repository.id,
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
    
    try {
      await prisma.repositoryConfig.update({
        where: { id: repository.config.id },
        data: {
          buildStatus: 'BUILDING',
          // language: 'nodejs', ← this is what causes the error
        },
      });
    } catch (error) {
      console.warn('Prisma update failed, falling back to raw SQL:', error);
    
      // Fallback using raw SQL — exclude non-existent fields like `language`
      await prisma.$executeRaw`
        UPDATE "RepositoryConfig"
        SET "buildStatus" = 'BUILDING',
            "updatedAt" = NOW()
        WHERE "id" = ${repository.config.id}
      `;
    }
    
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
        } as any
      });
      logger.info(`Database updated with build failure`);
    } catch (dbError) {
      logger.error('Error updating database with build failure', dbError);
    }
    
    throw error;
  }
}