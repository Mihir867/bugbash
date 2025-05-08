import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { triggerBuild } from '@/lib/aws/codebuild';

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {

    try {
        const repositoryId = params.id;
      

      
        // Fetch and log all repository configs
      
        // Try to find the specific repository
        const repository = await prisma.repositoryConfig.findUnique({
          where: { repositoryId },
        });
      
        // Log the result of the lookup
      
        if (!repository) {
          return NextResponse.json({ 
            success: false, 
            message: 'Repository not found' 
          }, { status: 404 });
        }
      
        // Trigger build
        const buildResponse = await triggerBuild(repositoryId);
      
        return NextResponse.json({ 
          success: true, 
          message: 'Build triggered successfully',
          buildId: buildResponse.build?.id 
        });
      } catch (error) {
        console.error('Error triggering build:', error);
        return NextResponse.json({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
      }
      
}