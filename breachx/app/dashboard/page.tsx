'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Container from '@/components/ui/container';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);
  
  useEffect(() => {
    if (session) {
      fetchUserRepositories();
    }
  }, [session]);
  
  const fetchUserRepositories = async () => {
    try {
      const response = await fetch('/api/saveRepo');
      if (response.ok) {
        const data = await response.json();
        setRepositories(data);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }
  
  if (!session) {
    return null; // Will redirect via useEffect
  }
  
  return (
    <Container>
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {session.user?.image && (
            <Image
              src={session.user.image}
              alt={session.user.name || 'User'}
              width={100}
              height={100}
              className="rounded-full"
            />
          )}
          
          <div>
            <h1 className="text-2xl font-bold">{session.user?.name}</h1>
            <p className="text-gray-600">@{session.user?.githubUsername}</p>
            <p className="text-gray-600">{session.user?.email}</p>
          </div>
        </div>
      </div>
      
      <div className="mb-8">
        
        
        {repositories.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repositories.map((repo) => (
              <div key={repo.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <h3 className="font-semibold text-lg mb-2">{repo.name}</h3>
                {repo.description && <p className="text-gray-600 mb-3 line-clamp-2">{repo.description}</p>}
                <div className="flex justify-between items-center">
                  <a 
                    href={repo.html_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View on GitHub
                  </a>
                  <Link 
                    href={`/repository/${repo.id}`}
                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-200"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No repositories selected yet</h3>
            <p className="text-gray-600 mb-4">
              Browse your GitHub repositories and select the ones you want to work with.
            </p>
            <Link 
              href="/my-repositories" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded inline-block"
            >
              Browse Repositories
            </Link>
          </div>
        )}
      </div>
    </div>
    </Container>
  );
}