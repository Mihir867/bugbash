/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fix: Use the correct type definition for the handler function
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    console.log('[PATCH] Incoming request to update repository config');

    const id = context.params.id;
    console.log('Repository ID from params:', id);

    const body = await req.json();
    console.log('Request body:', body);

    const { webhookUrl } = body;

    if (!webhookUrl) {
      console.warn('webhookUrl missing in body');
      return NextResponse.json({ error: 'webhookUrl is required' }, { status: 400 });
    }

    console.log(`Updating repositoryConfig with ID ${id} and webhookUrl ${webhookUrl}`);

    let updatedConfig;
    
    try {
      // First try using the Prisma ORM approach
      updatedConfig = await prisma.repositoryConfig.update({
        where: { id },
        data: {
          deploymentUrl: webhookUrl,
          updatedAt: new Date()
        }
      });
      
      console.log('Successfully updated repository config:', updatedConfig);
    } catch (prismaError) {
      console.error('Prisma update failed, trying raw SQL:', prismaError);
      
      // If Prisma fails, fall back to raw SQL
      try {
        // Use raw SQL query as fallback
        const result = await prisma.$queryRaw`
          UPDATE "RepositoryConfig"
          SET "deploymentUrl" = ${webhookUrl}, "updatedAt" = now()
          WHERE "id" = ${id}
          RETURNING *;
        `;
        
        // Cast the result to an array and get the first item
        updatedConfig = Array.isArray(result) && result.length > 0 
          ? result[0] 
          : null;
        
        if (!updatedConfig) {
          console.warn(`No repositoryConfig found for ID: ${id}`);
          return NextResponse.json({ 
            success: false, 
            error: 'Repository configuration not found' 
          }, { status: 404 });
        }
        
        console.log('Successfully updated repository config using raw SQL:', updatedConfig);
      } catch (sqlError) {
        console.error('Raw SQL update also failed:', sqlError);
        throw sqlError; // Re-throw to be caught by outer try/catch
      }
    }

    return NextResponse.json({ success: true, data: updatedConfig });

  } catch (error: any) {
    console.error('Error updating repository config:', error);

    // Prisma-specific error log
    if (error.code === 'P2025') {
      console.warn(`No repositoryConfig found for ID: ${context.params.id}`);
    }

    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}