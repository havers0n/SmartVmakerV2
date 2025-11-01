import { config as dotenvConfig } from 'dotenv';
import type { Config } from 'drizzle-kit';
import { resolve } from 'path';

// Load .env from project root (two levels up from packages/db)
dotenvConfig({ path: resolve(__dirname, '../../.env') });

export default {
  schema: './migrations/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DRIZZLE_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost/scrimspec',
  },
  strict: true,
  verbose: true,
} satisfies Config;
