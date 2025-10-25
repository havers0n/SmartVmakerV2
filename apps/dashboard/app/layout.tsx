import type { Metadata } from 'next';
import { QueryProvider } from '@/src/providers/query-client';
import { TooltipProvider } from '@/src/components/ui/tooltip';
import { Toaster } from '@/src/components/ui/toaster';
import { Header } from '@/src/components/layout/header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scrimspec Dashboard',
  description: 'YouTube ingestion and video analysis dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-background text-foreground">
      <body className="min-h-screen">
        <QueryProvider>
          <TooltipProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}