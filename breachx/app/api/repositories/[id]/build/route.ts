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

    // 2. Fetch repository + config in one query using `include`
    const repository = await prisma.repository.findFirst({
      where: { repoId },
      include: { config: true },
    });

    if (!repository || !repository.config) {
      return NextResponse.json({
        success: false,
        message: 'Repository or config not found',
      }, { status: 404 });
    }

    // 3. Pass full repository object to triggerBuild
    const buildResponse = await triggerBuild(repository);

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
    }, { status: 500 });
  }
}
