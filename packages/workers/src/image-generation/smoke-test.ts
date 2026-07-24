import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { getDrizzleClient, getPgClient } from "@scrimspec/db";
import {
  processImageGenerationAttempt,
  type ImageAttemptWithJob,
} from "@scrimspec/hwar-core";
import * as schema from "@scrimspec/db";
import { normalizeImage } from "./image-normalizer.js";
import { createGeminiProviderAdapter } from "./gemini-provider-adapter.js";
import { createMiniMaxProviderAdapter } from "./minimax-provider-adapter.js";
import { RoutingImageProviderAdapter } from "./routing-provider-adapter.js";
import { createR2StorageAdapter } from "./r2-storage-adapter.js";

const ALLOW_FLAG = "ALLOW_PAID_IMAGE_SMOKE_TEST";
const ATTEMPT_ID_ENV = "IMAGE_SMOKE_ATTEMPT_ID";

export interface SmokeTestGuardResult {
  allowed: boolean;
  reason?: string;
}

export function checkSmokeTestGuards(): SmokeTestGuardResult {
  if (process.env[ALLOW_FLAG] !== "true") {
    return { allowed: false, reason: `${ALLOW_FLAG} is not set to "true"` };
  }
  const attemptId = process.env[ATTEMPT_ID_ENV];
  if (!attemptId) {
    return { allowed: false, reason: `${ATTEMPT_ID_ENV} is not set` };
  }
  return { allowed: true };
}

async function claimSpecificAttempt(
  attemptId: string,
  workerId: string,
): Promise<ImageAttemptWithJob | null> {
  const pg = getPgClient();
  try {
    await pg.query("BEGIN");
    const result = await pg.query(
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
      WHERE job.status = 'queued' AND job.available_at <= NOW() AND attempt.status = 'queued' AND attempt.id = $1
      ORDER BY job.created_at ASC
      LIMIT 1
      FOR UPDATE OF job, attempt SKIP LOCKED`,
      [attemptId],
    );

    if (result.rows.length === 0) {
      await pg.query("ROLLBACK");
      return null;
    }

    const row = result.rows[0];
    await pg.query(
      `UPDATE jobs.image_generation_job_queue SET status = 'processing', locked_at = NOW(), locked_by = $1 WHERE id = $2`,
      [workerId, row.queue_job_id],
    );
    await pg.query(
      `UPDATE generation_pipeline.image_attempts SET status = 'running', started_at = NOW() WHERE id = $1`,
      [row.attempt_id],
    );
    await pg.query("COMMIT");

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
  } catch (error) {
    await pg.query("ROLLBACK").catch(() => {});
    return null;
  }
}

async function main(): Promise<void> {
  const guard = checkSmokeTestGuards();
  if (!guard.allowed) {
    if (process.env[ALLOW_FLAG] !== "true") {
      console.log(
        `[smoke] Set ${ALLOW_FLAG}=true to run the paid image smoke test. Exiting.`,
      );
    } else {
      console.error(`[smoke] ${ATTEMPT_ID_ENV} must be set. Exiting.`);
    }
    process.exit(guard.reason?.includes("ALLOW") ? 0 : 1);
  }

  const attemptId = process.env[ATTEMPT_ID_ENV]!;
  const workerId = `smoke-${attemptId}`;

  console.log(`[smoke] Will process attempt ${attemptId} only.`);

  const attempt = await claimSpecificAttempt(attemptId, workerId);
  if (!attempt) {
    console.error(`[smoke] Attempt ${attemptId} not found or not claimable.`);
    process.exit(1);
  }

  console.log(
    `[smoke] Claimed: provider=${attempt.provider}, model=${attempt.modelId}`,
  );

  const db = getDrizzleClient();
  const gemini = process.env.GEMINI_API_KEY
    ? createGeminiProviderAdapter()
    : undefined;
  const minimax = process.env.MINIMAX_API_KEY
    ? createMiniMaxProviderAdapter()
    : undefined;
  const provider = new RoutingImageProviderAdapter({ gemini, minimax });
  const storage = createR2StorageAdapter();

  const result = await processImageGenerationAttempt(
    { db, schema, normalize: normalizeImage },
    attempt,
    workerId,
    provider,
    storage,
  );

  console.log(`[smoke] Result status: ${result.status}`);
  if (result.failureCode) {
    console.log(`[smoke] Failure code: ${result.failureCode}`);
  }
  if (result.meta) {
    console.log(
      `[smoke] Dimensions: ${result.meta.width}x${result.meta.height}`,
    );
    console.log(`[smoke] Checksum: ${result.meta.checksum}`);
  }
  if (result.storageKey) {
    console.log(`[smoke] Storage key: ${result.storageKey}`);
  }

  console.log("[smoke] Smoke test complete.");
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("[smoke] Fatal error:", err);
    process.exit(1);
  });
}
