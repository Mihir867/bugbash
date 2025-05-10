import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { triggerBuild } from '@/lib/aws/codebuild';

const prisma = new PrismaClient();


export async function POST(request: NextRequest) {
  try {
    // 1. Extract repoId from the URL
    const segments = request.nextUrl.pathname.split('/');
    const repoId = segments[segments.length - 2]; // /api/repositories/[repoId]/build

    if (!repoId) {
      return NextResponse.json({
        success: false,
        message: 'Repository ID is required',
      }, { status: 400 });
    }

    // 2. Fetch repository using findFirst to avoid potential issues
    const repository = await prisma.repository.findFirst({
      where: { repoId },
      include: {
        user: true // Include user data
      }
    });


    if (!repository) {
      return NextResponse.json({
        success: false,
        message: 'Repository not found',
      }, { status: 404 });
    }

    // 3. Fetch repository config using raw query to avoid schema validation issues
    let repositoryConfig = null;
    try {
      const rawResults = await prisma.$queryRaw`
  SELECT 
    rc."id",
    rc."repositoryId",
    rc."hasDocker",
    rc."dockerConfig",
    rc."rootDirectory",
    rc."buildCommand",
    rc."installCommand",
    rc."runCommand",
    rc."environmentVariables",
    rc."buildStatus",
    rc."lastBuildId",
    rc."lastBuildStartTime",
    rc."deploymentUrl",
    rc."createdAt",
    rc."updatedAt",
    u."id" as "userId",
    u."name" as "userName",
    u."email" as "userEmail",
    u."githubUsername" as "userGithubUsername"
  FROM "RepositoryConfig" rc
  JOIN "Repository" r ON rc."repositoryId" = r."id"
  JOIN "User" u ON r."userId" = u."id"
  WHERE rc."repositoryId" = ${repository.id}
`;


      
      if (rawResults && Array.isArray(rawResults) && rawResults.length > 0) {
        repositoryConfig = rawResults[0];
      } else {
        // Create a default config object if none exists
        repositoryConfig = {
          id: null,
          repositoryId: repository.id,
          hasDocker: false,
          dockerConfig: null,
          rootDirectory: "/",
          buildCommand: "",
          installCommand: "",
          runCommand: "",
          environmentVariables: [],
          buildStatus: null,
          lastBuildId: null,
          lastBuildStartTime: null,
          deploymentUrl: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    } catch (sqlError) {
      console.error("Error fetching repository config:", sqlError);
      // Default config as fallback
      repositoryConfig = {
        repositoryId: repository.id,
        hasDocker: false,
        dockerConfig: null,
        rootDirectory: "/",
        buildCommand: "",
        installCommand: "",
        runCommand: "",
        environmentVariables: [],
        buildStatus: null
      };
    }

    // 4. Combine repository and config
    const repoWithConfig = {
      ...repository,
      config: repositoryConfig,
      user: {
        id: repositoryConfig.userId,
        name: repositoryConfig.userName,
        email: repositoryConfig.userEmail,
        githubUsername: repositoryConfig.userGithubUsername
      }
    };
    


    // 5. Pass full repository object to triggerBuild
    const buildResponse = await triggerBuild(repoWithConfig);

    return NextResponse.json({
      success: true,
      message: 'Build triggered successfully',
      buildId: buildResponse.buildId,
    });

  } catch (error) {
    console.error('Error while triggering build:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    }, { status: 500 });
  }
}