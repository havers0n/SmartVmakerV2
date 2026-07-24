import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";

const TARGETS = [
  {
    tag: "0028_generation_run_foundation",
    objects: [
      "generation_pipeline.video_projects",
      "generation_pipeline.generation_runs",
    ],
  },
  {
    tag: "0029_durable_scenario_execution",
    objects: [
      "generation_pipeline.scenario_generation_attempts",
      "generation_pipeline.scenario_artifacts",
      "jobs.scenario_generation_job_queue",
    ],
  },
  {
    tag: "0030_creation_wizard_v2_content_formats",
    objects: [],
    columns: [
      "public.content_formats.example_output",
      "public.content_formats.input_schema",
      "public.content_formats.production_defaults",
      "public.content_formats.production_rules",
      "generation_pipeline.video_projects.client_submission_id",
      "generation_pipeline.generation_runs.client_submission_id",
    ],
    constraints: [
      "public.content_formats.content_formats_input_schema_object_check",
      "public.content_formats.content_formats_production_defaults_object_check",
      "generation_pipeline.video_projects.video_projects_owner_submission_unique",
      "generation_pipeline.generation_runs.generation_runs_project_submission_unique",
    ],
  },
  {
    tag: "0031_allow_versioned_content_format_production_contracts",
    objects: [],
    constraints: [
      "public.content_formats.content_formats_production_rules_contract_v1_check",
    ],
  },
  {
    tag: "0032_approved_scenario_revisions",
    objects: [
      "generation_pipeline.approved_scenario_revisions",
      "generation_pipeline.current_approved_scenario_revisions",
    ],
  },
];

/**
 * Normalise only line endings. Trailing newlines remain significant so that
 * the canonical hash still changes for an actual file-content change.
 */
export function canonicalizeMigrationSql(sql) {
  return sql.replace(/\r\n|\r/g, "\n");
}

export function hashMigrationSql(sql) {
  return {
    executionHash: createHash("sha256").update(sql, "utf8").digest("hex"),
    canonicalHash: createHash("sha256")
      .update(canonicalizeMigrationSql(sql), "utf8")
      .digest("hex"),
  };
}

