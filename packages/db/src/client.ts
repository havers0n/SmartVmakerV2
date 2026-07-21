import { drizzle } from 'drizzle-orm/node-postgres';
import { createClient } from '@supabase/supabase-js';
import { Pool, PoolConfig } from 'pg';
import { is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

import * as schema from '../migrations/schema';

if (
  process.env.NODE_ENV === 'production' &&
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
) {
  throw new Error(
    'NODE_TLS_REJECT_UNAUTHORIZED=0 is forbidden in production. Use a valid CA certificate instead.',
  );
}

// ============================================================================
// Database Connection Factory with Hot Reload Support
// ============================================================================

// Extend PoolConfig to include the family property
interface ExtendedPoolConfig extends PoolConfig {
  family?: number;
}

export function resolveDatabaseSsl(url: string, nodeEnv = process.env.NODE_ENV, mode = process.env.SCRIMSPEC_DB_SSL): PoolConfig["ssl"] {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (local || mode === "disable") {
    if (!local && nodeEnv === "production") throw new Error("SCRIMSPEC_DB_SSL=disable is forbidden for remote production databases");
    return false;
  }
  if (mode === "allow-self-signed") {
    if (nodeEnv === "production") throw new Error("Self-signed database TLS is forbidden in production");
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

// Use globalThis to preserve pool and drizzle across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __pgPoolEnv: string | undefined;
  // eslint-disable-next-line no-var
  var __drizzle: ReturnType<typeof drizzle> | undefined;
}

export function getPgClient(): Pool {
  const currentEnv = process.env.NODE_ENV || 'development';

  // Recreate pool if NODE_ENV changed (e.g., from production to development during hot reload)
  const envChanged = globalThis.__pgPoolEnv && globalThis.__pgPoolEnv !== currentEnv;

  if (envChanged && globalThis.__pgPool) {
    globalThis.__pgPool.end().catch(() => {});
    globalThis.__pgPool = undefined;
    globalThis.__drizzle = undefined; // Invalidate drizzle when pool is recreated
  }

  if (!globalThis.__pgPool) {
    // Приоритет - пулер. Если его нет - обычный URL.
    const drizzleUrl = process.env.DRIZZLE_DATABASE_URL;
    const directUrl = process.env.DATABASE_URL;

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

    // Cast to ExtendedPoolConfig to include the family property
    const poolConfig: ExtendedPoolConfig = {
      connectionString: databaseUrl,
      ssl: resolveDatabaseSsl(databaseUrl),
      family: 4, // Force IPv4 to avoid DNS resolution issues

      // Connection Pool Configuration (Production-Ready)
      max: 20,                        // Maximum number of clients in the pool
      connectionTimeoutMillis: 5000,  // Max time to wait for a connection (5 seconds)
      idleTimeoutMillis: 30000,       // Close idle clients after 30 seconds

      // Additional resilience parameters
      allowExitOnIdle: false,         // Keep pool alive even when idle
      statement_timeout: 60000,       // Query timeout: 60 seconds
    };

    const pool = new Pool(poolConfig);

    // Add error handler to prevent unhandled rejection crashes
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

    globalThis.__pgPool = pool;
    globalThis.__pgPoolEnv = currentEnv;

  }
  return globalThis.__pgPool;
}

export function getDrizzleClient() {
  // Cache drizzle instance to avoid recreating it on every call
  if (!globalThis.__drizzle) {
    const client = getPgClient();

    // Фильтруем schema, оставляя только таблицы (PgTable)
    // Исключаем enum'ы, pgSchema объекты и другие сущности
    const tablesOnly = Object.fromEntries(
      Object.entries(schema).filter(([_, value]) => {
        return is(value, PgTable);
      })
    );

    globalThis.__drizzle = drizzle(client, { schema: tablesOnly });

  }
  return globalThis.__drizzle;
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
