# PR 2B: durable scenario execution

## Architecture audit and decisions

PR 2A stores editable defaults in `generation_pipeline.video_projects` and an
immutable, resolved snapshot in `generation_pipeline.generation_runs`. A Run is
created as `status=draft`, `stage=scenario`; DB triggers reject changes to its
identity and snapshot fields while allowing only operational status/timestamp
updates.

The legacy generation handler compiled the AES scenario prompt and called the
MiniMax/HALU text client inline. PR #8 supplied the shared strict Zod validator,
controlled parsing for a string-valued `scenarios`, finish-reason checks, and
typed truncated/invalid-response errors. PR 2B reuses those contracts in both
the legacy handler and the worker.

The repository already has PostgreSQL queues in the `jobs` schema and workers
with transactional `FOR UPDATE ... SKIP LOCKED` claims and leases. Therefore PR
2B extends that architecture instead of introducing a third queue system:

- attempts: `generation_pipeline.scenario_generation_attempts`;
- validated results: `generation_pipeline.scenario_artifacts`;
- durable event: `jobs.scenario_generation_job_queue`;
- worker: `packages/workers/src/scenario-worker.ts`, launched by the single
  `worker:scenario` PM2 definition, separately from the dashboard.

The canonical stage state is derived from the latest Attempt plus the immutable
Artifact: `not_started`, `queued`, `running`, `ready`, or `failed`. The Run stays
`status=active`, `stage=scenario` when scenario generation is ready; no duplicate
stage-status column is maintained.

Every POST transaction commits Run, Attempt, and queue event before the worker
can claim it. `UNIQUE (run_id, idempotency_key)` makes a repeated POST return the
existing Attempt. Retry appends a new numbered Attempt. A claimed job is never
automatically replayed after its lease expires because provider submission may
already have occurred; it becomes an explicit failure and requires a manual
retry.

Execution is durable and idempotent before provider submission and after
terminal persistence. A crash after provider success but before local
persistence may require a manual retry and can result in a duplicate paid
provider call.

## API

- `POST .../scenario-attempts` queues work and requires `Idempotency-Key`;
- `GET .../scenario-attempts` returns safe Attempt summaries and stage state;
- `GET .../scenario-attempts/:attemptId` returns one safe Attempt detail;
- Run detail includes the same derived scenario execution summary.

`diagnostic_payload` is server-only. It contains bounded metadata and at most a
4,000-character provider fragment; the DB rejects values larger than 16 KiB.

## Required migration preflight

The preflight reports two SQL identities for each migration: the raw execution
hash used by Drizzle and an LF-normalised canonical hash. The former must match
Drizzle exactly; the latter makes a CRLF/LF-only checkout difference visible as
`canonical_line_endings` instead of misreporting it as changed SQL. Trailing
newlines remain significant in both identities.

Before any deployment, run with credentials that are themselves read-only:

```powershell
$env:READONLY_DATABASE_URL = '<read-only postgres URL>'
pnpm db:migrations:preflight
```

The script starts a `BEGIN READ ONLY` transaction, reads the Drizzle history,
checks all five 0028/0029 relations with `to_regclass`, and compares the stored
hashes/order with the SHA-256 hashes of the local migration files. It never
writes migration history or schema.

| Observed state                                                     | Classification                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| 0028 absent from schema and journal; 0029 absent                   | apply 0028, then 0029                                       |
| 0028 present in schema and journal; 0029 absent                    | apply 0029                                                  |
| 0028 present in schema but absent from journal                     | drift; deployment blocked pending controlled reconciliation |
| 0028 present in journal but absent from schema                     | corrupt state; deployment blocked                           |
| any partial 0028/0029 object set, hash mismatch, or reversed order | deployment blocked                                          |
| both migrations present in schema and journal                      | up to date                                                  |

Reconciliation is deliberately not automated. Operators must compare the actual
schema, exact local hash, and migration order before making a controlled journal
change.

Equivalent inspection SQL used by the preflight includes:

```sql
SELECT id, hash, created_at
FROM drizzle.__drizzle_migrations
ORDER BY created_at, id;

SELECT to_regclass('generation_pipeline.video_projects');
SELECT to_regclass('generation_pipeline.generation_runs');
SELECT to_regclass('generation_pipeline.scenario_generation_attempts');
SELECT to_regclass('generation_pipeline.scenario_artifacts');
SELECT to_regclass('jobs.scenario_generation_job_queue');
```