export function classifyGenerationMigrationState(targets) {
  const [migration0028, migration0029, migration0030, migration0031, migration0032] = targets;
  for (const target of targets) {
    if (target.hashMismatch) {
      return {
        safe: false,
        code: `${target.tag}_HASH_MISMATCH`,
        message: `${target.tag} journal timestamp exists with a different SQL hash`,
      };
    }
    if (target.objectCount !== 0 && target.objectCount !== target.objectTotal) {
      return {
        safe: false,
        code: `${target.tag}_PARTIAL_SCHEMA`,
        message: `${target.tag} has only ${target.objectCount}/${target.objectTotal} expected objects`,
      };
    }
    if (target.schemaPresent && !target.journalPresent) {
      return {
        safe: false,
        code: `${target.tag}_SCHEMA_WITHOUT_JOURNAL`,
        message: `${target.tag} exists in schema but is absent from the Drizzle journal`,
      };
    }
    if (!target.schemaPresent && target.journalPresent) {
      return {
        safe: false,
        code: `${target.tag}_JOURNAL_WITHOUT_SCHEMA`,
        message: `${target.tag} exists in the Drizzle journal but its schema objects are absent`,
      };
    }
  }
  if (migration0029.schemaPresent && !migration0028.schemaPresent) {
    return {
      safe: false,
      code: "0029_WITHOUT_0028",
      message: "0029 objects exist without the 0028 foundation",
    };
  }
  if (migration0030.schemaPresent && !migration0029.schemaPresent) {
    return {
      safe: false,
      code: "0030_WITHOUT_0029",
      message: "0030 objects exist without the 0029 durable scenario pipeline",
    };
  }
  if (migration0031.schemaPresent && !migration0030.schemaPresent) {
    return {
      safe: false,
      code: "0031_WITHOUT_0030",
      message: "0031 exists without 0030",
    };
  }
  if (migration0032.schemaPresent && !migration0031.schemaPresent) {
    return { safe: false, code: "0032_WITHOUT_0031", message: "0032 exists without 0031" };
  }
  if (
    migration0028.journalPresent &&
    migration0029.journalPresent &&
    migration0028.createdAt >= migration0029.createdAt
  ) {
    return {
      safe: false,
      code: "MIGRATION_ORDER_INVALID",
      message: "0028 must precede 0029 in the Drizzle journal",
    };
  }
  if (
    migration0030.journalPresent &&
    migration0031.journalPresent &&
    migration0030.createdAt >= migration0031.createdAt
  ) {
    return {
      safe: false,
      code: "MIGRATION_ORDER_INVALID",
      message: "0030 must precede 0031",
    };
  }
  if (migration0031.journalPresent && migration0032.journalPresent && migration0031.createdAt >= migration0032.createdAt) {
    return { safe: false, code: "MIGRATION_ORDER_INVALID", message: "0031 must precede 0032" };
  }
  if (
    migration0029.journalPresent &&
    migration0030.journalPresent &&
    migration0029.createdAt >= migration0030.createdAt
  ) {
    return {
      safe: false,
      code: "MIGRATION_ORDER_INVALID",
      message: "0029 must precede 0030 in the Drizzle journal",
    };
  }
  if (!migration0028.schemaPresent && !migration0028.journalPresent) {
    return {
      safe: true,
    code: "APPLY_0028_THEN_0029_THEN_0030_THEN_0031_THEN_0032",
    message: "Safe to apply 0028 followed by 0029, 0030, 0031 and 0032",
    };
  }
  if (migration0028.schemaPresent && !migration0029.schemaPresent) {
    return {
      safe: true,
      code: "APPLY_0029_THEN_0030",
      message: "Safe to apply 0029 followed by 0030",
    };
  }
  if (migration0029.schemaPresent && !migration0030.schemaPresent) {
    return {
      safe: true,
      code: "APPLY_0030",
      message: "Safe to apply 0030",
    };
  }
  if (migration0030.schemaPresent && !migration0031.schemaPresent) {
    return { safe: true, code: "APPLY_0031", message: "Safe to apply 0031" };
  }
  if (migration0031.schemaPresent && !migration0032.schemaPresent) {
    return { safe: true, code: "APPLY_0032", message: "Safe to apply 0032" };
  }
  return {
    safe: true,
    code: "UP_TO_DATE",
    message: "0028 through 0032 are present in schema and journal",
  };
}

async function loadLocalTargets(migrationsDir) {
  const journal = JSON.parse(
    await readFile(path.join(migrationsDir, "meta/_journal.json"), "utf8"),
  );
  return Promise.all(
    TARGETS.map(async (target) => {
      const entry = journal.entries.find(({ tag }) => tag === target.tag);
      if (!entry)
        throw new Error(`Local migration journal is missing ${target.tag}`);
      const sql = await readFile(
        path.join(migrationsDir, `${target.tag}.sql`),
        "utf8",
      );
      const hashes = hashMigrationSql(sql);
      return {
        ...target,
        // Drizzle records the raw bytes it executes. Keep that comparison
        // exact, while also retaining an LF-normalised repository identity
        // for diagnostics across Windows and Unix checkouts.
        ...hashes,
        localCreatedAt: entry.when,
      };
    }),
  );
}

