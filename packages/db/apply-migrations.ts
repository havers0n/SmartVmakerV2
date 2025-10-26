import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig({ path: resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applyMigrations() {
  const client = await pool.connect();

  try {
    console.log('🔄 Connecting to database...');

    // Create drizzle migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);

    // Check which migrations have been applied
    const { rows: appliedMigrations } = await client.query(
      'SELECT hash FROM drizzle.__drizzle_migrations'
    );
    const appliedHashes = new Set(appliedMigrations.map(m => m.hash));

    const migrations = [
      { file: '0001_panoramic_tinkerer.sql', hash: 'panoramic_tinkerer' },
      { file: '0002_abandoned_may_parker.sql', hash: 'abandoned_may_parker' },
      { file: '0003_dapper_quentin_quire.sql', hash: 'dapper_quentin_quire' }
    ];

    for (const migration of migrations) {
      if (appliedHashes.has(migration.hash)) {
        console.log(`⏭️  Skipping ${migration.file} (already applied)`);
        continue;
      }

      console.log(`📝 Applying ${migration.file}...`);

      const sql = readFileSync(
        resolve(__dirname, 'migrations', migration.file),
        'utf-8'
      );

      // Split by statement-breakpoint and execute each statement
      const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

      await client.query('BEGIN');

      try {
        for (const statement of statements) {
          if (statement) {
            await client.query(statement);
          }
        }

        // Record migration
        await client.query(
          'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
          [migration.hash, Date.now()]
        );

        await client.query('COMMIT');
        console.log(`✅ Applied ${migration.file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('\n🎉 All migrations applied successfully!');

  } catch (error) {
    console.error('❌ Error applying migrations:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigrations().catch(error => {
  console.error(error);
  process.exit(1);
});
