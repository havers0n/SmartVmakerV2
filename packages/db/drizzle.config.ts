import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/scrimspec',
  },
  migrations: {
    prefix: 'timestamp',
  },
  strict: true,
  verbose: true,
} satisfies Config;