async function inspectDatabase(client, localTargets) {
  const journalRelations = await client.query(
    `select to_regclass('drizzle.__drizzle_migrations')::text as drizzle,
            to_regclass('public.__drizzle_migrations')::text as public`,
  );
  const relation = journalRelations.rows[0]?.drizzle
    ? "drizzle.__drizzle_migrations"
    : journalRelations.rows[0]?.public
      ? "public.__drizzle_migrations"
      : null;
  const journal = relation
    ? await client.query(
        `select id, hash, created_at from ${relation} order by created_at, id`,
      )
    : { rows: [] };
  if (
    new Set(journal.rows.map(({ hash }) => hash)).size !== journal.rows.length
  ) {
    throw new Error("Duplicate hashes exist in the Drizzle migration journal");
  }

  const objectNames = localTargets.flatMap(({ objects }) => objects);
  const objects = await client.query(
    "select target, to_regclass(target)::text as relation from unnest($1::text[]) target",
    [objectNames],
  );
  const present = new Set(
    objects.rows
      .filter(({ relation: value }) => value)
      .map(({ target }) => target),
  );
  const columnNames = localTargets.flatMap(({ columns = [] }) => columns);
  const columns = columnNames.length
    ? await client.query(
        `select table_schema || '.' || table_name || '.' || column_name as target
         from information_schema.columns
         where table_schema || '.' || table_name || '.' || column_name = any($1::text[])`,
        [columnNames],
      )
    : { rows: [] };
  for (const { target } of columns.rows) present.add(target);
  const constraintNames = localTargets.flatMap(
    ({ constraints = [] }) => constraints,
  );
  const constraints = constraintNames.length
    ? await client.query(
        `select n.nspname || '.' || c.relname || '.' || p.conname as target
         from pg_constraint p
         join pg_class c on c.oid = p.conrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname || '.' || c.relname || '.' || p.conname = any($1::text[])`,
        [constraintNames],
      )
    : { rows: [] };
  for (const { target } of constraints.rows) present.add(target);
  return localTargets.map((target) => {
    const executionMatches = journal.rows.filter(
      ({ hash }) => hash === target.executionHash,
    );
    const canonicalMatches = journal.rows.filter(
      ({ hash }) => hash === target.canonicalHash,
    );
    const matches = [
      ...new Map(
        [...executionMatches, ...canonicalMatches].map((row) => [row.id, row]),
      ).values(),
    ];
    const timestampMatches = journal.rows.filter(
      ({ created_at }) => Number(created_at) === target.localCreatedAt,
    );
    if (matches.length > 1)
      throw new Error(`Duplicate journal entry for ${target.tag}`);
    const expectedObjects = [
      ...target.objects,
      ...(target.columns ?? []),
      ...(target.constraints ?? []),
    ];
    const objectCount = expectedObjects.filter((object) =>
      present.has(object),
    ).length;
    return {
      tag: target.tag,
      executionHash: target.executionHash,
      canonicalHash: target.canonicalHash,
      localCreatedAt: target.localCreatedAt,
      journalPresent: matches.length === 1,
      hashMatchKind: executionMatches.length
        ? "execution"
        : canonicalMatches.length
          ? "canonical_line_endings"
          : null,
      hashMismatch:
        timestampMatches.length > 0 &&
        !timestampMatches.some(
          ({ hash }) =>
            hash === target.executionHash || hash === target.canonicalHash,
        ),
      createdAt:
        matches[0]?.created_at == null ? null : Number(matches[0].created_at),
      objectCount,
      objectTotal: expectedObjects.length,
      schemaPresent: objectCount === expectedObjects.length,
      objects: expectedObjects.map((name) => ({
        name,
        present: present.has(name),
      })),
    };
  });
}

export async function main() {
  const connectionString = process.env.READONLY_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "READONLY_DATABASE_URL is required; deployment credentials are intentionally not used",
    );
  }
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const localTargets = await loadLocalTargets(migrationsDir);
  const databaseUrl = new URL(connectionString);
  const pool = new Pool({
    connectionString,
    ssl:
      databaseUrl.searchParams.get("sslmode") === "disable"
        ? false
        : { rejectUnauthorized: false },
    max: 1,
  });
  let targets;
  try {
    const client = await pool.connect();
    try {
      await client.query("begin read only");
      targets = await inspectDatabase(client, localTargets);
      await client.query("rollback");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  const classification = classifyGenerationMigrationState(targets);
  console.log(JSON.stringify({ classification, targets }, null, 2));
  if (!classification.safe) process.exitCode = 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
