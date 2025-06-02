/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/ui/header';
import AuthProvider from '@/lib/auth-provider';
import SolanaProvider from '@/lib/solana-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'BreachX',
  description: 'We find Vulnerability before they find you',
};

export default function RootLayout({ children }:any) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black min-h-screen`}>
        <AuthProvider>
          <SolanaProvider>
            <Header />
            {children}
          </SolanaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}