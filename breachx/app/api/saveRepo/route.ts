import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get all repositories for the current user
    const repositories = await prisma.repository.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json(repositories);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const data = await request.json();
    const { repoId, name, description, url } = data;
    
    // Check if repository already exists
    const existingRepo = await prisma.repository.findUnique({
      where: {
        userId_repoId: {
          userId: session.user.id,
          repoId: repoId,
        },
      },
    });
    
    if (existingRepo) {
      return NextResponse.json({ message: 'Repository already saved' }, { status: 200 });
    }
    
    // Create new repository record
    const newRepo = await prisma.repository.create({
      data: {
        repoId,
        name,
        description,
        url,
        userId: session.user.id,
      },
    });
    
    return NextResponse.json(newRepo, { status: 201 });
  } catch (error) {
    console.error('Error saving repository:', error);
    return NextResponse.json({ error: 'Failed to save repository' }, { status: 500 });
  }
}