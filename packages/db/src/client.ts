import { drizzle } from 'drizzle-orm/node-postgres';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

import * as schema from './schema';

// ============================================================================
// Database Connection Factory with Hot Reload Support
// ============================================================================

// Use globalThis to preserve pool across hot reloads in development
const globalForDb = globalThis as unknown as {
  __pgPool: Pool | undefined;
};

export function getPgClient(): Pool {
  if (!globalForDb.__pgPool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    globalForDb.__pgPool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : undefined,
    });
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
