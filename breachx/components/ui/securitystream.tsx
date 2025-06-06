/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';

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
  githubUrl?: string;
  maxReconnectAttempts?: number;
}

interface LogData {
  message: string;
  level?: 'error' | 'warning' | 'success' | 'info';
  type?: string;
  timestamp?: number;
}

interface CompleteEventData {
  message: string;
  summary: string;
  timestamp: number;
  type: string;
}

const SecurityLogStream: React.FC<SecurityLogStreamProps> = ({ 
  deploymentUrl,
  githubUrl,
  maxHeight = "500px", 
  autoScroll = true,
  maxReconnectAttempts = 5
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [pdfReportUrl, setPdfReportUrl] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanIdRef = useRef<string | null>(null);

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

    if (reconnectAttempt < maxReconnectAttempts && scanIdRef.current) {
      const nextAttempt = reconnectAttempt + 1;
      const delay = Math.min(1000 * Math.pow(2, nextAttempt), 30000); // Exponential backoff with 30s max
      
      setLogs(prev => [...prev, {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        message: `Reconnecting in ${delay/1000} seconds...`,
        level: 'info'
      }]);
      
      setReconnectAttempt(nextAttempt);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (scanIdRef.current) {
          connectToEventSource(scanIdRef.current);
        }
      }, delay);
    } else {
      setError(`Failed to connect after ${maxReconnectAttempts} attempts. Please try starting a new scan.`);
    }
  }, [reconnectAttempt, maxReconnectAttempts]);

  const connectToEventSource = useCallback((scanId: string) => {
    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`/api/security-scan/logs?scanId=${scanId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = (): void => {
        console.log('✅ EventSource connection opened successfully');
        setIsConnected(true);
        setIsLoading(false);
        setError(null);
        setReconnectAttempt(0);
      };

      eventSource.onmessage = (event: MessageEvent): void => {
        try {
          const logData: LogData = JSON.parse(event.data);
          
          setLogs(prev => [...prev, {
            id: Date.now() + Math.random(),
            timestamp: new Date(logData.timestamp || Date.now()).toISOString(),
            message: logData.message,
            level: logData.level || 'info'
          }]);
          scrollToBottom();
        } catch (error) {
          console.error('Error parsing log message:', error);
        }
      };

      eventSource.onerror = (error: Event): void => {
        console.error('❌ SSE error:', error);
        setError('Connection to log stream failed');
        setIsConnected(false);
        setIsLoading(false);
        eventSource.close();
        
        // Attempt to reconnect
        handleReconnect();
      };

      eventSource.addEventListener('complete', async (event: MessageEvent): Promise<void> => {
        try {
          const data: CompleteEventData = JSON.parse(event.data);
          
          setLogs(prev => [...prev, {
            id: Date.now() + Math.random(),
            timestamp: new Date(data.timestamp).toISOString(),
            message: `Scan completed: ${data.summary}`,
            level: 'success'
          }]);
          setIsConnected(false);
          eventSource.close();
          
          // Fetch latest report when scan completes
          await fetchLatestReport();
        } catch (error) {
          console.error('Error handling complete event:', error);
        }
      });

    } catch (error) {
      console.error('Error connecting to event source:', error);
      setError(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
      handleReconnect();
    }
  }, [handleReconnect, scrollToBottom]);

  const startScanning = async (): Promise<void> => {
    if (!deploymentUrl) {
      setError('Deployment URL is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLogs([]);
    setPdfReportUrl(null);
    setReconnectAttempt(0);

    try {
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

      const { scanId } = await response.json();
      scanIdRef.current = scanId;
      
      // Connect to SSE endpoint
      connectToEventSource(scanId);

    } catch (err) {
      console.error('Error starting scan:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const fetchLatestReport = async () => {
    try {
      const response = await fetch('/api/security-scan/report');
      const result = await response.json();
      
      if (result.reportUrl) {
        setPdfReportUrl(result.reportUrl);
        setLogs(prev => [...prev, {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          message: `Latest security report is available (generated: ${new Date(result.lastModified).toLocaleString()})`,
          level: 'success'
        }]);
      } else {
        setLogs(prev => [...prev, {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          message: 'No security report available',
          level: 'warning'
        }]);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setLogs(prev => [...prev, {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        message: 'Failed to fetch security report',
        level: 'error'
      }]);
    }
  };

  const stopScanning = (): void => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {pdfReportUrl && (
        <a
          href={`/reports?pdfUrl=${encodeURIComponent(pdfReportUrl)}&repoUrl=${encodeURIComponent(githubUrl || '')}`}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center space-x-1 mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>View Report</span>
        </a>
      )}

      <div className="w-full bg-gradient-to-b from-gray-900 to-black rounded-lg border border-gray-700 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
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
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? 'Starting...' : 'Start Scan'}
            </button>
            
            <button
              onClick={stopScanning}
              disabled={!isConnected}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Stop
            </button>
            
            <button
              onClick={clearLogs}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors duration-200"
            >
              Clear
            </button>
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
        <div className="px-4 py-2 bg-gray-800/50 rounded-b-lg border-t border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{logs.length} log entries</span>
            <span>
              Status: {isConnected ? 'Connected' : isLoading ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default SecurityLogStream;