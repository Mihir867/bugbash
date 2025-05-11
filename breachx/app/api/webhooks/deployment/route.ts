import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { repositoryId, url, securityReportUrl, criticalVulns, highVulns } = data;
    
    if (!repositoryId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing repository ID' 
      }, { status: 400 });
    }
    
    // Prepare update data
    const updateData: Prisma.RepositoryConfigUpdateInput = {
      buildStatus: 'DEPLOYED',
    };

    // If deployment URL is provided
    if (url) {
      updateData.deploymentUrl = url;
    }

    // If security report URL is provided
    if (securityReportUrl) {
      updateData.securityReportUrl = securityReportUrl;
      updateData.lastScanTime = new Date();
      updateData.criticalVulns = criticalVulns || 0;
      updateData.highVulns = highVulns || 0;
      updateData.securityStatus = criticalVulns > 0 ? 'FAILED' : 'PASSED';
    }
    
    // Update repository with deployment URL and/or security info
    await prisma.repositoryConfig.update({
      where: { repositoryId },
      data: updateData
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Repository config updated successfully' 
    });
  } catch (error) {
    console.error('Error updating repository config:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}