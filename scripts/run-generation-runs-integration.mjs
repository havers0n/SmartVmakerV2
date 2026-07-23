import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = process.cwd();
const container =
  process.env.SCRIMSPEC_INTEGRATION_CONTAINER ??
  "scrimspec_generation_runs_integration";
const port = process.env.SCRIMSPEC_INTEGRATION_PORT ?? "55439";
const setupOnly = process.env.SCRIMSPEC_INTEGRATION_SETUP_ONLY === "1";
const keepDatabase = process.env.SCRIMSPEC_INTEGRATION_KEEP_DB === "1";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
let containerCreated = false;
const foundationMigration = readFileSync(
  resolve(root, "packages/db/migrations/0028_generation_run_foundation.sql"),
  "utf8",
);
const scenarioMigration = readFileSync(
  resolve(root, "packages/db/migrations/0029_durable_scenario_execution.sql"),
  "utf8",
);
const creationWizardMigration = readFileSync(
  resolve(
    root,
    "packages/db/migrations/0030_creation_wizard_v2_content_formats.sql",
  ),
  "utf8",
);
const productionContractMigration = readFileSync(
  resolve(
    root,
    "packages/db/migrations/0031_allow_versioned_content_format_production_contracts.sql",
  ),
  "utf8",
);
const migrationJournal = JSON.parse(
  readFileSync(
    resolve(root, "packages/db/migrations/meta/_journal.json"),
    "utf8",
  ),
);
const foundationJournalEntry = migrationJournal.entries.find(
  ({ tag }) => tag === "0028_generation_run_foundation",
);
const scenarioJournalEntry = migrationJournal.entries.find(
  ({ tag }) => tag === "0029_durable_scenario_execution",
);
const creationWizardJournalEntry = migrationJournal.entries.find(
  ({ tag }) => tag === "0030_creation_wizard_v2_content_formats",
);
const productionContractJournalEntry = migrationJournal.entries.find(
  ({ tag }) =>
    tag === "0031_allow_versioned_content_format_production_contracts",
);
if (
  !foundationJournalEntry ||
  !scenarioJournalEntry ||
  !creationWizardJournalEntry ||
  !productionContractJournalEntry
) {
  throw new Error(
    "0028, 0029, 0030 and 0031 must be present in the local migration journal",
  );
}
const migrationHistory = `
CREATE SCHEMA drizzle;
CREATE TABLE drizzle.__drizzle_migrations (
  id serial PRIMARY KEY, hash text NOT NULL, created_at bigint
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
  ('${createHash("sha256").update(foundationMigration).digest("hex")}', ${foundationJournalEntry.when}),
  ('${createHash("sha256").update(scenarioMigration).digest("hex")}', ${scenarioJournalEntry.when}),
  ('${createHash("sha256").update(creationWizardMigration).digest("hex")}', ${creationWizardJournalEntry.when}),
  ('${createHash("sha256").update(productionContractMigration).digest("hex")}', ${productionContractJournalEntry.when});
`;

const bootstrap = `
CREATE SCHEMA aes_core;
CREATE SCHEMA generation_pipeline;
CREATE SCHEMA jobs;
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE content_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL,
  description text, status text NOT NULL DEFAULT 'draft', format_type text NOT NULL DEFAULT 'mixed',
  hook_pattern text, structure_pattern text, visual_pattern text, pacing_pattern text,
  target_duration_min_seconds integer, target_duration_max_seconds integer, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE aes_core.story_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, tags text[],
  target_duration_seconds integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE aes_core.beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid NOT NULL REFERENCES aes_core.story_templates(id) ON DELETE CASCADE,
  "order" integer NOT NULL, phase text NOT NULL, duration_seconds numeric NOT NULL, description text NOT NULL,
  action_prompt text, emotion text NOT NULL, contrast text, intended_impact text, meta jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE aes_core.ai_models (
  id text PRIMARY KEY, provider_id text NOT NULL, is_enabled boolean NOT NULL DEFAULT true,
  type text NOT NULL, capabilities text[] NOT NULL DEFAULT '{}'
);
INSERT INTO aes_core.ai_models (id, provider_id, type, capabilities) VALUES
  ('minimax-m2', 'minimax', 'text-to-text', ARRAY['function_calling']),
  ('gemini-2.5-flash-image', 'google_gemini', 'text-to-image', ARRAY[]::text[]),
  ('minimax-halu-video', 'minimax', 'image-to-video', ARRAY[]::text[]);
CREATE TABLE generation_pipeline.generation_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid, template_id uuid, content_format_id uuid,
  status text NOT NULL DEFAULT 'pending', stage text NOT NULL DEFAULT 'init', final_video_url text,
  api_cost_usd numeric(10,4) NOT NULL DEFAULT 0, channel_id text, error_message text, minimax_cost numeric,
  upload_status text, youtube_video_id text, meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
`;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
}

