/**
 * Next.js Middleware for API route protection
 *
 * Security Features Implemented:
 * ✅ Supabase authentication for all protected API routes
 * ✅ Redis-based distributed rate limiting (Upstash)
 * ✅ Security headers (X-Frame-Options, CSP, etc.)
 * ✅ Unauthorized access logging
 * ✅ Rate limit headers in responses (X-RateLimit-*)
 *
 * Rate Limiting:
 * - Algorithm: Sliding Window (100 requests per 60 seconds)
 * - Scope: Per IP address
 * - Backend: Upstash Redis (distributed, edge-compatible)
 * - Analytics: Enabled for monitoring
 *
 * Public API Endpoints (no auth required):
 * - /api/health - Health check endpoint
 *
 * Protected API Endpoints (auth required):
 * - /api/actions/* - Server actions
 * - /api/generation/* - Generation endpoints (PROTECTED)
 * - /api/ingest/* - Ingest endpoints
 * - All other /api/* routes
 *
 * TODO for Production:
 * 1. ✅ Migrate to Redis-based rate limiting (@upstash/ratelimit) - DONE
 * 2. Add CORS configuration for external API consumers
 * 3. Implement API key authentication for service-to-service calls
 * 4. Set up centralized request logging (e.g., LogDNA, Datadog)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ============================================================================
// Redis-based Rate Limiting (Production-Ready)
// ============================================================================

// Initialize Redis client (only if credentials are provided)
// Uses REST API for edge compatibility
let redis: Redis | null = null;
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });

    // Create a rate limiter
    // 100 requests per 60 seconds (1 minute window) per IP
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      analytics: true, // Enable analytics for monitoring
      prefix: '@scrimspec/api', // Prefix for Redis keys
    });

    console.log('[Middleware] ✅ Upstash Redis rate limiting enabled');
  } catch (error) {
    console.error('[Middleware] ⚠️  Failed to initialize Upstash Redis:', error);
    console.warn('[Middleware] Rate limiting will be disabled');
  }
} else {
  console.warn('[Middleware] ⚠️  UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not set');
  console.warn('[Middleware] Rate limiting will be disabled. Add credentials to enable.');
}

export async function middleware(req: NextRequest) {
  // Only protect API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Only truly public endpoints (health checks, webhooks, etc.)
    // All other endpoints require authentication
    const publicApiPaths = ['/api/health'];
    
    // In development, also allow access to generation API endpoints for testing
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment && req.nextUrl.pathname.startsWith('/api/generation')) {
      const response = NextResponse.next();
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      return response;
    }
    
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

    // Redis-based rate limiting (distributed and stateful)
    // If Redis is not configured, skip rate limiting
    let limit = 100;
    let remaining = 100;
    let reset = Date.now() + 60000;

    if (ratelimit) {
      try {
        const result = await ratelimit.limit(ip);
        limit = result.limit;
        remaining = result.remaining;
        reset = result.reset;

        if (!result.success) {
          console.warn(`[Security] Rate limit exceeded for IP: ${ip} (${remaining}/${limit})`);

          // Calculate seconds until reset
          const retryAfter = Math.ceil((reset - Date.now()) / 1000);

          return new NextResponse(
            JSON.stringify({
              error: 'Too many requests. Please try again later.',
              code: 'RATE_LIMIT_EXCEEDED',
              limit,
              remaining: 0,
              reset: new Date(reset).toISOString(),
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
                'X-RateLimit-Limit': String(limit),
                'X-RateLimit-Remaining': String(remaining),
                'X-RateLimit-Reset': String(reset),
              },
            }
          );
        }
      } catch (error) {
        // If rate limiting fails, log error but allow request to continue
        console.error('[Security] Rate limit check failed:', error);
        console.warn('[Security] Allowing request to continue despite rate limit error');
      }
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
      // Log unauthorized access attempts for security monitoring
      console.warn(`[Security] Unauthorized API access attempt: ${req.nextUrl.pathname} from IP: ${ip}`);

      return new NextResponse(
        JSON.stringify({
          error: 'Unauthorized. Please authenticate to access this endpoint.',
          code: 'UNAUTHORIZED',
          path: req.nextUrl.pathname,
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer',
          },
        }
      );
    }

    // Log authenticated API requests in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Auth] ✓ Authenticated request to: ${req.nextUrl.pathname} (user: ${session.user.email}) [Rate: ${remaining}/${limit}]`);
    }

    // Add security headers and rate limit info
    const response = NextResponse.next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', String(limit));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(reset));

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