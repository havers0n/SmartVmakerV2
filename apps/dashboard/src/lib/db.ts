/**
 * Database client for Next.js dashboard
 * Ensures single pooled connection with hot reload support
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@scrimspec/db/schema';

// Use globalThis to preserve pool across Next.js hot reloads
const globalForDb = globalThis as unknown as {
  __dbPool: Pool | undefined;
};

function getPool(): Pool {
  if (!globalForDb.__dbPool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    globalForDb.__dbPool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalForDb.__dbPool;
}

export const db = drizzle(getPool(), { schema });

export { schema };
