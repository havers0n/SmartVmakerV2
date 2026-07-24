import type {
  ImageAttemptWithJob,
  ProcessAttemptResult,
  ProviderAdapter,
  StorageAdapter,
} from "./types";
import { parseImageMeta, ImageValidationError } from "./image-meta";

export interface ImageGenerationDeps {
  db: any;
  logger?: any;
  schema: any;
}

function getLogger(deps: ImageGenerationDeps) {
  return deps.logger ?? console;
}

export function computeStorageKey(
  runId: string,
  attemptId: string,
  extension: string,
): string {
  return `images/runs/${runId}/attempts/${attemptId}/output.${extension}`;
}

async function finalizeAttemptSuccess(
  deps: ImageGenerationDeps,
  attempt: ImageAttemptWithJob,
  storageKey: string,
  meta: {
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
    checksum: string;
  },
): Promise<void> {
  const { db, schema } = deps;
  const log = getLogger(deps);

  try {
    await db.transaction(async (tx: any) => {
      await tx
        .update(schema.imageAttempts)
        .set({ status: "succeeded", completedAt: new Date().toISOString() })
        .where(
          tx.eq ? tx.eq(schema.imageAttempts.id, attempt.attemptId) : undefined,
        );

      await tx.insert(schema.imageArtifacts).values({
        attemptId: attempt.attemptId,
        storageKey,
        mimeType: meta.mimeType,
        byteSize: meta.byteSize,
        width: meta.width,
        height: meta.height,
        checksum: meta.checksum,
        createdAt: new Date().toISOString(),
      });

      await tx
        .update(schema.imageGenerationJobQueue)
        .set({ status: "completed" })
        .where(
          tx.eq
            ? tx.eq(schema.imageGenerationJobQueue.id, attempt.queueJobId)
            : undefined,
        );
    });
  } catch (error) {
    log.error(
      { err: error, attemptId: attempt.attemptId },
      "Failed to finalize attempt in DB",
    );
    throw error;
  }
}

async function failAttempt(
  deps: ImageGenerationDeps,
  attempt: ImageAttemptWithJob,
  code: string,
  summary: string,
  diagnostics?: Record<string, unknown>,
): Promise<void> {
  const { db, schema } = deps;
  const log = getLogger(deps);

  try {
    await db.transaction(async (tx: any) => {
      await tx
        .update(schema.imageAttempts)
        .set({
          status: "failed",
          failureCode: code,
          failureSummary: summary,
          internalDiagnostics: diagnostics ?? null,
          completedAt: new Date().toISOString(),
        })
        .where(
          tx.eq ? tx.eq(schema.imageAttempts.id, attempt.attemptId) : undefined,
        );

      await tx
        .update(schema.imageGenerationJobQueue)
        .set({ status: "failed", lastError: summary })
        .where(
          tx.eq
            ? tx.eq(schema.imageGenerationJobQueue.id, attempt.queueJobId)
            : undefined,
        );
    });
  } catch (error) {
    log.error(
      { err: error, attemptId: attempt.attemptId },
      "Failed to mark attempt as failed in DB",
    );
    throw error;
  }
}

