'use client';

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/providers/ThemeProvider';
import AuthProvider from '@/lib/auth';
import { LayoutProvider } from '@/providers/LayoutProvider';
import { Toaster } from '@/components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const inter = Inter({ subsets: ['latin'] });

// Create a client
const queryClient = new QueryClient();

export const metadata: Metadata = {
  title: 'Xeno Shopify Insights',
  description: 'Advanced analytics for your Shopify stores',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="system">
            <AuthProvider>
              <LayoutProvider>
                {children}
                <Toaster />
              </LayoutProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
