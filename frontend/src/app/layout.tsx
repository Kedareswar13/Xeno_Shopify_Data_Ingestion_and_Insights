import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/providers/ThemeProvider';
import AuthProvider from '@/lib/auth';
import { LayoutProvider } from '@/providers/LayoutProvider';
import { Toaster } from '@/components/ui/toaster';
import { QueryProvider } from '@/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'] });


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
        <QueryProvider>
          <ThemeProvider defaultTheme="system">
            <AuthProvider>
              <LayoutProvider>
                {children}
                <Toaster />
              </LayoutProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
