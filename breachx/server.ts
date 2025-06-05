// server.js (or server.ts)
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { streamBuildLogs } from './lib/aws/codebuild';
import fs from 'fs';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const wsPort = parseInt(process.env.SOCKET_IO_PORT || '3001', 10);

// Prepare Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Prepare the app
app.prepare().then(() => {
  let server;
  
  if (process.env.NODE_ENV === 'production') {
    // In production, use HTTPS
    const httpsOptions = {
      key: fs.readFileSync(path.join(process.cwd(), 'certificates', 'privkey.pem')),
      cert: fs.readFileSync(path.join(process.cwd(), 'certificates', 'fullchain.pem'))
    };
    server = createHttpsServer(httpsOptions, async (req, res) => {
      try {
        const parsedUrl = parse(req.url || '', true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  } else {
    // In development, use HTTP
    server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url || '', true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  }
  
  // Create WebSocket server with SSL in production
  const wssOptions = process.env.NODE_ENV === 'production' ? {
    port: wsPort,
    path: '/api/ws/build-logs',
    server: server,
    ssl: true
  } : {
    port: wsPort,
    path: '/api/ws/build-logs'
  };
  
  const wss = new WebSocketServer(wssOptions);
  
  wss.on('connection', (ws, req) => {
    const { query } = parse(req.url || '', true);
    const buildId = query.buildId as string;
    
    if (!buildId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No buildId provided'
      }));
      ws.close();
      return;
    }
    
    console.log(`WebSocket connection established for build ID: ${buildId}`);
    
    // Start streaming logs
    try {
      streamBuildLogs(buildId, ws);
    } catch (error) {
      console.error('Error streaming logs:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Error streaming logs: ${error instanceof Error ? error.message : String(error)}`
      }));
      ws.close();
    }
    
    // Set up ping/pong for keeping connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }, 30000);
    
    ws.on('close', () => {
      console.log(`WebSocket connection closed for build ID: ${buildId}`);
      clearInterval(pingInterval);
    });
    
    ws.on('error', (err) => {
      console.error(`WebSocket error for build ID: ${buildId}:`, err);
    });
  });
  
  // Start the server
  server.listen(port, () => {
    console.log(`> Ready on ${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${hostname}:${port}`);
    console.log(`> WebSocket server running on ${process.env.NODE_ENV === 'production' ? 'wss' : 'ws'}://${hostname}:${wsPort}/api/ws/build-logs`);
  });
});