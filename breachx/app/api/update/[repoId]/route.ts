/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const repoIdParam = req.nextUrl.pathname.split("/").pop();

    if (!repoIdParam) {
      return new Response(JSON.stringify({ error: "Repository ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 1: Find the repository using repoId
    const repository = await prisma.repository.findFirst({
      where: { repoId: repoIdParam },
    });

    if (!repository) {
      return new Response(JSON.stringify({ error: "Repository not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const repositoryId = repository.id;

    // Step 2: Try to fetch deploymentUrl via Prisma
    let deploymentUrl = null;

    try {
      const config = await prisma.repositoryConfig.findUnique({
        where: { repositoryId },
        select: { deploymentUrl: true },
      });

      if (config?.deploymentUrl) {
        deploymentUrl = config.deploymentUrl;
      }
    } catch (err) {
      console.warn("Prisma query failed, trying raw SQL...");
      console.log(err);
    }

    // Step 3: Fallback to raw SQL if needed
    if (!deploymentUrl) {
      try {
        const rawResults: any[] = await prisma.$queryRaw`
          SELECT c."deploymentUrl"
          FROM "RepositoryConfig" c
          WHERE c."repositoryId" = ${repositoryId}
          LIMIT 1;
        `;

        if (rawResults.length > 0 && rawResults[0].deploymentUrl) {
          deploymentUrl = rawResults[0].deploymentUrl;
        }
      } catch (rawErr) {
        console.error("Raw SQL fallback failed:", rawErr);
      }
    }

    // Step 4: Return the deploymentUrl (or null)
    return new Response(JSON.stringify({ deploymentUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unhandled error fetching deployment URL:", error);
    return new Response(JSON.stringify({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
