import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { triggerBuild } from '@/lib/aws/codebuild';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Extract repository ID from the URL
    const repositoryId = request.nextUrl.pathname.split('/').pop();

    if (!repositoryId) {
      return NextResponse.json({
        success: false,
        message: 'Repository ID is required',
      }, { status: 400 });
    }

    // Find the specific repository config
    const repository = await prisma.repositoryConfig.findUnique({
      where: { repositoryId },
    });

    if (!repository) {
      return NextResponse.json({
        success: false,
        message: 'Repository not found',
      }, { status: 404 });
    }

    // Trigger build
    const buildResponse = await triggerBuild(repositoryId);

    return NextResponse.json({
      success: true,
      message: 'Build triggered successfully',
      buildId: buildResponse.build?.id,
    });

  } catch (error) {
    console.error('Error triggering build:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
