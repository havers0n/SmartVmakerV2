import { sql } from "drizzle-orm";
import type { Logger } from "./shared-types.js";

const DEFAULT_STALE_THRESHOLD_MS = 15 * 60 * 1000;

export interface RecoveryOptions {
  db: any;
  staleThresholdMs?: number;
  logger?: Logger;
}

export interface RecoveryResult {
  caseARecovered: number;
  caseBRecovered: number;
}

export async function recoverStaleImageJobs(
  opts: RecoveryOptions,
): Promise<RecoveryResult> {
  const db = opts.db;
  const log = opts.logger ?? console;
  const threshold = opts.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
  const cutoff = new Date(Date.now() - threshold).toISOString();

  let caseARecovered = 0;
  let caseBRecovered = 0;

  caseARecovered = await recoverCaseA(db, cutoff, log);
  caseBRecovered = await recoverCaseB(db, cutoff, log);

  return { caseARecovered, caseBRecovered };
}

async function recoverCaseA(
  db: any,
  cutoff: string,
  log: Logger,
): Promise<number> {
  try {
    const result = await db.execute(sql`
      WITH stale AS (
        SELECT job.id AS job_id, job.attempt_id
        FROM jobs.image_generation_job_queue job
        JOIN generation_pipeline.image_attempts attempt ON attempt.id = job.attempt_id
        WHERE job.status = 'processing'
          AND attempt.status = 'queued'
          AND job.locked_at < ${cutoff}
        FOR UPDATE OF job, attempt SKIP LOCKED
      )
      UPDATE jobs.image_generation_job_queue job
      SET status = 'queued', locked_at = NULL, locked_by = NULL
      FROM stale
      WHERE job.id = stale.job_id
    `);
    const count = result.rowCount ?? 0;
    if (count > 0) {
      log.info?.(
        { count },
        "Recovered stale Case A jobs (attempt was queued, returning to queue)",
      );
    }
    return count;
  } catch (error) {
    log.error?.({ err: error }, "Case A recovery failed");
    return 0;
  }
}

async function recoverCaseB(
  db: any,
  cutoff: string,
  log: Logger,
): Promise<number> {
  try {
    const now = new Date().toISOString();
    const diagnostics = JSON.stringify({
      format: "recovery",
      note: "Image generation was interrupted. Provider execution outcome is ambiguous.",
    });

    const result = await db.execute(sql`
      WITH stale AS (
        SELECT job.id AS job_id, job.attempt_id
        FROM jobs.image_generation_job_queue job
        JOIN generation_pipeline.image_attempts attempt ON attempt.id = job.attempt_id
        WHERE job.status = 'processing'
          AND attempt.status = 'running'
          AND job.locked_at < ${cutoff}
          AND attempt.started_at < ${cutoff}
        FOR UPDATE OF job, attempt SKIP LOCKED
      ),
      update_jobs AS (
        UPDATE jobs.image_generation_job_queue job
        SET status = 'failed', last_error = 'Image generation was interrupted. Retrying may create another provider request.', completed_at = ${now}
        FROM stale
        WHERE job.id = stale.job_id
      )
      UPDATE generation_pipeline.image_attempts attempt
      SET status = 'failed',
          failure_code = 'WORKER_INTERRUPTED_AMBIGUOUS',
          failure_summary = 'Image generation was interrupted. Retrying may create another provider request.',
          internal_diagnostics = ${diagnostics},
          completed_at = ${now}
      FROM stale
      WHERE attempt.id = stale.attempt_id
    `);
    const count = result.rowCount ?? 0;
    if (count > 0) {
      log.info?.(
        { count },
        "Recovered stale Case B jobs (attempt was running, marking ambiguous failure)",
      );
    }
    return count;
  } catch (error) {
    log.error?.({ err: error }, "Case B recovery failed");
    return 0;
  }
}
