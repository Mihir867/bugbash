/* eslint-disable react-hooks/exhaustive-deps */
// src/components/BuildLogStream.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface LogMessage {
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
  timestamp?: number;
}

interface BuildLogStreamProps {
  buildId?: string;
  maxHeight?: string;
  autoScroll?: boolean;
  maxReconnectAttempts?: number;
}

const BuildLogStream: React.FC<BuildLogStreamProps> = ({
  buildId,
  maxHeight = "500px",
  autoScroll = true,
  maxReconnectAttempts = 5
}) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback((): void => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [logs, autoScroll]);

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
      reconnectTimeoutRef.current = setTimeout(() => {
        if (buildId) {
          initializeEventSource();
        }
      }, delay);
    } else {
      setError(`Failed to connect after ${maxReconnectAttempts} attempts. Please refresh or try again later.`);
    }
  }, [reconnectAttempt, maxReconnectAttempts, buildId]);

  const initializeEventSource = useCallback(() => {
    if (!buildId) {
      setLogs([{ type: 'info', message: 'No build ID available. Trigger a build to see logs.' }]);
      return;
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsLoading(true);
    setError(null);

    try {
      const eventSource = new EventSource(`/api/build-logs?buildId=${buildId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        setIsConnected(true);
        setIsLoading(false);
        setError(null);
        setReconnectAttempt(0);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLogs(prev => [...prev, data]);
          scrollToBottom();
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setError('Connection to log stream failed');
        setIsConnected(false);
        setIsLoading(false);
        eventSource.close();
        handleReconnect();
      };
    } catch (error) {
      console.error('Error initializing EventSource:', error);
      setError(`Failed to initialize connection: ${error instanceof Error ? error.message : String(error)}`);
      handleReconnect();
    }
  }, [buildId, handleReconnect, scrollToBottom]);

  // Initialize EventSource when buildId changes
  useEffect(() => {
    setLogs([]); // Clear logs when build ID changes
    setError(null);
    setReconnectAttempt(0);
    initializeEventSource();
    
    // Clean up on unmount or when buildId changes
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [buildId, initializeEventSource]);

  const getLogLevelColor = (type: LogMessage['type']): string => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'info': 
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="w-full bg-gradient-to-b from-gray-900 to-black rounded-lg border border-gray-700 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
          <h3 className="text-white font-medium">Build Logs</h3>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900/30 border-l-4 border-red-500 text-red-200">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Logs Display */}
      <div 
        className="p-4 overflow-y-auto font-mono text-sm"
        style={{ maxHeight }}
      >
        {logs.length === 0 && !isLoading && (
          <div className="text-gray-500 text-center py-8">
            No logs available. Trigger a build to see logs.
          </div>
        )}
        
        {isLoading && (
          <div className="text-gray-400 flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span>Connecting to log stream...</span>
          </div>
        )}

        {logs.map((log, index) => (
          <div key={index} className="mb-2 flex space-x-3">
            <span className="text-gray-500 text-xs shrink-0">
              {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
            </span>
            <span className={`${getLogLevelColor(log.type)} break-words`}>
              {log.message}
            </span>
          </div>
        ))}
        
        <div ref={logsEndRef} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800/50 rounded-b-lg border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{logs.length} log entries</span>
          <span>
            Status: {isConnected ? 'Connected' : isLoading ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BuildLogStream;