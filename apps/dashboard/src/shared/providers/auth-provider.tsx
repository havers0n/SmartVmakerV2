'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/shared/lib/supabase/client';
import { Session, User } from '@supabase/supabase-js';

// Types
type AuthContextType = {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } }>;
  signUp: (email: string, password: string) => Promise<{ error?: { message: string } }>;
  signOut: () => Promise<void>;
  loading: boolean;
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.includes(pathname);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
        }

        console.log('Auth session loaded:', session ? 'authenticated' : 'not authenticated');
        setSession(session);
        setUser(session?.user || null);
        setLoading(false);
      } catch (err) {
        console.error('Exception getting session:', err);
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'authenticated' : 'not authenticated');
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);

      // Redirect logic - only redirect after auth state changes, not on initial load
      if (event === 'SIGNED_OUT' && !isPublicPath) {
        router.push('/login');
      } else if (event === 'SIGNED_IN' && isPublicPath) {
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isPublicPath, pathname, router]);

  const signIn = async (email: string, password: string) => {
    const supabase = createSupabaseBrowserClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { error: { message: error.message } };
    }
    
    setSession(data.session);
    setUser(data.session?.user || null);
    router.push('/');
    router.refresh();
    
    return {};
  };

  const signUp = async (email: string, password: string) => {
    const supabase = createSupabaseBrowserClient();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) {
      return { error: { message: error.message } };
    }
    
    setSession(data.session);
    setUser(data.session?.user || null);
    
    return {};
  };

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  const value = {
    user,
    session,
    signIn,
    signUp,
    signOut,
    loading,
  };

  // Show loading spinner while checking auth, except on public pages
  if (loading && !isPublicPath) {
    return (
      <AuthContext.Provider value={value}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}