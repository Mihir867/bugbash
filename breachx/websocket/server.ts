// src/websocket/server.ts
import { streamBuildLogs } from '@/lib/aws/codebuild';
import { createServer } from 'http';
import { parse } from 'url';
import { WebSocketServer } from 'ws';

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Handle upgrade requests
server.on('upgrade', (request, socket, head) => {
  const { pathname } = parse(request.url || '');
  
  // Handle build log streaming endpoint
  if (pathname === '/api/ws/build-logs') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle WebSocket connections
wss.on('connection', (ws, request) => {
  const { query } = parse(request.url || '', true);
  const buildId = query.buildId as string;
  
  if (!buildId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'No buildId provided'
    }));
    ws.close();
    return;
  }
  
  // Start streaming logs for the build
  streamBuildLogs(buildId, ws);
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start the server
const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

export default server;