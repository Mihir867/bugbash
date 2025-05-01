'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';

export default function Header() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  return (
    <header className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          GitHub Repository Manager
        </Link>
        
        <nav className="flex gap-4 items-center">
          <Link href="/" className="hover:text-gray-300">
            Home
          </Link>
          
          {session && (
            <>
              <Link href="/dashboard" className="hover:text-gray-300">
                Dashboard
              </Link>
              <Link href="/my-repositories" className="hover:text-gray-300">
                My Repositories
              </Link>
            </>
          )}
          
          {!loading && !session && (
            <button
              onClick={() => signIn('github')}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md"
            >
              Sign In with GitHub
            </button>
          )}
          
          {session && (
            <div className="flex items-center gap-3">
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <span className="hidden md:inline">{session.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md text-sm"
              >
                Sign Out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}