/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/ui/header';
import AuthProvider from '@/lib/auth-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Breach X',
  description: 'We find Vulnerability before they find you',
};

export default function RootLayout({ children }:any) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}