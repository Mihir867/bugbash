interface ScanSession {
    taskArn: string;
    targetUrl: string;
    startTime: Date;
    status: string;
  }
  
  declare global {
    var scanSessions: Map<string, ScanSession> | undefined;
  }
  
  const globalForScanSessions = globalThis as unknown as {
    scanSessions: Map<string, ScanSession> | undefined;
  };
  
  if (!globalForScanSessions.scanSessions) {
    globalForScanSessions.scanSessions = new Map<string, ScanSession>();
  }
  
  export const scanSessions = globalForScanSessions.scanSessions;