import { Pool } from 'pg';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkAndApply() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking database state...\n');

    // Check if hwar tables exist
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'hwar_%'
      ORDER BY table_name
    `);

    console.log('✅ Existing HWAR tables:', tables.map(t => t.table_name).join(', ') || 'None');

    // Check if constraint exists
    const { rows: constraints } = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'hwar_scenarios'
      AND constraint_name = 'hwar_scenarios_duration_check'
    `);

    const hasConstraint = constraints.length > 0;
    console.log('✅ Duration constraint exists:', hasConstraint);

    // Check indexes
    const { rows: indexes } = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename LIKE 'hwar_%'
      ORDER BY indexname
    `);

    console.log('✅ HWAR indexes:', indexes.map(i => i.indexname).join(', ') || 'None');

    console.log('\n📝 Applying missing migrations...\n');

    // Apply migration 0002 parts that might be missing
    if (!hasConstraint) {
      console.log('Adding duration constraint...');
      await client.query(`
        ALTER TABLE "hwar_scenarios"
        ADD CONSTRAINT "hwar_scenarios_duration_check"
        CHECK ("duration_sec" BETWEEN 5 AND 300)
      `);
    }

    // These use IF NOT EXISTS so safe to run
    await client.query(`CREATE INDEX IF NOT EXISTS "hwar_harvests_created_at_idx" ON "hwar_harvests" ("created_at")`);
    await client.query(`CREATE INDEX IF NOT EXISTS "hwar_scenarios_created_at_idx" ON "hwar_scenarios" ("created_at")`);
    await client.query(`CREATE INDEX IF NOT EXISTS "hwar_scenarios_topic_idx" ON "hwar_scenarios" ("topic")`);

    console.log('✅ Migration 0002 complete');

    // Apply migration 0003
    console.log('\n📝 Applying migration 0003...');

    await client.query(`CREATE TABLE IF NOT EXISTS "hwar_analysis_tasks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "kind" text NOT NULL,
      "status" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS "hwar_batches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "kind" text NOT NULL,
      "status" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS "hwar_characters" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "meta" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS "hwar_datasets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS "hwar_presets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "meta" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS "hwar_queues" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "size" integer DEFAULT 0,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS "hwar_templates" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "meta" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS "hwar_workers" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "status" text NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    console.log('✅ Migration 0003 complete');

    // Final check
    console.log('\n🔍 Final database state:');
    const { rows: finalTables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'hwar_%'
      ORDER BY table_name
    `);

    console.log('\n✅ All HWAR tables:');
    finalTables.forEach(t => console.log(`   - ${t.table_name}`));

    console.log('\n🎉 All migrations applied successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndApply().catch(error => {
  console.error(error);
  process.exit(1);
});
