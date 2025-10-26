import type { Config } from 'drizzle-kit';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (two levels up from packages/db)
dotenvConfig({ path: resolve(__dirname, '../../.env') });

export default {
  schema: './src/schema',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || 'postgresql://localhost/scrimspec',
  },
  strict: true,
  verbose: true,
} satisfies Config;
