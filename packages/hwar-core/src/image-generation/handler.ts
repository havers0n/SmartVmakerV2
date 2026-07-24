import { sql } from "drizzle-orm";
import type {
  ImageAttemptWithJob,
  ImageProviderInput,
  ProcessAttemptResult,
  ProviderAdapter,
  StorageAdapter,
} from "./types";
import { parseImageMeta, ImageValidationError } from "./image-meta";

export interface ImageNormalizeFn {
  (
    buffer: Buffer,
    sourceMimeType?: string,
  ): Promise<{
    buffer: Buffer;
    meta: {
      mimeType: "image/png";
      extension: "png";
      width: number;
      height: number;
      byteSize: number;
      checksum: string;
    };
    originalMimeType: string;
  }>;
}

export interface ImageGenerationDeps {
  db: any;
  logger?: any;
  schema: any;
  normalize?: ImageNormalizeFn;
}

function getLogger(deps: ImageGenerationDeps) {
  return deps.logger ?? console;
}

const SAFE_ERROR_SUMMARIES: Record<string, string> = {
  PROVIDER_NOT_SUPPORTED: "The selected image provider is not supported.",
  PROVIDER_NOT_CONFIGURED: "The selected image provider is not configured.",
  PROVIDER_TIMEOUT: "Image generation timed out.",
  PROVIDER_REJECTED: "The image provider rejected this generation request.",
  PROVIDER_INVALID_RESPONSE: "The image provider returned an invalid result.",
  IMAGE_NORMALIZATION_FAILED: "The generated image could not be processed.",
  STORAGE_FAILURE: "The generated image could not be stored.",
};

function safeSummary(code: string, fallback: string): string {
  return SAFE_ERROR_SUMMARIES[code] ?? fallback;
}

export function computeStorageKey(
  runId: string,
  attemptId: string,
  extension: string,
): string {
  return `images/runs/${runId}/attempts/${attemptId}/output.${extension}`;
}

async function getCurrentAttemptStatus(
  db: any,
  attemptId: string,
): Promise<{
  attemptStatus: string;
  jobStatus: string;
  lockedBy: string | null;
} | null> {
  try {
    const rows = await db.execute(sql`
      SELECT attempt.status AS attempt_status, job.status AS job_status, job.locked_by
      FROM generation_pipeline.image_attempts attempt
      JOIN jobs.image_generation_job_queue job ON job.attempt_id = attempt.id
      WHERE attempt.id = ${attemptId}
    `);
    const row = rows.rows?.[0];
    if (!row) return null;
    return {
      attemptStatus: String(row.attempt_status),
      jobStatus: String(row.job_status),
      lockedBy: row.locked_by ? String(row.locked_by) : null,
    };
  } catch {
    return null;
  }
}

async function finalizeAttemptSuccess(
  deps: ImageGenerationDeps,
  attempt: ImageAttemptWithJob,
  workerId: string,
  storageKey: string,
  meta: {
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
    checksum: string;
  },
): Promise<boolean> {
  const log = getLogger(deps);

  try {
    let updated = false;
    await deps.db.transaction(async (tx: any) => {
      const result = await tx.execute(sql`
        UPDATE jobs.image_generation_job_queue
        SET status = 'completed'
        WHERE id = ${attempt.queueJobId} AND status = 'processing' AND locked_by = ${workerId}
      `);
      if (result.rowCount === 0) {
        log.warn(
          { jobId: attempt.queueJobId, attemptId: attempt.attemptId },
          "Job not in processing state or not locked by this worker",
        );
        return;
      }

      await tx.execute(sql`
        UPDATE generation_pipeline.image_attempts
        SET status = 'succeeded', completed_at = NOW()
        WHERE id = ${attempt.attemptId} AND status = 'running'
      `);

      await tx.execute(sql`
        INSERT INTO generation_pipeline.image_artifacts (attempt_id, storage_key, mime_type, byte_size, width, height, checksum, created_at)
        VALUES (${attempt.attemptId}, ${storageKey}, ${meta.mimeType}, ${meta.byteSize}, ${meta.width}, ${meta.height}, ${meta.checksum}, NOW())
      `);

      updated = true;
    });
    return updated;
  } catch (error) {
    log.error(
      { err: error, attemptId: attempt.attemptId },
      "Failed to finalize attempt in DB",
    );
    return false;
  }
}

