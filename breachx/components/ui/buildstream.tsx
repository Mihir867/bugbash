/* eslint-disable react-hooks/exhaustive-deps */
// src/components/BuildLogStream.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface LogMessage {
  type: 'log' | 'info' | 'error';
  message: string;
  timestamp?: number;
}

interface BuildLogStreamProps {
  buildId: string;
  maxHeight?: string;
  autoScroll?: boolean;
  maxReconnectAttempts?: number;
}

const BuildLogStream: React.FC<BuildLogStreamProps> = ({ 
  buildId, 
  maxHeight = '400px',
  autoScroll = true,
  maxReconnectAttempts = 5
}) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to scroll to bottom of logs
  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current && autoScroll) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [autoScroll]);
  
  // Function to initialize Socket.io
  const initializeSocket = useCallback(async () => {
    try {
      // Get Socket.io server URL
      const response = await fetch('/api/socket');
      const { socketUrl } = await response.json();
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      if (!buildId) {
        setLogs([{ type: 'info', message: 'No build ID available. Trigger a build to see logs.' }]);
        return;
      }
      
      // Add connecting message
      setLogs(prev => [...prev, { type: 'info', message: `Connecting to log stream (attempt ${reconnectAttempt + 1})...` }]);
      
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false, // We'll handle reconnection manually
        timeout: 10000
      });
      
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('Socket.io connected');
        setConnected(true);
        setError(null);
        setLogs(prev => [...prev, { type: 'info', message: 'Connected to log stream' }]);
        setReconnectAttempt(0); // Reset reconnect attempts on successful connection
        
        // Subscribe to build logs
        socket.emit('subscribe-to-build', buildId);
      });
      
      socket.on('log', (data: LogMessage) => {
        setLogs(prev => [...prev, data]);
        scrollToBottom();
      });
      
      socket.on('connect_error', (err) => {
        console.error('Socket.io connection error:', err);
        setError(`Connection error: ${err.message}`);
        handleReconnect();
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`Socket.io disconnected: ${reason}`);
        setConnected(false);
        setLogs(prev => [...prev, { 
          type: 'info', 
          message: `Disconnected from log stream: ${reason}` 
        }]);
        
        if (reason !== 'io client disconnect') {
          handleReconnect();
        }
      });

      socket.on('error', (err) => {
        console.error('Socket.io error:', err);
        setError(`Socket error: ${err.message}`);
        handleReconnect();
      });
    } catch (error) {
      console.error('Error initializing socket:', error);
      setError(`Failed to initialize socket: ${error instanceof Error ? error.message : String(error)}`);
      handleReconnect();
    }
  }, [buildId, reconnectAttempt, scrollToBottom]);
  
  // Handle reconnection logic
  const handleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (reconnectAttempt < maxReconnectAttempts) {
      const nextAttempt = reconnectAttempt + 1;
      const delay = Math.min(1000 * Math.pow(2, nextAttempt), 30000); // Exponential backoff with 30s max
      
      setLogs(prev => [...prev, { 
        type: 'info', 
        message: `Reconnecting in ${delay/1000} seconds...` 
      }]);
      
      setReconnectAttempt(nextAttempt);
      reconnectTimeoutRef.current = setTimeout(() => initializeSocket(), delay);
    } else {
      setError(`Failed to connect after ${maxReconnectAttempts} attempts. Please refresh or try again later.`);
    }
  }, [reconnectAttempt, maxReconnectAttempts, initializeSocket]);
  
  // Initialize Socket.io when buildId changes
  useEffect(() => {
    setLogs([]); // Clear logs when build ID changes
    setError(null);
    setReconnectAttempt(0);
    initializeSocket();
    
    // Clean up on unmount or when buildId changes
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [buildId, initializeSocket]);
  
  return (
    <div className="bg-gradient-to-b from-gray-900 to-black rounded-lg p-4 shadow-lg">
  <div className="flex justify-between items-center mb-3 px-1">
    <div className="text-sm">
      {connected ? (
        <span className="flex items-center">
          <span className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
          <span className="text-emerald-400 font-medium">Connected to logs</span>
        </span>
      ) : (
        <span className="flex items-center">
          <span className="h-2 w-2 bg-red-500 rounded-full mr-2"></span>
          <span className="text-red-400 font-medium">Disconnected</span>
        </span>
      )}
    </div>
    
    <div className="flex gap-2">
      {!connected && reconnectAttempt < maxReconnectAttempts && (
        <button 
          onClick={() => {
            setReconnectAttempt(0);
            initializeSocket();
          }}
          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md transition-colors duration-200 shadow-sm"
        >
          Reconnect
        </button>
      )}
      
      {logs.length > 0 && (
        <button 
          onClick={scrollToBottom}
          className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded-md transition-colors duration-200 flex items-center gap-1"
        >
          <span>Bottom</span>
          <svg className="w-3 h-3 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      )}
    </div>
  </div>
  
  {error && (
    <div className="mb-3 p-3 bg-red-900/30 border border-red-700 text-red-300 rounded-md text-sm flex items-center gap-2">
      <svg className="w-4 h-4 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12" y2="16"></line>
      </svg>
      {error}
    </div>
  )}
  
  <div 
    ref={logContainerRef}
    className="font-mono text-sm bg-black border border-gray-800 rounded-md p-4 shadow-inner"
    style={{ 
      height: maxHeight,
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }}
  >
    {logs.length === 0 ? (
      <div className="text-gray-500 italic flex flex-col items-center justify-center h-full">
        <svg className="w-6 h-6 mb-2 animate-pulse" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <span>Waiting for logs...</span>
      </div>
    ) : (
      logs.map((log, index) => (
        <div 
          key={index} 
          className={`
            mb-1 pl-2 border-l-2 transition-opacity duration-300 opacity-100
            ${log.type === 'error' ? 'text-red-400 border-red-500' : 
              log.type === 'info' ? 'text-cyan-300 border-cyan-500' : 
              'text-green-400 border-green-500'}
          `}
        >
          {log.timestamp && (
            <span className="text-gray-500 mr-1">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
          )}
          {log.message}
        </div>
      ))
    )}
  </div>
</div>
  );
};

export default BuildLogStream;