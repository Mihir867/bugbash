import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="bg-gradient-to-r from-blue-800 to-indigo-900 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Manage Your GitHub Repositories
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-10 text-blue-100">
            Connect with your GitHub account to easily browse and manage your repositories in one place.
          </p>
          <Link 
            href="/sign-in" 
            className="bg-white text-blue-900 hover:bg-blue-100 transition-colors px-8 py-3 rounded-md font-medium text-lg inline-flex items-center"
          >
            Get Started
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-blue-600 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-3">Easy Authentication</h2>
            <p className="text-gray-600">
              Sign in with your GitHub account with just one click. No new passwords to remember.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-blue-600 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-3">Browse Repositories</h2>
            <p className="text-gray-600">
              View all your GitHub repositories in one place with a clean, user-friendly interface.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-blue-600 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-3">Select and Save</h2>
            <p className="text-gray-600">
              Select repositories you want to work with and save them to your dashboard for quick access.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}