async function failAttempt(
  deps: ImageGenerationDeps,
  attempt: ImageAttemptWithJob,
  workerId: string,
  code: string,
  summary: string,
  diagnostics?: Record<string, unknown>,
): Promise<boolean> {
  const log = getLogger(deps);

  try {
    let updated = false;
    await deps.db.transaction(async (tx: any) => {
      const result = await tx.execute(sql`
        UPDATE jobs.image_generation_job_queue
        SET status = 'failed', last_error = ${summary}
        WHERE id = ${attempt.queueJobId} AND status = 'processing' AND locked_by = ${workerId}
      `);
      if (result.rowCount === 0) {
        log.warn(
          { jobId: attempt.queueJobId, attemptId: attempt.attemptId },
          "Job not in processing state or not locked by this worker during failure",
        );
        return;
      }

      await tx.execute(sql`
        UPDATE generation_pipeline.image_attempts
        SET status = 'failed', failure_code = ${code}, failure_summary = ${summary}, internal_diagnostics = ${diagnostics ? JSON.stringify(diagnostics) : null}, completed_at = NOW()
        WHERE id = ${attempt.attemptId} AND status = 'running'
      `);

      updated = true;
    });
    return updated;
  } catch (error) {
    log.error(
      { err: error, attemptId: attempt.attemptId },
      "Failed to mark attempt as failed in DB",
    );
    return false;
  }
}

