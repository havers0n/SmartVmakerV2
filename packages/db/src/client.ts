import { drizzle } from 'drizzle-orm/postgres-js';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

import * as schema from './schema';

// ============================================================================
// Database Connection Factory
// ============================================================================

let pgClient: postgres.Sql | null = null;

export function getPgClient(): postgres.Sql {
  if (!pgClient) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pgClient = postgres(databaseUrl);
  }
  return pgClient;
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
