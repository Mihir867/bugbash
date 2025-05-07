import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createCodeBuildProject } from '@/lib/aws/codebuild';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
      const data = await request.json();
      
      // Create repository in database
      const repository = await prisma.repository.create({
        data: {
          repoId: data.repoId,
          name: data.name,
          description: data.description,
          url: data.url,
          userId: data.userId,
          config: {
            create: {
              hasDocker: data.config.hasDocker || false,
              dockerConfig: data.config.dockerConfig,
              rootDirectory: data.config.rootDirectory,
              buildCommand: data.config.buildCommand,
              runCommand: data.config.runCommand,
              environmentVariables: data.config.environmentVariables || '[]',
              buildStatus: 'PENDING'
            }
          }
        },
        include: {
          config: true
        }
      });
  
      // Create CodeBuild project
      await createCodeBuildProject(repository, repository.config!);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Repository created and build project initialized',
        repository 
      });
    } catch (error) {
      console.error('Error creating repository:', error);
      return NextResponse.json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 500 });
    }
  }