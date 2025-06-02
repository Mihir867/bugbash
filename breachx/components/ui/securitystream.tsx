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
  githubUrl?: string; // Optional prop for GitHub URL
}

interface ScanResponse {
  scanId: string;
}

interface LogData {
  message: string;
  level?: 'error' | 'warning' | 'success' | 'info';
  type?: string;
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
  autoScroll = true 
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [pdfReportUrl, setPdfReportUrl] = useState<string | null>(null);
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

    console.log('🚀 Starting security scan for URL:', deploymentUrl);
    setIsLoading(true);
    setError(null);
    setLogs([]);
    setPdfReportUrl(null);

    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        console.log('🔄 Closing existing event source connection');
        eventSourceRef.current.close();
      }

      // Start the scanning process
      console.log('📡 Sending scan request to API');
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
      console.log('📝 Received scan ID:', scanId);

      // Connect to SSE endpoint for real-time logs
      console.log('🔌 Connecting to SSE endpoint');
      const eventSource = new EventSource(`/api/security-scan/logs?scanId=${scanId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = (): void => {
        console.log('✅ EventSource connection opened successfully');
        setIsConnected(true);
        setIsLoading(false);
      };

      eventSource.onmessage = (event: MessageEvent): void => {
        console.log('📨 Received SSE message:', event.data);
        const logData: LogData = JSON.parse(event.data);
        
        setLogs(prev => [...prev, {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          message: logData.message,
          level: logData.level || 'info'
        }]);
      };

      eventSource.onerror = (error: Event): void => {
        console.error('❌ SSE error details:', {
          error,
          readyState: eventSource.readyState,
          url: eventSource.url
        });
        setError('Connection to log stream failed');
        setIsConnected(false);
        setIsLoading(false);
        eventSource.close();
        
        // Fetch latest report when connection is closed
        console.log('🔍 Connection closed, fetching latest report');
        fetchLatestReport();
      };

      eventSource.addEventListener('complete', async (event: MessageEvent): Promise<void> => {
        console.log('🏁 Scan completed event received');
        const data: CompleteEventData = JSON.parse(event.data);
        console.log('📊 Scan completion data:', data);
        
        setLogs(prev => [...prev, {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          message: `Scan completed: ${data.summary}`,
          level: 'success'
        }]);
        setIsConnected(false);
        eventSource.close();
        
        // Fetch latest report when scan completes
        console.log('🔍 Scan completed, fetching latest report');
        fetchLatestReport();
      });

      // Function to fetch the latest report
      const fetchLatestReport = async () => {
        try {
          console.log('📡 Fetching latest report from API');
          const response = await fetch('/api/security-scan/report');
          const result = await response.json();
          
          if (result.reportUrl) {
            console.log('✅ Latest report URL found:', result.reportUrl);
            setPdfReportUrl(result.reportUrl);
            setLogs(prev => [...prev, {
              id: Date.now() + Math.random(),
              timestamp: new Date().toISOString(),
              message: `Latest security report is available (generated: ${new Date(result.lastModified).toLocaleString()})`,
              level: 'success'
            }]);
          } else {
            console.log('❌ No report URL found in result:', result);
            setLogs(prev => [...prev, {
              id: Date.now() + Math.random(),
              timestamp: new Date().toISOString(),
              message: 'No security report available',
              level: 'warning'
            }]);
          }
        } catch (err) {
          console.error('❌ Error fetching report:', err);
          setLogs(prev => [...prev, {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            message: 'Failed to fetch security report',
            level: 'error'
          }]);
        }
      };

    } catch (err) {
      console.error('❌ Error in startScanning:', err);
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
    <>
   {pdfReportUrl && (
  <a
    href={`/reports?pdfUrl=${encodeURIComponent(pdfReportUrl)}&repoUrl=${encodeURIComponent(githubUrl || '')}`}
    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center space-x-1"
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
        className="p-4 overflow-y-auto min-h-[400px] font-mono text-sm"
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
    </>
  );
};

export default SecurityLogStream;