export async function processImageGenerationAttempt(
  deps: ImageGenerationDeps,
  attempt: ImageAttemptWithJob,
  provider: ProviderAdapter,
  storage: StorageAdapter,
): Promise<ProcessAttemptResult> {
  const log = getLogger(deps);
  const { db, schema } = deps;

  if (attempt.status !== "queued" && attempt.queueStatus !== "queued") {
    log.warn(
      { attemptId: attempt.attemptId, status: attempt.status },
      "Terminal replay detected — skipping",
    );
    return {
      status: attempt.status as "succeeded" | "failed",
      attemptId: attempt.attemptId,
    };
  }

  await db
    .update(schema.imageAttempts)
    .set({ status: "running", startedAt: new Date().toISOString() })
    .where(
      db.eq ? db.eq(schema.imageAttempts.id, attempt.attemptId) : undefined,
    );

  let imageBuffer: Buffer;
  try {
    imageBuffer = await provider.generate(attempt.prompt, attempt.settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Provider call failed";
    const diagnostics = {
      exceptionClass:
        error instanceof Error ? error.constructor.name : "Unknown",
      correlationId: attempt.attemptId,
    };
    await failAttempt(deps, attempt, "PROVIDER_FAILURE", message, diagnostics);
    return {
      status: "failed",
      attemptId: attempt.attemptId,
      failureCode: "PROVIDER_FAILURE",
      failureSummary: message,
      diagnostics,
    };
  }

  let meta;
  try {
    meta = parseImageMeta(imageBuffer);
  } catch (error) {
    const code =
      error instanceof ImageValidationError ? error.code : "INVALID_IMAGE";
    const message =
      error instanceof Error ? error.message : "Invalid image data";
    const diagnostics = {
      validationIssues: [message],
      exceptionClass:
        error instanceof Error ? error.constructor.name : "Unknown",
      responseBytes: imageBuffer.length,
    };
    await failAttempt(deps, attempt, code, message, diagnostics);
    return {
      status: "failed",
      attemptId: attempt.attemptId,
      failureCode: code,
      failureSummary: message,
      diagnostics,
    };
  }

  const storageKey = computeStorageKey(
    attempt.runId,
    attempt.attemptId,
    meta.extension,
  );

  try {
    await storage.put(storageKey, imageBuffer, meta.mimeType);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Storage put failed";
    const diagnostics = {
      exceptionClass:
        error instanceof Error ? error.constructor.name : "Unknown",
      storageKey,
      byteSize: meta.byteSize,
    };
    await failAttempt(deps, attempt, "STORAGE_FAILURE", message, diagnostics);
    return {
      status: "failed",
      attemptId: attempt.attemptId,
      failureCode: "STORAGE_FAILURE",
      failureSummary: message,
      diagnostics,
    };
  }

  try {
    await finalizeAttemptSuccess(deps, attempt, storageKey, meta);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database finalization failed";
    const diagnostics = {
      exceptionClass:
        error instanceof Error ? error.constructor.name : "Unknown",
      storageKey,
      byteSize: meta.byteSize,
    };

    try {
      await storage.delete(storageKey);
    } catch (deleteError) {
      log.warn(
        { storageKey, err: deleteError },
        "Best-effort storage cleanup after DB failure",
      );
    }

    await failAttempt(
      deps,
      attempt,
      "DB_FINALIZATION_FAILURE",
      message,
      diagnostics,
    );
    return {
      status: "failed",
      attemptId: attempt.attemptId,
      failureCode: "DB_FINALIZATION_FAILURE",
      failureSummary: message,
      diagnostics,
    };
  }

  return {
    status: "succeeded",
    attemptId: attempt.attemptId,
    meta,
    storageKey,
  };
}

export async function claimImageGenerationJob(
  db: any,
  _schema: any,
  workerId: string,
): Promise<ImageAttemptWithJob | null> {
  const pool = db.$client ?? db;

  let poolClient;
  try {
    poolClient = await pool.connect();
  } catch {
    return null;
  }

  try {
    await poolClient.query("BEGIN");
    const result = await poolClient.query(
      `SELECT
        job.id AS queue_job_id,
        job.status AS queue_status,
        attempt.id AS attempt_id,
        attempt.run_id,
        attempt.scene_plan_id,
        attempt.scene_index,
        attempt.frame_role,
        attempt.attempt_number,
        attempt.status,
        attempt.prompt,
        attempt.provider,
        attempt.model_id,
        attempt.settings,
        attempt.failure_code,
        attempt.failure_summary
      FROM jobs.image_generation_job_queue job
      JOIN generation_pipeline.image_attempts attempt ON attempt.id = job.attempt_id
      WHERE job.status = 'queued' AND job.available_at <= NOW()
      ORDER BY job.created_at ASC
      LIMIT 1
      FOR UPDATE OF job, attempt SKIP LOCKED`,
    );

    if (result.rows.length === 0) {
      await poolClient.query("ROLLBACK");
      return null;
    }

    const row = result.rows[0];
    await poolClient.query(
      `UPDATE jobs.image_generation_job_queue SET status = 'processing', locked_at = NOW(), locked_by = $1 WHERE id = $2`,
      [workerId, row.queue_job_id],
    );
    await poolClient.query("COMMIT");

    return {
      attemptId: row.attempt_id,
      runId: row.run_id,
      scenePlanId: row.scene_plan_id,
      sceneIndex: row.scene_index,
      frameRole: row.frame_role,
      attemptNumber: row.attempt_number,
      status: "queued",
      prompt: row.prompt,
      provider: row.provider,
      modelId: row.model_id,
      settings:
        typeof row.settings === "string"
          ? JSON.parse(row.settings)
          : row.settings,
      failureCode: row.failure_code,
      failureSummary: row.failure_summary,
      queueJobId: row.queue_job_id,
      queueStatus: "processing",
    };
  } catch (error) {
    await poolClient.query("ROLLBACK").catch(() => {});
    return null;
  } finally {
    poolClient.release();
  }
}
