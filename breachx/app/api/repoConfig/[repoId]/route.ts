import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { NextRequest } from "next/server";

// POST: Save repository configuration
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const repoId = req.nextUrl.pathname.split("/").pop(); // Extract repoId from URL

  if (!repoId) {
    return new Response(JSON.stringify({ error: "Repository ID is required" }), { status: 400 });
  }

  const body = await req.json();
  const {
    hasDocker,
    dockerConfig,
    rootDirectory,
    buildCommand,
    runCommand,
    installCommand,
    env,
  } = body;

  try {
    const repository = await prisma.repository.findFirst({
      where: {
        repoId,
        userId: session.user?.id || null,
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
          installCommand,
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
          installCommand,
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
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const repoIdParam = req.nextUrl.pathname.split("/").pop();

  if (!repoIdParam) {
    return new Response(JSON.stringify({ error: "Repository ID is required" }), { status: 400 });
  }

  try {
    const repository = await prisma.repository.findFirst({
      where: {
        repoId: repoIdParam,
      },
    });

    if (!repository) {
      return new Response(JSON.stringify({ error: "Repository not found" }), { status: 404 });
    }

    const repositoryConfig = await prisma.repositoryConfig.findUnique({
      where: {
        repositoryId: repository.id,
      },
      include: {
        repository: true,
      },
    });

    if (!repositoryConfig) {
      return new Response(JSON.stringify({ error: "RepositoryConfig not found" }), { status: 404 });
    }

    return new Response(JSON.stringify(repositoryConfig), { status: 200 });
  } catch (error) {
    console.error("Error fetching repository configuration:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
