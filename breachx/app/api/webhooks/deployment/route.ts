import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { repositoryId, url } = data;
    
    if (!repositoryId || !url) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }
    
    // Update repository with deployment URL
    await prisma.repositoryConfig.update({
      where: { repositoryId },
      data: {
        buildStatus: 'DEPLOYED',
        deploymentUrl: url
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Deployment URL updated' 
    });
  } catch (error) {
    console.error('Error updating deployment URL:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}