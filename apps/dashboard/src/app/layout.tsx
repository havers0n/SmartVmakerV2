import type { Metadata } from 'next';
import Link from 'next/link';
import { QueryProvider } from '../shared/providers/query-client';
import { AuthProvider } from '../shared/providers/auth-provider';
import { TooltipProvider } from '../shared/components/ui/tooltip';
import { Toaster } from '../shared/components/ui/toaster';
import { Button } from '@/shared/components/ui/button';
import { RadioReceiver, Microscope, Settings, Clapperboard, Video, Library, TrendingUp, Users } from 'lucide-react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scrimspec Studio',
  description: 'AI Video Production Pipeline',
};

// Новый Sidebar компонент (инлайн для простоты)
function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-background/80 backdrop-blur-xl hidden md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-border/50">
        <div className="font-bold text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
          HWAR<span className="text-primary">.Core</span>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-widest">Create</div>

        <Link href="/hwar/create">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <Video className="h-4 w-4" />
            Projects
          </Button>
        </Link>

        <Link href="/hwar/library">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <Library className="h-4 w-4" />
            Library
          </Button>
        </Link>

        <Link href="/hwar/factory">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <Clapperboard className="h-4 w-4" />
            Factory
          </Button>
        </Link>

        <div className="mt-6 text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-widest">Pipeline</div>
        
        <Link href="/ingest">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <RadioReceiver className="h-4 w-4" />
            Ingest & Enrich
          </Button>
        </Link>
        
          <Link href="/analysis">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <Microscope className="h-4 w-4" />
            Analysis Lab
          </Button>
        </Link>

        <div className="mt-6 text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-widest">BeamNG Analytics</div>

        <Link href="/beamng/videos">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <TrendingUp className="h-4 w-4" />
            Videos
          </Button>
        </Link>

        <Link href="/beamng/channels">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <Users className="h-4 w-4" />
            Channels
          </Button>
        </Link>
      </nav>

      <div className="p-4 border-t border-border/50">
        <Link href="/hwar/factory/settings">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>
    </aside>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultLang = process.env.NEXT_PUBLIC_APP_LANG ?? 'en';
  return (
    <html className="dark" lang={defaultLang}>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground">
        <AuthProvider>
          <QueryProvider>
            <TooltipProvider>
              <div className="flex min-h-screen">
                <AppSidebar />
                {/* Main Content Area */}
                <main className="flex-1 md:ml-64 relative">
                   {/* Mobile Header placeholder if needed */}
                  <div className="p-8 max-w-[1600px] mx-auto min-h-screen animate-in fade-in duration-500">
                    {children}
                  </div>
                </main>
              </div>
              <Toaster />
            </TooltipProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}