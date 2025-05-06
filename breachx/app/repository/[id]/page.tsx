/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { use } from 'react';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RepositoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); // ✅ unwrap the promise

  const { data: session, status } = useSession();
  const router = useRouter();
  const [repository, setRepository] = useState<null | any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchRepositoryDetails();
    }
  }, [session, id]);

  const fetchRepositoryDetails = async () => {
    try {
      const response = await fetch(`/api/repoConfig/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRepository(data);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching repository details:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
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
            The repository not have access to it.
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
          <h1 className="text-2xl font-bold mb-2">{repository.name}</h1>
          
          {repository.description && (
            <p className="text-gray-600 mb-4">{repository.description}</p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-6">
            <a
              href={repository.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md inline-flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on GitHub
            </a>
          </div>
          
          <div className="border-t pt-4">
            <h2 className="text-lg font-semibold mb-3">Repository Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Added on</p>
                <p className="font-medium">{new Date(repository.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Last updated</p>
                <p className="font-medium">{new Date(repository.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}