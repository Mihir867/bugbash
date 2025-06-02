import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import { NextRequest } from "next/server";
import cuid from "cuid"; // Import cuid directly

// POST: Save repository configuration
export async function POST(req: NextRequest) {
  
  try {
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
    
    // Find the associated repository record
    const repository = await prisma.repository.findFirst({
      where: {
        repoId,
        userId: session.user?.id || null,
      },
    });
    
    if (!repository) {
      return new Response(JSON.stringify({ error: "Repository not found" }), { status: 404 });
    }
    
    
    // Check for existing config - using a try/catch to handle schema issues
    let existingConfig = null;
    try {
      // First try to find with findUnique
      existingConfig = await prisma.repositoryConfig.findUnique({
        where: {
          repositoryId: repository.id,
        },
      });
    } catch (findError) {
      console.log("Error finding repository config, trying findFirst instead:", findError);
      // If findUnique fails due to schema issues, try findFirst as a fallback
      try {
        existingConfig = await prisma.repositoryConfig.findFirst({
          where: {
            repositoryId: repository.id,
          },
        });
      } catch (fallbackError) {
        console.log("Fallback findFirst also failed:", fallbackError);
      }
    }
    
    
    let updatedRepo;
    
    // Update or create the repository configuration
    try {
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
        // Prepare data object with all possible fields to match schema
        const configData = {
          hasDocker: hasDocker || false,
          dockerConfig: dockerConfig || null,
          rootDirectory: rootDirectory || "/",
          buildCommand: buildCommand || "",
          installCommand: installCommand || "",
          runCommand: runCommand || "",
          environmentVariables: env || [],
          buildStatus: null,
          lastBuildId: null,
          lastBuildStartTime: null,
          deploymentUrl: null
        };
        
        try {
          // Direct approach with repositoryId
          updatedRepo = await prisma.repositoryConfig.create({
            data: {
              repositoryId: repository.id,
              ...configData
            },
          });
        } catch (createError) {
          console.error("Failed to create repository config:", createError);
          
          // If there's still an error, try a raw database operation as last resort
          try {
            // Create without any relations
            updatedRepo = await prisma.$queryRaw`
              INSERT INTO "RepositoryConfig" (
                "id", "repositoryId", "hasDocker", "dockerConfig", 
                "rootDirectory", "buildCommand", "installCommand", "runCommand", 
                "environmentVariables", "createdAt", "updatedAt"
              ) 
              VALUES (
                ${cuid()}, ${repository.id}, ${hasDocker}, ${dockerConfig},
                ${rootDirectory}, ${buildCommand}, ${installCommand}, ${runCommand},
                ${JSON.stringify(env || [])}::jsonb, now(), now()
              )
              RETURNING *;
            `;
          } catch (rawError) {
            console.error("Even direct insertion failed:", rawError);
            throw rawError;
          }
        }
      }
    } catch (updateError) {
      throw updateError; // Re-throw to be caught by outer try/catch
    }
    
    return new Response(JSON.stringify(updatedRepo), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error saving repository configuration:", error);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      details: error instanceof Error ? error.message : "Unknown error"
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// GET: Fetch repository configuration
export async function GET(req: NextRequest) {
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    
    
    const repoIdParam = req.nextUrl.pathname.split("/").pop();
    
    if (!repoIdParam) {
      return new Response(JSON.stringify({ error: "Repository ID is required" }), { status: 400 });
    }
    
    // Find the associated repository record
    const repository = await prisma.repository.findFirst({
      where: {
        repoId: repoIdParam,
      },
    });
    
    if (!repository) {
      return new Response(JSON.stringify({ error: "Repository not found" }), { status: 404 });
    }
    
    
    // Get the repository configuration with direct SQL to avoid prisma client issues
    let repositoryConfig = null;
    
    try {
      // Use a raw query to bypass Prisma client validation issues
      const rawResults = await prisma.$queryRaw`
        SELECT 
          r."id" as "repositoryId",
          c."id",
          c."hasDocker",
          c."dockerConfig",
          c."rootDirectory",
          c."buildCommand",
          c."installCommand",
          c."runCommand",
          c."environmentVariables",
          c."buildStatus",
          c."lastBuildId",
          c."lastBuildStartTime",
          c."deploymentUrl",
          c."createdAt",
          c."updatedAt",
          r."name" as "repositoryName",
          r."repoId",
          r."userId",
          r."url" as "repositoryUrl"
        FROM "Repository" r
        LEFT JOIN "RepositoryConfig" c ON r."id" = c."repositoryId"
        WHERE r."id" = ${repository.id}
      `;
      
      
      if (rawResults && Array.isArray(rawResults) && rawResults.length > 0) {
        repositoryConfig = rawResults[0];
        
        // Format the response to include repository details
        repositoryConfig.repository = {
          id: repository.id,
          name: repositoryConfig.repositoryName,
          repoId: repositoryConfig.repoId,
          projectId: repositoryConfig.projectId,
          userId: repositoryConfig.userId,
          url: repositoryConfig.repositoryUrl
        };
        
        // Remove duplicate fields
        delete repositoryConfig.repositoryName;
        delete repositoryConfig.repoId;
        delete repositoryConfig.projectId;
        delete repositoryConfig.userId;
        delete repositoryConfig.repositoryUrl;
      }
    } catch (sqlError) {
      console.error("Error executing raw SQL query:", sqlError);
    }
    
    if (!repositoryConfig || !repositoryConfig.id) {
      
      // Return empty config instead of 404 to prevent client errors
      return new Response(JSON.stringify({ 
        repositoryId: repository.id,
        hasDocker: false,
        dockerConfig: null,
        rootDirectory: "/",
        buildCommand: "",
        installCommand: "",
        runCommand: "",
        environmentVariables: [],
        repository: repository
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify(repositoryConfig), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error fetching repository configuration:", error);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      details: error instanceof Error ? error.message : "Unknown error"
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}