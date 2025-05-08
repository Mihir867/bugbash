/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Define types for our data structures
interface RepositoryConfig {
  id: string;
  repositoryId: string;
  hasDocker: boolean;
  dockerConfig?: string;
  rootDirectory?: string;
  buildCommand?: string;
  runCommand?: string;
  environmentVariables?: any;
  buildStatus?: string;
  lastBuildId?: string;
  lastBuildStartTime?: string;
  deploymentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface Repository {
  id: string;
  repoId: string;
  name: string;
  description?: string;
  url: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  config?: RepositoryConfig;
  repository: any;
}

export default function RepositoryDetail() {
  const { repoId } = useParams(); // ✅ This pulls the [repoId] from the URL
  const { data: session, status } = useSession();
  const router = useRouter();

  const [repository, setRepository] = useState<null | Repository>(null);
  const [repoConfig, setRepoConfig] = useState<null | RepositoryConfig>(null);
  const [loading, setLoading] = useState(true);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildMessage, setBuildMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && repoId) {
      fetchRepositoryDetails();
    }
  }, [session, repoId]);

  const fetchRepositoryDetails = async () => {
    try {
      const repoResponse = await fetch(`/api/repoConfig/${repoId}`);
      if (!repoResponse.ok) {
        throw new Error('Repository not found');
      }

      const repoData = await repoResponse.json();
      setRepository(repoData);

      const configResponse = await fetch(`/api/repoConfig/${repoId}`);
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setRepoConfig(configData);
      }
    } catch (error) {
      console.error('Error fetching repository details:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const triggerBuild = async () => {
    setBuildLoading(true);
    setBuildMessage(null);
    
    try {
      const response = await fetch(`/api/repositories/${repoId}/build`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setBuildMessage({ 
          type: 'success', 
          text: 'Build triggered successfully! Build ID: ' + data.buildId 
        });
        // Refresh the repository config to get updated build status
        fetchRepositoryDetails();
      } else {
        setBuildMessage({ 
          type: 'error', 
          text: data.error || 'Failed to trigger build' 
        });
      }
    } catch (error) {
      console.error('Error triggering build:', error);
      setBuildMessage({ 
        type: 'error', 
        text: 'An error occurred while triggering the build' 
      });
    } finally {
      setBuildLoading(false);
    }
  };

  const getBuildStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusColors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'BUILDING': 'bg-blue-100 text-blue-800',
      'DEPLOYED': 'bg-green-100 text-green-800',
      'FAILED': 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading repository details...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (!repository) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">Repository not found</h2>
          <p className="text-gray-600 mb-6">
            You may not have access to this repository.
          </p>
          <Link
            href="/dashboard"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 pb-8 py-32">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">{repository.repository.name}</h1>
              
              {repository.repository.description && (
                <p className="text-gray-600 mb-4">{repository.repository.description}</p>
              )}
            </div>
            
            <button
              onClick={triggerBuild}
              disabled={buildLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {buildLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Building...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Trigger Build
                </>
              )}
            </button>
          </div>
          
          {buildMessage && (
            <div className={`mt-4 p-3 rounded ${buildMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {buildMessage.text}
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mb-6 mt-4">
            <a
              href={repository.repository.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md inline-flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on GitHub
            </a>
            
            {repoConfig?.deploymentUrl && (
              <a
                href={repoConfig.deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2 rounded-md inline-flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                View Deployment
              </a>
            )}
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Repository Information</h2>
              {repoConfig?.buildStatus && getBuildStatusBadge(repoConfig.buildStatus)}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600">Added on</p>
                <p className="font-medium">{new Date(repository.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Last updated</p>
                <p className="font-medium">{new Date(repository.updatedAt).toLocaleDateString()}</p>
              </div>
              {repoConfig?.lastBuildStartTime && (
                <div>
                  <p className="text-gray-600">Last build</p>
                  <p className="font-medium">{new Date(repoConfig.lastBuildStartTime).toLocaleString()}</p>
                </div>
              )}
              {repoConfig?.lastBuildId && (
                <div>
                  <p className="text-gray-600">Build ID</p>
                  <p className="font-medium">{repoConfig.lastBuildId}</p>
                </div>
              )}
            </div>
            
            {repoConfig && (
              <div className="border-t pt-4">
                <h2 className="text-lg font-semibold mb-3">Build Configuration</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600">Root Directory</p>
                    <p className="font-medium">{repoConfig.rootDirectory || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Build Command</p>
                    <p className="font-medium">{repoConfig.buildCommand || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Run Command</p>
                    <p className="font-medium">{repoConfig.runCommand || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Docker</p>
                    <p className="font-medium">{repoConfig.hasDocker ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
                
                {repoConfig.environmentVariables && (
                  <div className="mt-4">
                    <p className="text-gray-600 mb-2">Environment Variables</p>
                    <div className="bg-gray-50 p-3 rounded-md">
                      {Object.entries(repoConfig.environmentVariables).map(([key]) => (
                        <div key={key} className="flex items-center mb-1 last:mb-0">
                          <span className="font-medium mr-2">{key}:</span>
                          <span className="text-gray-600">●●●●●●●●</span>
                        </div>
                      ))}
                      {Object.entries(repoConfig.environmentVariables).length === 0 && (
                        <p className="text-gray-500 italic">No environment variables configured</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}