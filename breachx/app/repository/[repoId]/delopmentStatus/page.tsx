'use client'
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function DeploymentStatus({ repository, onTriggerBuild }: any) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleBuild = async () => {
    setIsLoading(true);
    try {
      await onTriggerBuild();
    } catch (error) {
      console.error('Failed to trigger build:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Early return if repository is undefined or null
  if (!repository) {
    return <div className='pt-20'>No repository data available</div>;
  }
  
  // Early return if repository config is undefined or null
  if (!repository.config) {
    return <Badge variant="outline">No Config</Badge>;
  }
  
  const status = repository.config.buildStatus || 'PENDING';
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
        {repository.config.deploymentUrl && (
          <a 
            href={repository.config.deploymentUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline text-sm"
          >
            Open Deployment
          </a>
        )}
      </div>
      
      {repository.config.lastBuildStartTime && (
        <p className="text-xs text-gray-500">
          Last build: {new Date(repository.config.lastBuildStartTime).toLocaleString()}
        </p>
      )}
      
      <Button 
        size="sm" 
        onClick={handleBuild} 
        disabled={isLoading || status === 'BUILDING'}
      >
        {isLoading || status === 'BUILDING' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Building...
          </>
        ) : (
          'Deploy'
        )}
      </Button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PENDING':
      return <Badge variant="outline">Pending</Badge>;
    case 'BUILDING':
      return <Badge variant="secondary">Building</Badge>;
    case 'DEPLOYED':
      return <Badge variant="success">Deployed</Badge>;
    case 'FAILED':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}