export async function processImageGenerationAttempt(
  deps: ImageGenerationDeps,
  attempt: ImageAttemptWithJob,
  workerId: string,
  provider: ProviderAdapter,
  storage: StorageAdapter,
): Promise<ProcessAttemptResult> {
  const log = getLogger(deps);

  const persisted = await getCurrentAttemptStatus(deps.db, attempt.attemptId);

  if (!persisted) {
    log.warn(
      { attemptId: attempt.attemptId },
      "Attempt not found in DB — skipping",
    );
    return {
      status: "failed",
      attemptId: attempt.attemptId,
      failureCode: "ATTEMPT_NOT_FOUND",
    };
  }

  if (
    persisted.attemptStatus !== "running" ||
    persisted.jobStatus !== "processing"
  ) {
    log.warn(
      {
        attemptId: attempt.attemptId,
        attemptStatus: persisted.attemptStatus,
        jobStatus: persisted.jobStatus,
      },
      "Terminal replay detected — skipping provider and storage",
    );
    const terminalStatus =
      persisted.attemptStatus === "succeeded"
        ? ("succeeded" as const)
        : ("failed" as const);
    return { status: terminalStatus, attemptId: attempt.attemptId };
  }

  const input: ImageProviderInput = {
    attemptId: attempt.attemptId,
    provider: attempt.provider,
    modelId: attempt.modelId,
    prompt: attempt.prompt,
    settings: attempt.settings,
    signal: new AbortController().signal,
  };

  let providerResult;
  try {
    providerResult = await provider.generate(input);
  } catch (error) {
    const exceptionClass =
      error instanceof Error ? error.constructor.name : "Unknown";
    const errMessage = error instanceof Error ? error.message : String(error);

    let failureCode = "PROVIDER_REJECTED";
    if (
      errMessage.includes("not supported") ||
      errMessage.includes("PROVIDER_NOT_SUPPORTED")
    ) {
      failureCode = "PROVIDER_NOT_SUPPORTED";
    } else if (
      errMessage.includes("not configured") ||
      errMessage.includes("PROVIDER_NOT_CONFIGURED")
    ) {
      failureCode = "PROVIDER_NOT_CONFIGURED";
    } else if (
      errMessage.includes("timed out") ||
      errMessage.includes("PROVIDER_TIMEOUT") ||
      errMessage.includes("AbortError")
    ) {
      failureCode = "PROVIDER_TIMEOUT";
    } else if (
      errMessage.includes("invalid") ||
      errMessage.includes("PROVIDER_INVALID_RESPONSE")
    ) {
      failureCode = "PROVIDER_INVALID_RESPONSE";
    }

    const diagnostics: Record<string, unknown> = {
      exceptionClass,
      correlationId: attempt.attemptId,
    };
    if (providerResult && typeof providerResult === "object") {
      const r = providerResult as any;
      if (r.providerRequestId)
        diagnostics.providerRequestId = r.providerRequestId;
      if (r.sourceMimeType) diagnostics.sourceMimeType = r.sourceMimeType;
    }

    const summary = safeSummary(failureCode, "Image generation failed.");
    await failAttempt(
      deps,
      attempt,
      workerId,
      failureCode,
      summary,
      diagnostics,
    );
    return {
      status: "failed",
      attemptId: attempt.attemptId,
      failureCode,
      failureSummary: summary,
      diagnostics,
    };
  }

  const diagnostics: Record<string, unknown> = {};
  if (providerResult.providerRequestId)
    diagnostics.providerRequestId = providerResult.providerRequestId;
  if (providerResult.finishReason)
    diagnostics.finishReason = providerResult.finishReason;
  if (providerResult.sourceMimeType)
    diagnostics.sourceMimeType = providerResult.sourceMimeType;

  let meta;
  try {
    if (deps.normalize) {
      const normalized = await deps.normalize(
        providerResult.buffer,
        providerResult.sourceMimeType,
      );
      providerResult.buffer = normalized.buffer;
      meta = normalized.meta;
    } else {
      meta = parseImageMeta(providerResult.buffer);
    }
  } catch (error) {
    const code =
      error instanceof ImageValidationError
        ? error.code
        : "IMAGE_NORMALIZATION_FAILED";
    const message = safeSummary(
      code,
      "The generated image could not be processed.",
    );
    diagnostics.validationIssues = [
      error instanceof Error ? error.message : "Invalid image data",
    ];
    diagnostics.exceptionClass =
      error instanceof Error ? error.constructor.name : "Unknown";
    diagnostics.responseBytes = providerResult.buffer.length;
    await failAttempt(deps, attempt, workerId, code, message, diagnostics);
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
    await storage.put(storageKey, providerResult.buffer, meta.mimeType);
  } catch (error) {
    const message = safeSummary(
      "STORAGE_FAILURE",
      "The generated image could not be stored.",
    );
    diagnostics.storageKey = storageKey;
    diagnostics.byteSize = meta.byteSize;
    diagnostics.exceptionClass =
      error instanceof Error ? error.constructor.name : "Unknown";
    await failAttempt(
      deps,
      attempt,
      workerId,
      "STORAGE_FAILURE",
      message,
      diagnostics,
    );
    return {
      status: "failed",
      attemptId: attempt.attemptId,
      failureCode: "STORAGE_FAILURE",
      failureSummary: message,
      diagnostics,
    };
  }

  const finalized = await finalizeAttemptSuccess(
    deps,
    attempt,
    workerId,
    storageKey,
    meta,
  );

  if (!finalized) {
    const message = safeSummary(
      "STORAGE_FAILURE",
      "Database finalization failed; storage may need cleanup.",
    );
    diagnostics.storageKey = storageKey;
    diagnostics.byteSize = meta.byteSize;

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
      workerId,
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
  try {
    return await db.transaction(async (tx: any) => {
      const result = await tx.execute(sql`
        SELECT
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
        WHERE job.status = 'queued' AND job.available_at <= NOW() AND attempt.status = 'queued'
        ORDER BY job.created_at ASC
        LIMIT 1
        FOR UPDATE OF job, attempt SKIP LOCKED
      `);

      const row = result.rows?.[0];
      if (!row) return null;

      await tx.execute(sql`
        UPDATE jobs.image_generation_job_queue
        SET status = 'processing', locked_at = NOW(), locked_by = ${workerId}
        WHERE id = ${row.queue_job_id}
      `);

      await tx.execute(sql`
        UPDATE generation_pipeline.image_attempts
        SET status = 'running', started_at = NOW()
        WHERE id = ${row.attempt_id}
      `);

      return {
        attemptId: row.attempt_id,
        runId: row.run_id,
        scenePlanId: row.scene_plan_id,
        sceneIndex: row.scene_index,
        frameRole: row.frame_role,
        attemptNumber: row.attempt_number,
        status: "running",
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
    });
  } catch {
    return null;
  }
}
