/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { streamBuildLogs } from '@/lib/aws/codebuild';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const buildId = searchParams.get('buildId');

  if (!buildId) {
    return new Response(
      JSON.stringify({ error: 'No buildId provided' }),
      { status: 400 }
    );
  }

  // Create a new ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Create a WebSocket-like adapter for SSE
        const sseAdapter = {
          send: (data: string) => {
            const logData = typeof data === 'string' ? JSON.parse(data) : data;
            controller.enqueue(`data: ${JSON.stringify(logData)}\n\n`);
          },
          close: () => {
            controller.close();
          },
          readyState: 1,
          OPEN: 1,
          on: () => {} // Not needed for SSE
        };

        // Start streaming logs
        await streamBuildLogs(buildId, sseAdapter as any);
      } catch (error) {
        console.error('Error streaming logs:', error);
        controller.enqueue(`data: ${JSON.stringify({
          type: 'error',
          message: `Error streaming logs: ${error instanceof Error ? error.message : String(error)}`
        })}\n\n`);
        controller.close();
      }
    }
  });

  // Return the stream with appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
} 