// app/api/repoConfig/[repoId]/route.ts

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { NextRequest } from "next/server";

// POST: Save repository configuration
export async function POST(req: NextRequest, { params }: { params: { repoId: string } }) {
    const session = await getServerSession(authOptions);
  
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  
    const repoId = params.id;
    const body = await req.json();
  
    const {
      hasDocker,
      dockerConfig,
      rootDirectory,
      buildCommand,
      runCommand,
      env,
    } = body;

    console.log(hasDocker, dockerConfig, rootDirectory, buildCommand, runCommand, env, "lessg");
  
    try {
      const repository = await prisma.repository.findFirst({
        where: {
          repoId,
          userId: session.user.id,
        },
      });
  
      if (!repository) {
        return new Response(JSON.stringify({ error: "Repository not found" }), { status: 404 });
      }
  
      const existingConfig = await prisma.repositoryConfig.findUnique({
        where: {
          repositoryId: repository.id,
        },
      });
  
      let updatedRepo;
  
      if (existingConfig) {
        updatedRepo = await prisma.repositoryConfig.update({
          where: {
            repositoryId: repository.id,
          },
          data: {
            hasDocker,
            dockerConfig,
            rootDirectory,
            buildCommand,
            runCommand,
            environmentVariables: env,
          },
        });
      } else {
        updatedRepo = await prisma.repositoryConfig.create({
          data: {
            repository: {
              connect: {
                id: repository.id,
              },
            },
            hasDocker,
            dockerConfig,
            rootDirectory,
            buildCommand,
            runCommand,
            environmentVariables: env,
          },
        });
      }
  
      return new Response(JSON.stringify(updatedRepo), { status: 200 });
    } catch (error) {
      console.error("Error saving repository configuration:", error);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
  }
  

// GET: Fetch repository configuration
export async function GET(req: NextRequest, { params }: { params: { repoId: string } }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const repoId = params.id;

  if (!repoId) {
    return new Response(JSON.stringify({ error: "Repository ID is required" }), { status: 400 });
  }

  try {
    const repository = await prisma.repository.findFirst({
      where: {
        repoId: repoId,
        userId: session.user.id,
      },
      include: {
        config: true,
      },
    });

    if (!repository) {
      return new Response(JSON.stringify({ error: "Repository not found" }), { status: 404 });
    }

    return new Response(JSON.stringify(repository), { status: 200 });
  } catch (error) {
    console.error("Error fetching repository configuration:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
