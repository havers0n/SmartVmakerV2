import { drizzle } from 'drizzle-orm/node-postgres';
import { createClient } from '@supabase/supabase-js';
import { Pool, PoolConfig } from 'pg';

import * as schema from '../migrations/schema';

// ============================================================================
// Database Connection Factory with Hot Reload Support
// ============================================================================

// Extend PoolConfig to include the family property
interface ExtendedPoolConfig extends PoolConfig {
  family?: number;
}

// Use globalThis to preserve pool across hot reloads in development
const globalForDb = globalThis as unknown as {
  __pgPool: Pool | undefined;
};

export function getPgClient(): Pool {
  if (!globalForDb.__pgPool) {
    // Приоритет - пулер. Если его нет - обычный URL.
    const drizzleUrl = process.env.DRIZZLE_DATABASE_URL;
    const directUrl = process.env.DATABASE_URL;

    // Диагностика: проверяем какие переменные доступны
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      console.log('🔍 DB Connection Debug Info:');
      console.log('  - DRIZZLE_DATABASE_URL exists:', !!drizzleUrl);
      console.log('  - DATABASE_URL exists:', !!directUrl);

      if (drizzleUrl) {
        const maskedUrl = drizzleUrl.replace(/:([^@]+)@/, ':****@');
        console.log('  - Using DRIZZLE_DATABASE_URL:', maskedUrl);
      }
    }

    const databaseUrl = drizzleUrl || directUrl;

    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL or DRIZZLE_DATABASE_URL environment variable is not set.\n' +
        'Please check your .env file in apps/dashboard directory.'
      );
    }

    // Проверка: если URL содержит placeholder пароль
    if (databaseUrl.includes('[YOUR_PASSWORD]')) {
      throw new Error(
        'DRIZZLE_DATABASE_URL contains placeholder password [YOUR_PASSWORD].\n' +
        'Please update apps/dashboard/.env with the actual connection string.'
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // Cast to ExtendedPoolConfig to include the family property
    const poolConfig: ExtendedPoolConfig = {
      connectionString: databaseUrl,
      ssl: isProduction
        ? { rejectUnauthorized: true }  // Production: strict SSL validation
        : { rejectUnauthorized: false }, // Development: allow self-signed certs
      family: 4, // Force IPv4 to avoid DNS resolution issues
    };

    globalForDb.__pgPool = new Pool(poolConfig);

    if (!isProduction) {
      console.warn('⚠️  WARNING: SSL certificate validation is disabled in development mode');
      console.log('✅ Database pool initialized successfully');
    }
  }
  return globalForDb.__pgPool;
}

export function getDrizzleClient() {
  const client = getPgClient();
  return drizzle(client, { schema });
}

// ============================================================================
// Supabase Client (for RLS-enabled queries)
// ============================================================================

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// ============================================================================
// Export types
// ============================================================================

export type DB = ReturnType<typeof getDrizzleClient>;

export { schema };