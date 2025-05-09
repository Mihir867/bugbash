// app/api/builds/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CodeBuildClient, BatchGetBuildsCommand } from '@aws-sdk/client-codebuild';

// Initialize AWS CodeBuild client
const codeBuildClient = new CodeBuildClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const buildId = url.pathname.split('/').at(-2); // Extract "id" from /builds/[id]/status

  if (!buildId) {
    return NextResponse.json({ error: 'Invalid build ID' }, { status: 400 });
  }

  try {
    const command = new BatchGetBuildsCommand({ ids: [buildId] });
    const response = await codeBuildClient.send(command);

    if (!response.builds || response.builds.length === 0) {
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }

    const build = response.builds[0];

    return NextResponse.json({
      id: build.id,
      buildNumber: build.buildNumber,
      status: build.buildStatus,
      startTime: build.startTime,
      endTime: build.endTime,
      currentPhase: build.currentPhase,
      logStreamName: build.logs?.cloudWatchLogs?.streamName,
      logGroupName: build.logs?.cloudWatchLogs?.groupName,
    });
  } catch (error) {
    console.error('Error getting build status:', error);
    return NextResponse.json({ error: 'Failed to get build status' }, { status: 500 });
  }
}

// Optional: block unsupported methods
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
