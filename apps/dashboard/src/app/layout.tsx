import type { Metadata } from 'next';
import { QueryProvider } from '../shared/providers/query-client';
import { TooltipProvider } from '../shared/components/ui/tooltip';
import { Toaster } from '../shared/components/ui/toaster';
import { Header } from '../shared/components/layout/header';
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
    <html className="bg-background text-foreground" lang="en">
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