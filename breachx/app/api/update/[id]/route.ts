import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(req: NextRequest) {
  try {
    const repoId = req.nextUrl.pathname.split("/").pop(); // Extract repoId from URL

    const body = await req.json();
    const { webhookUrl } = body;

    if (!webhookUrl) {
      return NextResponse.json({ error: 'webhookUrl is required' }, { status: 400 });
    }

    // Update the webhookUrl in RepositoryConfig
    const updatedConfig = await prisma.repositoryConfig.update({
      where: { repositoryId:repoId },
      data: {
        deploymentUrl: webhookUrl,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, data: updatedConfig });
  } catch (error) {
    console.error('Error updating repository config:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
