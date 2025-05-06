/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RepositoryCard from '@/components/ui/repo-card';
import { getUserRepositories } from '@/lib/github';

export default function MyRepositories() {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;
  const router = useRouter();
  const [repositories, setRepositories] = useState<{ name: string, description: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [languages, setLanguages] = useState([]);
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
    }
  }, [status, router]);
  
  useEffect(() => {
    if (session?.user) {
      fetchRepositories();
    }
  }, [session]);
  
  const fetchRepositories = async () => {
    try {
      setIsLoading(true);
      const repos = await getUserRepositories(accessToken);
      setRepositories(repos);
      
      // Extract unique languages
      const uniqueLanguages = [...new Set(repos.map(repo => repo.language).filter(Boolean))];
      setLanguages(uniqueLanguages);
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const filteredRepositories = repositories.filter((repo:any) => {
    const matchesSearch = repo.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLanguage = !selectedLanguage || repo.language === selectedLanguage;
    
    return matchesSearch && matchesLanguage;
  });
  
  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your repositories...</p>
        </div>
      </div>
    );
  }
  
  if (!session) {
    return null; // Will redirect via useEffect
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My GitHub Repositories</h1>
      
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search repositories..."
              className="w-full px-4 py-2 border rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div>
            <select
              className="w-full md:w-auto px-4 py-2 border rounded-md bg-white"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="">All Languages</option>
              {languages.map(language => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {filteredRepositories.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepositories.map((repo:any) => (
            <RepositoryCard 
              key={repo.id} 
              repository={repo} 
              onSelect={() => {
                // Optional: navigate to repository detail page
                // router.push(`/repository/${repo.id}`);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          {searchTerm || selectedLanguage ? (
            <>
              <h3 className="text-lg font-medium mb-2">No matching repositories found</h3>
              <p className="text-gray-600">
                Try changing your search or filter criteria.
              </p>
              <button
                className="mt-4 text-blue-600 hover:text-blue-800"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLanguage('');
                }}
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium mb-2">No repositories found</h3>
              <p className="text-gray-600">
                It looks like you not have any GitHub repositories yet.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}