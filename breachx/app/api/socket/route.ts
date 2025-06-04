/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
// app/api/ws/route.ts
import { NextRequest } from 'next/server';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { streamBuildLogs } from '@/lib/aws/codebuild';

// Singleton to ensure we only have one Socket.IO server
let io: Server | null = null;

// Create a WebSocket adapter that translates Socket.io messages to our expected format
interface SocketAdapter {
  send: (data: string) => void;
  close: () => void;
  readyState: number;
  OPEN: number;
  on: (event: string, callback: Function) => void;
}

// Initialize Socket.IO
function getSocketIO() {
  if (io === null && typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    // Server-side only and only in production
    const httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });
    
    // Listen on a different port than your Next.js app
    const PORT = process.env.SOCKET_IO_PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`Socket.IO server running on port ${PORT}`);
    });
    
    // Set up Socket.io connection handler
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      // Listen for build log subscription requests
      socket.on('subscribe-to-build', (buildId: string) => {
        console.log(`Client ${socket.id} subscribing to build logs for: ${buildId}`);
        
        if (!buildId) {
          socket.emit('log', {
            type: 'error',
            message: 'No buildId provided'
          });
          return;
        }
        
        // Create a WebSocket adapter that translates to Socket.io
        const socketAdapter: SocketAdapter = {
          send: (data: string) => {
            if (socket.connected) {
              socket.emit('log', JSON.parse(data));
            }
          },
          close: () => {
            if (socket.connected) {
              socket.emit('log', { 
                type: 'info', 
                message: 'Log stream closed' 
              });
            }
          },
          readyState: socket.connected ? 1 : 0,  // OPEN or CLOSED
          OPEN: 1,
          on: (event: string, callback: Function) => {
            socket.on(event, callback as (...args: any[]) => void);
          }
        };
        
        // Start streaming logs
        try {
          streamBuildLogs(buildId, socketAdapter as any).catch((error) => {
            console.error('Error in streamBuildLogs:', error);
            if (socket.connected) {
              socket.emit('log', { 
                type: 'error', 
                message: `Error streaming logs: ${error instanceof Error ? error.message : String(error)}` 
              });
            }
          });
        } catch (error) {
          console.error('Error starting log stream:', error);
          if (socket.connected) {
            socket.emit('log', { 
              type: 'error', 
              message: `Error starting log stream: ${error instanceof Error ? error.message : String(error)}` 
            });
          }
        }
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });

      socket.on('error', (error) => {
        console.error(`Socket error for client ${socket.id}:`, error);
      });
    });
  }
  
  return io;
}

// Don't initialize Socket.IO when module is loaded
// getSocketIO();

// This route handler just returns the Socket.IO server port
export async function GET(request: NextRequest) {
  // Initialize Socket.IO only when the route is called
  getSocketIO();
  
  // Return information about the Socket.IO server
  return new Response(
    JSON.stringify({
      status: 'ok',
      socketUrl: `${process.env.NEXT_PUBLIC_SOCKET_IO_URL || `http://localhost:${process.env.SOCKET_IO_PORT || 3001}`}`
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}