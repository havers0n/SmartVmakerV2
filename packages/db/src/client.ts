import { drizzle } from 'drizzle-orm/node-postgres';
import { createClient } from '@supabase/supabase-js';
import { Pool, PoolConfig } from 'pg';
import { is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

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
  __pgPoolEnv: string | undefined;
};

export function getPgClient(): Pool {
  const isDev = process.env.NODE_ENV !== 'production';
  const currentEnv = process.env.NODE_ENV || 'development';

  // Recreate pool if NODE_ENV changed (e.g., from production to development during hot reload)
  const envChanged = globalForDb.__pgPoolEnv && globalForDb.__pgPoolEnv !== currentEnv;

  if (envChanged && globalForDb.__pgPool) {
    if (isDev) {
      console.log(`🔄 Environment changed from ${globalForDb.__pgPoolEnv} to ${currentEnv}, recreating pool...`);
    }
    globalForDb.__pgPool.end().catch(() => {});
    globalForDb.__pgPool = undefined;
  }

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

    globalForDb.__pgPool = pool;
    globalForDb.__pgPoolEnv = currentEnv;

    if (!isProduction) {
      console.warn('⚠️  WARNING: SSL certificate validation is disabled in development mode');
      console.log('✅ Database pool initialized successfully');
      console.log('📊 Pool config:', {
        max: poolConfig.max,
        connectionTimeout: `${poolConfig.connectionTimeoutMillis}ms`,
        idleTimeout: `${poolConfig.idleTimeoutMillis}ms`,
        statementTimeout: `${poolConfig.statement_timeout}ms`,
      });
    }
  }
  return globalForDb.__pgPool;
}

export function getDrizzleClient() {
  const client = getPgClient();

  // Фильтруем schema, оставляя только таблицы (PgTable)
  // Исключаем enum'ы, pgSchema объекты и другие сущности
  const tablesOnly = Object.fromEntries(
    Object.entries(schema).filter(([_, value]) => {
      return is(value, PgTable);
    })
  );

  return drizzle(client, { schema: tablesOnly });
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