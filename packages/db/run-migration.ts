import { config } from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getPgClient, getDrizzleClient } from './src/client';
import path from 'path';

// Load .env from project root
config({ path: path.resolve(__dirname, '../../.env') });

async function runMigrations() {
  console.log('📦 Environment loaded');
  console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');

  const dbClient = getPgClient();
  const db = getDrizzleClient();

  try {
    console.log('🚀 Running migrations...');

    const migrationsFolder = path.resolve(process.cwd(), 'migrations');
    await migrate(db, { migrationsFolder });

    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

runMigrations();
