import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getPgClient, getDrizzleClient } from './src/client';
import path from 'path';

async function runMigrations() {
  const dbClient = getPgClient();
  const db = getDrizzleClient();

  try {
    console.log('Running migrations...');

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
