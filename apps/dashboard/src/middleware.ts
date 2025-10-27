/**
 * Next.js Middleware for API route protection
 *
 * IMPORTANT: This is a basic security layer. For production, implement:
 * 1. Supabase Auth or NextAuth.js for real authentication
 * 2. Rate limiting (e.g., @upstash/ratelimit)
 * 3. CORS configuration
 * 4. Request logging
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Simple in-memory rate limiting (for development only!)
// In production, use Redis-based rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

export async function middleware(req: NextRequest) {
  // Only protect API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Allow access to health checks and generation endpoints for testing
    const publicApiPaths = ['/api/health', '/api/generation'];
    const isPublicApiPath = publicApiPaths.some(path => req.nextUrl.pathname.startsWith(path));
    
    if (isPublicApiPath) {
      // Add security headers
      const response = NextResponse.next();
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

      return response;
    }

    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? '127.0.0.1';

    // Basic rate limiting
    if (!checkRateLimit(ip)) {
      console.warn(`[Security] Rate limit exceeded for IP: ${ip}`);
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }

    // Create Supabase client for authentication check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
        },
      }
    );

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return new NextResponse(
        JSON.stringify({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Add security headers
    const response = NextResponse.next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;
  }

  // Protect all routes except login, signup, and public API routes
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname === path);
  
  if (!isPublicPath && !req.nextUrl.pathname.startsWith('/api/')) {
    // Create Supabase client for authentication check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
        },
      }
    );

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Redirect to login page
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all API routes except:
     * - health checks
     * - webhooks (if you have them)
     */
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|login|signup).*)',
  ],
};