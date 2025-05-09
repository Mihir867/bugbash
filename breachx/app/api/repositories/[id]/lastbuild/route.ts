// app/api/repositories/[repoId]/lastBuild/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
    const url = new URL(req.url);

    const repoId = url.pathname.split('/').at(-2); // Extract "id" from /builds/[id]/status

  if (!repoId) {
    return NextResponse.json({ error: 'Invalid repository ID' }, { status: 400 });
  }

  try {
    const repoConfig = await prisma.repositoryConfig.findFirst({
      where: {
        repositoryId: repoId,
      },
      select: {
        lastBuildId: true,
        buildStatus: true,
        lastBuildStartTime: true,
      },
    });

    if (!repoConfig || !repoConfig.lastBuildId) {
      return NextResponse.json({ error: 'No builds found for this repository' }, { status: 404 });
    }

    return NextResponse.json({
      lastBuildId: repoConfig.lastBuildId,
      buildStatus: repoConfig.buildStatus,
      lastBuildStartTime: repoConfig.lastBuildStartTime,
    });
  } catch (error) {
    console.error('Error getting last build ID:', error);
    return NextResponse.json({ error: 'Failed to get last build ID' }, { status: 500 });
  }
}

// Optional: handle unsupported methods
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
