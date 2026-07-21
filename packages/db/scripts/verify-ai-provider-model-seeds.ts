import { config as loadEnv } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';

loadEnv({ path: path.resolve(process.cwd(), '../../.env') });

const mode = process.argv[2] ?? 'after';
if (!['before', 'after', 'idempotency'].includes(mode)) {
  throw new Error('Usage: tsx scripts/verify-ai-provider-model-seeds.ts [before|after|idempotency]');
}

const expectedProviders = ['google_gemini', 'minimax'] as const;
const expectedModels = [
  { id: 'gemini-2.0-flash-exp', providerId: 'google_gemini', type: 'text-to-text', isDefault: false },
  { id: 'gemini-1.5-pro', providerId: 'google_gemini', type: 'text-to-text', isDefault: false },
  { id: 'gemini-1.5-flash', providerId: 'google_gemini', type: 'text-to-text', isDefault: false },
  { id: 'gemini-2.5-flash-image', providerId: 'google_gemini', type: 'text-to-image', isDefault: true },
  { id: 'minimax-m2', providerId: 'minimax', type: 'text-to-text', isDefault: false },
  { id: 'minimax-halu-video', providerId: 'minimax', type: 'image-to-video', isDefault: true },
] as const;

async function main() {
  const connectionString = process.env.DRIZZLE_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or DRIZZLE_DATABASE_URL is required');

  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`Refusing non-local database host: ${url.hostname}`);
  }

  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const journal = JSON.parse(await readFile(path.join(migrationsDir, 'meta/_journal.json'), 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  const journalHashes = new Map<string, string>();
  for (const { tag } of journal.entries) {
    const sql = await readFile(path.join(migrationsDir, `${tag}.sql`), 'utf8');
    journalHashes.set(tag, createHash('sha256').update(sql).digest('hex'));
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const dbMigrations = await pool.query<{ hash: string }>(
      'select hash from drizzle.__drizzle_migrations order by created_at, id',
    );
    const expectedTags = mode === 'before'
      ? journal.entries.slice(0, -1).map(({ tag }) => tag)
      : journal.entries.map(({ tag }) => tag);
    const expectedHashes = expectedTags.map((tag) => journalHashes.get(tag)!);
    const actualHashes = dbMigrations.rows.map(({ hash }) => hash);

    if (actualHashes.length !== expectedHashes.length) {
      throw new Error(`Unexpected migration count: expected ${expectedHashes.length}, got ${actualHashes.length}`);
    }
    if (new Set(actualHashes).size !== actualHashes.length) {
      throw new Error('Duplicate migration hashes found in drizzle.__drizzle_migrations');
    }
    for (const hash of expectedHashes) {
      if (!actualHashes.includes(hash)) throw new Error(`Missing local journal hash: ${hash}`);
    }

    const targets = [...expectedProviders, ...expectedModels.map(({ id }) => id)];
    const providers = await pool.query<{ id: string }>(
      'select id from aes_core.ai_providers where id = any($1::text[]) order by id',
      [targets],
    );
    const models = await pool.query<{
      id: string;
      provider_id: string;
      type: string;
      is_default: boolean;
      is_enabled: boolean;
      cost_details: unknown;
      metadata: unknown;
    }>(
      `select id, provider_id, type, is_default, is_enabled, cost_details, metadata
       from aes_core.ai_models where id = any($1::text[]) order by id`,
      [targets],
    );

    if (mode === 'before') {
      if (providers.rows.length !== 0 || models.rows.length !== 0) {
        throw new Error('Target system IDs already exist; migration must not be applied without conflict review');
      }
      const existingProviders = await pool.query<{ id: string }>('select id from aes_core.ai_providers order by id');
      const existingModels = await pool.query<{ id: string }>('select id from aes_core.ai_models order by id');
      console.log(JSON.stringify({
        mode,
        host: url.hostname,
        migrations: actualHashes.length,
        providerCount: existingProviders.rows.length,
        providerIds: existingProviders.rows.map(({ id }) => id),
        modelCount: existingModels.rows.length,
        modelIds: existingModels.rows.map(({ id }) => id),
      }));
      return;
    }

    if (providers.rows.length !== expectedProviders.length || models.rows.length !== expectedModels.length) {
      throw new Error('Not all expected provider/model records are present');
    }
    for (const expected of expectedModels) {
      const row = models.rows.find(({ id }) => id === expected.id);
      if (!row || row.provider_id !== expected.providerId || row.type !== expected.type ||
        row.is_default !== expected.isDefault || !row.is_enabled || !row.cost_details || !row.metadata) {
        throw new Error(`Invalid seed contract for model ${expected.id}`);
      }
    }

    if (mode === 'after') {
      const dbModule = await import('@scrimspec/db');
      const { loadModelConfig } = await import(
        pathToFileURL(path.resolve(process.cwd(), '../hwar-core/src/ai/model-config.ts')).href
      );
      for (const expected of expectedModels) {
        const config = await loadModelConfig(expected.id);
        if (config.modelId !== expected.id || config.providerId !== expected.providerId || config.type !== expected.type) {
          throw new Error(`loadModelConfig returned an invalid contract for ${expected.id}`);
        }
      }
      await loadModelConfig('__seed_verification_missing__')
        .then(() => { throw new Error('Missing-model lookup unexpectedly succeeded'); })
        .catch((error: unknown) => {
          if (!(error instanceof Error) || error.message !== 'Model __seed_verification_missing__ not found or disabled') {
            throw error;
          }
        });
      await dbModule.getPgClient().end();
    }

    if (mode === 'idempotency') {
      const migrationSql = await readFile(path.join(migrationsDir, '0024_reconcile_ai_provider_model_seeds.sql'), 'utf8');
      await pool.query('begin');
      try {
        await pool.query(migrationSql);
        const counts = await pool.query<{ providers: string; models: string }>(
          `select
             (select count(*) from aes_core.ai_providers where id = any($1::text[])) as providers,
             (select count(*) from aes_core.ai_models where id = any($2::text[])) as models`,
          [expectedProviders, expectedModels.map(({ id }) => id)],
        );
        if (counts.rows[0]?.providers !== '2' || counts.rows[0]?.models !== '6') {
          throw new Error('Idempotency transaction changed target cardinality');
        }
      } finally {
        await pool.query('rollback');
      }
    }

    console.log(JSON.stringify({
      mode,
      host: url.hostname,
      migrations: actualHashes.length,
      migration0024Hash: journalHashes.get('0024_reconcile_ai_provider_model_seeds'),
      providerIds: providers.rows.map(({ id }) => id),
      modelIds: models.rows.map(({ id }) => id),
    }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
