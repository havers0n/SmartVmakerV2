import { Pool } from 'pg';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  family: 4, // Force IPv4 to avoid DNS resolution issues
});

async function checkQueueTables() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking queue tables...\n');

    // Check if ingest_queue exists
    const { rows: ingestTable } = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'ingest_queue'
    `);

    console.log('ingest_queue tables:', ingestTable.length > 0 ? 'FOUND' : 'NOT FOUND');
    ingestTable.forEach(t => console.log(`  - ${t.table_schema}.${t.table_name}`));

    // Check if analysis_queue exists
    const { rows: analysisTable } = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'analysis_queue'
    `);

    console.log('\nanalysis_queue tables:', analysisTable.length > 0 ? 'FOUND' : 'NOT FOUND');
    analysisTable.forEach(t => console.log(`  - ${t.table_schema}.${t.table_name}`));

    // If exists in public schema, show structure
    if (ingestTable.some(t => t.table_schema === 'public')) {
      const { rows: columns } = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ingest_queue'
        ORDER BY ordinal_position
      `);

      console.log('\npublic.ingest_queue columns:');
      columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type}, ${c.is_nullable === 'YES' ? 'nullable' : 'not null'})`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkQueueTables();
