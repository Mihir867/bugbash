import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/ui/header';
import AuthProvider from '@/lib/auth-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'GitHub Repository Manager',
  description: 'Manage your GitHub repositories with ease',
};

export default function RootLayout({ children }) {
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