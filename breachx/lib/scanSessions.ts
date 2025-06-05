interface ScanSession {
    taskArn: string;
    startTime: string;
    status: 'RUNNING' | 'STOPPED' | 'FAILED';
  }
  
  declare global {
    const scanSessions: Map<string, ScanSession> | undefined;
  }
  
  const globalForScanSessions = globalThis as unknown as {
    scanSessions: Map<string, ScanSession> | undefined;
  };
  
  if (!globalForScanSessions.scanSessions) {
    globalForScanSessions.scanSessions = new Map<string, ScanSession>();
  }
  
  export const scanSessions = globalForScanSessions.scanSessions;