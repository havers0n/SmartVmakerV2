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
];

export function classifyGenerationMigrationState(targets) {
  const [migration0028, migration0029] = targets;
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
  if (!migration0028.schemaPresent && !migration0028.journalPresent) {
    return {
      safe: true,
      code: "APPLY_0028_THEN_0029",
      message: "Safe to apply 0028 followed by 0029",
    };
  }
  if (migration0028.schemaPresent && !migration0029.schemaPresent) {
    return {
      safe: true,
      code: "APPLY_0029",
      message: "Safe to apply 0029",
    };
  }
  return {
    safe: true,
    code: "UP_TO_DATE",
    message: "0028 and 0029 are present in schema and journal",
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
      return {
        ...target,
        localHash: createHash("sha256").update(sql).digest("hex"),
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
  return localTargets.map((target) => {
    const matches = journal.rows.filter(
      ({ hash }) => hash === target.localHash,
    );
    const timestampMatches = journal.rows.filter(
      ({ created_at }) => Number(created_at) === target.localCreatedAt,
    );
    if (matches.length > 1)
      throw new Error(`Duplicate journal entry for ${target.tag}`);
    const objectCount = target.objects.filter((object) =>
      present.has(object),
    ).length;
    return {
      tag: target.tag,
      localHash: target.localHash,
      localCreatedAt: target.localCreatedAt,
      journalPresent: matches.length === 1,
      hashMismatch:
        timestampMatches.length > 0 &&
        !timestampMatches.some(({ hash }) => hash === target.localHash),
      createdAt:
        matches[0]?.created_at == null ? null : Number(matches[0].created_at),
      objectCount,
      objectTotal: target.objects.length,
      schemaPresent: objectCount === target.objects.length,
      objects: target.objects.map((name) => ({
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
