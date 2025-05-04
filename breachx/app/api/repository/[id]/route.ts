/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request, { params }:any) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { id } = params;
  
  try {
    const repository = await prisma.repository.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });
    
    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }
    
    return NextResponse.json(repository);
  } catch (error) {
    console.error('Error fetching repository:', error);
    return NextResponse.json({ error: 'Failed to fetch repository' }, { status: 500 });
  }
}