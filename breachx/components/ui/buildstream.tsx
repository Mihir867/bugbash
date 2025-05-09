// src/components/BuildLogStream.tsx
import React, { useEffect, useRef, useState } from 'react';

interface LogMessage {
  type: 'log' | 'info' | 'error';
  message: string;
  timestamp?: number;
}

interface BuildLogStreamProps {
  buildId: string;
  maxHeight?: string;
  autoScroll?: boolean;
}

const BuildLogStream: React.FC<BuildLogStreamProps> = ({ 
  buildId, 
  maxHeight = '400px',
  autoScroll = true
}) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    if (!buildId) {
      setLogs([{ type: 'info', message: 'No build ID available. Trigger a build to see logs.' }]);
      return;
    }
    
    // Clear logs when build ID changes
    setLogs([]);
    setError(null);
    
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/build-logs?buildId=${buildId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    // Add info message
    setLogs([{ type: 'info', message: 'Connecting to log stream...' }]);
    
    ws.onopen = () => {
      setConnected(true);
      setLogs(prev => [...prev, { type: 'info', message: 'Connected to log stream' }]);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LogMessage;
        setLogs(prev => [...prev, data]);
        
        // Auto-scroll to bottom
        if (autoScroll && logContainerRef.current) {
          setTimeout(() => {
            if (logContainerRef.current) {
              logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
            }
          }, 0);
        }
      } catch (err) {
        console.error('Error parsing log message:', err);
      }
    };
    
    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('Error connecting to log stream');
      setConnected(false);
    };
    
    ws.onclose = () => {
      setConnected(false);
      setLogs(prev => [...prev, { type: 'info', message: 'Disconnected from log stream' }]);
    };
    
    // Clean up on unmount
    return () => {
      ws.close();
    };
  }, [buildId, autoScroll]);
  
  return (
    <div className="build-log-container">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-muted-foreground">
          {connected ? (
            <span className="flex items-center">
              <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
              Connected to logs
            </span>
          ) : (
            <span className="flex items-center">
              <span className="h-2 w-2 bg-red-500 rounded-full mr-2"></span>
              Disconnected
            </span>
          )}
        </div>
        
        {logs.length > 0 && (
          <button 
            onClick={() => {
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
              }
            }}
            className="text-xs text-primary hover:underline"
          >
            Scroll to Bottom
          </button>
        )}
      </div>
      
      {error && (
        <div className="mb-2 p-2 bg-red-900/20 text-red-400 rounded text-sm">
          {error}
        </div>
      )}
      
      <div 
        ref={logContainerRef}
        className="font-mono text-sm bg-black/50 rounded-md p-4"
        style={{ 
          height: maxHeight,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {logs.map((log, index) => (
          <div 
            key={index} 
            className={
              log.type === 'error' ? 'text-red-400 mb-1' : 
              log.type === 'info' ? 'text-blue-400 mb-1' : 
              'text-green-400 mb-1'
            }
          >
            {log.timestamp && (
              <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            )}
            {' '}{log.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BuildLogStream;