function psql(input) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { cwd: root, input, stdio: ["pipe", "inherit", "inherit"] },
  );
  if (result.status !== 0)
    throw new Error("Temporary integration database setup failed");
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync(
      "docker",
      ["exec", container, "pg_isready", "-U", "postgres"],
      {
        cwd: root,
        stdio: "ignore",
      },
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error("Temporary integration PostgreSQL did not become ready");
}

try {
  const existing = execFileSync(
    "docker",
    ["ps", "-a", "--filter", `name=^/${container}$`, "--format", "{{.Names}}"],
    {
      cwd: root,
      encoding: "utf8",
    },
  ).trim();
  if (existing)
    throw new Error(`Temporary container already exists: ${existing}`);

  run("docker", [
    "run",
    "--name",
    container,
    "-p",
    `${port}:5432`,
    "--user",
    "postgres",
    "--entrypoint",
    "bash",
    "-d",
    "public.ecr.aws/supabase/postgres:17.6.1.121",
    "-c",
    "initdb -D /tmp/verifydata -U postgres --auth-local=trust --auth-host=trust && printf 'host all all 0.0.0.0/0 trust\\n' >> /tmp/verifydata/pg_hba.conf && exec postgres -D /tmp/verifydata -c listen_addresses='*'",
  ]);
  containerCreated = true;
  waitForPostgres();
  psql(bootstrap);
  psql(foundationMigration);
  psql(scenarioMigration);
  psql(creationWizardMigration);
  psql(productionContractMigration);
  psql(migrationHistory);
  run(pnpm, ["--filter", "@scrimspec/db", "migrations:preflight:generation"], {
    shell: process.platform === "win32",
    env: {
      ...process.env,
      READONLY_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres?sslmode=disable`,
    },
  });
  run(pnpm, ["--filter", "@scrimspec/db", "build"], {
    shell: process.platform === "win32",
  });
  if (setupOnly) {
    console.log(
      `Temporary PostgreSQL is ready at postgresql://postgres@127.0.0.1:${port}/postgres`,
    );
  } else {
    run(
      pnpm,
      [
        "--filter",
        "dashboard",
        "exec",
        "vitest",
        "run",
        "--no-file-parallelism",
        "src/server/generation-runs.integration.test.ts",
        "src/server/scenario-execution.integration.test.ts",
        "src/server/creation-v2.integration.test.ts",
        "src/server/content-format-production-rules.integration.test.ts",
      ],
      {
        shell: process.platform === "win32",
        env: {
          ...process.env,
          CREATION_V2_INTEGRATION: "1",
          DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
          DRIZZLE_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
        },
      },
    );
    run(
      pnpm,
      [
        "--filter",
        "@scrimspec/workers",
        "exec",
        "vitest",
        "run",
        "src/__tests__/scenario-worker.integration.test.ts",
      ],
      {
        shell: process.platform === "win32",
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
          DRIZZLE_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
        },
      },
    );
  }
} finally {
  if (containerCreated && !keepDatabase) {
    spawnSync("docker", ["rm", "-f", container], {
      cwd: root,
      stdio: "ignore",
    });
  }
}
