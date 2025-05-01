'use client';

import { useState } from 'react';

export default function RepositoryCard({ repository, onSelect }:any) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const handleSelectRepository = async () => {
    if (isLoading || isSaved) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/saveRepo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoId: repository.id,
          name: repository.name,
          description: repository.description || '',
          url: repository.html_url,
        }),
      });
      
      if (response.ok) {
        setIsSaved(true);
        if (onSelect) {
          onSelect(repository);
        }
      } else {
        const error = await response.json();
        console.error('Failed to save repository:', error);
      }
    } catch (error) {
      console.error('Error saving repository:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-lg font-semibold">{repository.name}</h3>
      
      {repository.description && (
        <p className="text-gray-600 mt-2 line-clamp-2">{repository.description}</p>
      )}
      
      <div className="mt-3 flex items-center text-sm text-gray-500">
        {repository.language && (
          <span className="mr-4">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
            {repository.language}
          </span>
        )}
        
        <span>Updated {new Date(repository.updated_at).toLocaleDateString()}</span>
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        <a 
          href={repository.html_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          View on GitHub
        </a>
        
        <button
          onClick={handleSelectRepository}
          disabled={isLoading || isSaved}
          className={`px-3 py-1 rounded text-sm ${
            isSaved 
              ? 'bg-green-100 text-green-800 border border-green-300' 
              : isLoading
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSaved ? 'Selected' : isLoading ? 'Saving...' : 'Select'}
        </button>
      </div>
    </div>
  );
}