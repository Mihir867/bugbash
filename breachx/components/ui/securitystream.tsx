/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';

// Type definitions
interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  level: 'error' | 'warning' | 'success' | 'info';
}

interface SecurityLogStreamProps {
  deploymentUrl?: string;
  maxHeight?: string;
  autoScroll?: boolean;
}

interface ScanResponse {
  scanId: string;
}

interface LogData {
  message: string;
  level?: 'error' | 'warning' | 'success' | 'info';
}

interface CompleteEventData {
  summary: string;
}

const SecurityLogStream: React.FC<SecurityLogStreamProps> = ({ 
  deploymentUrl, 
  maxHeight = "500px", 
  autoScroll = true 
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = (): void => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs, autoScroll]);

  const startScanning = async (): Promise<void> => {
    if (!deploymentUrl) {
      setError('Deployment URL is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLogs([]);

    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Start the scanning process
      const response = await fetch('/api/security-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUrl: deploymentUrl }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { scanId }: ScanResponse = await response.json();

      // Connect to SSE endpoint for real-time logs
      const eventSource = new EventSource(`/api/security-scan/logs?scanId=${scanId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = (): void => {
        setIsConnected(true);
        setIsLoading(false);
      };

      eventSource.onmessage = (event: MessageEvent): void => {
        const logData: LogData = JSON.parse(event.data);
        
        setLogs(prev => [...prev, {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          message: logData.message,
          level: logData.level || 'info'
        }]);
      };

      eventSource.onerror = (error: Event): void => {
        console.error('SSE error:', error);
        setError('Connection to log stream failed');
        setIsConnected(false);
        setIsLoading(false);
        eventSource.close();
      };

      eventSource.addEventListener('complete', (event: MessageEvent): void => {
        const data: CompleteEventData = JSON.parse(event.data);
        setLogs(prev => [...prev, {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          message: `Scan completed: ${data.summary}`,
          level: 'success'
        }]);
        setIsConnected(false);
        eventSource.close();
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const stopScanning = (): void => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  };

  const clearLogs = (): void => {
    setLogs([]);
    setError(null);
  };

  const getLogLevelColor = (level: LogEntry['level']): string => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'info': 
      default: return 'text-blue-400';
    }
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="w-full bg-gray-900 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
          <h3 className="text-white font-medium">Security Scanner</h3>
          {deploymentUrl && (
            <span className="text-sm text-gray-400 truncate max-w-xs">
              {deploymentUrl}
            </span>
          )}
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={startScanning}
            disabled={isLoading || isConnected || !deploymentUrl}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting...' : 'Start Scan'}
          </button>
          
          <button
            onClick={stopScanning}
            disabled={!isConnected}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Stop
          </button>
          
          <button
            onClick={clearLogs}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900/50 border-l-4 border-red-500 text-red-200">
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
            No logs available. Click Start Scan to begin.
          </div>
        )}
        
        {isLoading && (
          <div className="text-gray-400 flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span>Initializing security scan...</span>
          </div>
        )}

        {logs.map((log) => (
          <div key={log.id} className="mb-2 flex space-x-3">
            <span className="text-gray-500 text-xs shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={`${getLogLevelColor(log.level)} break-words`}>
              {log.message}
            </span>
          </div>
        ))}
        
        <div ref={logsEndRef} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 rounded-b-lg border-t border-gray-700">
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

export default SecurityLogStream;