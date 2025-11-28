/**
 * ANIMATION WORKER - BILLING PROTECTION EDITION
 */

import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// === ANTI-CRASH SHIELD ===
process.on('uncaughtException', (err) => {
  const msg = String(err);
  if (msg.includes('ECONNRESET') || msg.includes('Connection terminated') || msg.includes('57P01')) {
    console.warn('[System] DB Connection glitch intercepted. Staying alive.');
    return;
  }
  console.error('[System] CRITICAL UNCAUGHT ERROR:', err);
  process.exit(1);
});

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { createLogger } from '@aec/logger';
import { getDrizzleClient, schema, sql } from '@scrimspec/db';
import { eq } from 'drizzle-orm';
import { createDownloadUrl, uploadLargeStream, R2_BUCKET } from '@aec/storage-client';
import {
  createHaluClient,
  HaluApiError,
  MinimaxErrorCode
} from '@scrimspec/halu-client';

import { loadModelConfig } from './lib/model-config';

const logger = createLogger({ name: 'animation-worker' });

// ============================================================================
// CONFIGURATION & SETUP
// ============================================================================

logger.info({ nodeEnv: process.env.NODE_ENV }, 'Worker environment initialized (Safe Mode)');

if (process.env.DRIZZLE_DATABASE_URL) {
  let databaseUrl = process.env.DRIZZLE_DATABASE_URL;
  if (databaseUrl && databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/\?sslmode=[^&]*&?/, '?').replace(/&sslmode=[^&]*$/, '').replace(/&sslmode=[^&]*/, '');
    databaseUrl = databaseUrl.replace(/\?$/, '');
  }
  process.env.DRIZZLE_DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateIdempotencyKey(projectId: string, sceneIndex: number): string {
  return crypto
    .createHash('sha256')
    .update(`${projectId}:${sceneIndex}`)
    .digest('hex');
}

async function updateJobStage(id: string, stage: string) {
  const db = getDrizzleClient();
  await db.update(schema.animationJobQueue)
    .set({ stage: stage as any, updatedAt: new Date() as any })
    .where(eq(schema.animationJobQueue.id, id));
}

async function getPresignedUrls(db: any, job: any) {
  const [firstFrameAsset] = await db
    .select()
    .from(schema.assets)
    .where(eq(schema.assets.id, job.asset_id_first_frame))
    .limit(1);

  const [lastFrameAsset] = await db
    .select()
    .from(schema.assets)
    .where(eq(schema.assets.id, job.asset_id_last_frame))
    .limit(1);

  if (!firstFrameAsset || !lastFrameAsset) {
    throw new Error(`Keyframe assets not found: first=${job.asset_id_first_frame}, last=${job.asset_id_last_frame}`);
  }

  if (firstFrameAsset.status !== 'completed' || lastFrameAsset.status !== 'completed') {
    throw new Error(`Keyframe assets not ready. First: ${firstFrameAsset.status}, Last: ${lastFrameAsset.status}`);
  }

  const firstFrameUrl = await createDownloadUrl(firstFrameAsset.storageUrl, 3600);
  const lastFrameUrl = await createDownloadUrl(lastFrameAsset.storageUrl, 3600);

  return { firstFrameUrl, lastFrameUrl };
}

async function uploadVideoToR2(videoBytes: Buffer, projectId: string, sceneIndex: number): Promise<string> {
  const key = `animations/${projectId}/scene-${sceneIndex}-${Date.now()}.mp4`;
  logger.info({ key, bucket: R2_BUCKET, sizeBytes: videoBytes.length }, 'Uploading result to R2');

  const stream = Readable.from(videoBytes);
  await uploadLargeStream(key, stream, 'video/mp4');

  return key;
}

// ============================================================================
// CORE LOGIC
// ============================================================================

async function handleActiveTask(job: any, taskId: string, client: any, db: any) {
  logger.info({ jobId: job.id, taskId }, 'Entering polling loop for active task');

  const result = await client.pollTask(taskId, {
    intervalMs: 5000,
    maxAttempts: 120, // 10 minutes max wait
    onProgress: async (_status: any) => {
      await db.update(schema.animationJobQueue)
        .set({ updatedAt: new Date() as any })
        .where(eq(schema.animationJobQueue.id, job.id));
    }
  });

  if (result.status === 'failed') {
    throw new Error(`Provider failed generation: ${result.base_resp?.status_msg || 'Unknown error'}`);
  }

  if (result.status === 'success') {
    logger.info({ jobId: job.id, taskId }, 'Generation success via API. Downloading result...');
    await updateJobStage(job.id, 'downloading');

    const fileId = result.file_id || result.video_url;
    if (!fileId) throw new Error('Success status but no file_id or video_url provided');

    const videoBuffer = await client.downloadVideo(fileId);

    await updateJobStage(job.id, 'uploading');
    const r2Key = await uploadVideoToR2(videoBuffer, job.project_id, job.scene_index);

    await db.update(schema.animationJobQueue).set({
      status: 'completed',
      stage: 'completed',
      updatedAt: new Date() as any,
    }).where(eq(schema.animationJobQueue.id, job.id));

    logger.info({ jobId: job.id, r2Key }, 'Job fully completed and saved');
    return job.id;
  }
}

export async function processAnimationJob() {
  const db = getDrizzleClient();

  // PHASE 1: ATOMIC ACQUISITION
  const job = await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT * FROM jobs.animation_job_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (!result.rows || result.rows.length === 0) return null;
    const selectedJob = result.rows[0] as any;

    const idemKey = selectedJob.idempotency_key || generateIdempotencyKey(selectedJob.project_id, selectedJob.scene_index);

    await tx
      .update(schema.animationJobQueue)
      .set({
        status: 'processing' as any,
        stage: 'checking_dupes' as any,
        updatedAt: new Date() as any,
        idempotencyKey: idemKey
      })
      .where(sql`${schema.animationJobQueue.id} = ${selectedJob.id}`);

    return {
      ...selectedJob,
      idempotencyKey: idemKey,
      retry_count: selectedJob.retry_count,
      project_id: selectedJob.project_id,
      scene_index: selectedJob.scene_index,
      external_id: selectedJob.external_id,
      halu_task_id: selectedJob.halu_task_id,
      model_id: selectedJob.model_id
    };
  });

  if (!job) return null;

  logger.info({ jobId: job.id, scene: `${job.project_id}:${job.scene_index}` }, 'Job locked. Starting safety checks.');

  try {
    // PHASE 2: INITIALIZATION
    let modelConfig;
    try {
      modelConfig = await loadModelConfig(job.model_id || 'minimax_video_01');
    } catch (e) {
      const [defaultModel] = await db.select().from(schema.aiModels)
        .where(eq(schema.aiModels.type, 'text-to-video'))
        .limit(1);
      if (defaultModel) {
        modelConfig = await loadModelConfig(defaultModel.id);
      } else {
        throw new Error("No video generation model configuration found");
      }
    }

    const apiKey = process.env[modelConfig.apiKeyEnvVarName];
    if (!apiKey) throw new Error(`API Key env var not found: ${modelConfig.apiKeyEnvVarName}`);

    const client = createHaluClient({
      apiKey,
      baseUrl: modelConfig.apiBaseUrl || undefined
    });

    // PHASE 3: RECOVERY CHECK
    const existingTaskId = job.external_id || job.halu_task_id;

    if (existingTaskId) {
      logger.warn({ jobId: job.id, existingTaskId }, 'RECOVERY MODE: Job already has external ID. Skipping submission.');
      await updateJobStage(job.id, 'waiting_external');
      return await handleActiveTask(job, existingTaskId, client, db);
    }

    // PHASE 4: SUBMISSION
    await updateJobStage(job.id, 'submitting');
    const { firstFrameUrl, lastFrameUrl } = await getPresignedUrls(db, job);

    const payload = {
      model: 'MiniMax-Hailuo-02',
      first_frame_image: firstFrameUrl,
      last_frame_image: lastFrameUrl,
      prompt: job.scene_description || "Cinematic shot",
    };

    logger.info({ jobId: job.id }, 'Submitting new task to Provider...');

    // @ts-ignore
    const response = await client.createFirstLastFrameTask(payload as any);

    const newTaskId = response.task_id;
    if (!newTaskId) throw new Error('Provider returned success but no task_id');

    // PHASE 5: COMMIT ID
    await db.update(schema.animationJobQueue).set({
      externalId: newTaskId,
      haluTaskId: newTaskId,
      stage: 'waiting_external',
      updatedAt: new Date() as any
    }).where(eq(schema.animationJobQueue.id, job.id));

    logger.info({ jobId: job.id, newTaskId }, 'Task submitted & ID saved. Polling...');

    // PHASE 6: POLL
    return await handleActiveTask(job, newTaskId, client, db);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId: job.id, err: error }, 'Job Execution Failed');

    let isRetryable = false;
    if (error instanceof HaluApiError) {
      if (error.statusCode === MinimaxErrorCode.RATE_LIMIT || error.statusCode >= 500) {
        isRetryable = true;
      }
    } else if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ETIMEDOUT')) {
      isRetryable = true;
    }

    if (isRetryable && (job.retry_count || 0) < 3) {
      await db.update(schema.animationJobQueue).set({
        status: 'pending' as any,
        retryCount: (job.retry_count || 0) + 1,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any
      }).where(eq(schema.animationJobQueue.id, job.id));
      logger.warn({ jobId: job.id, retry: (job.retry_count || 0) + 1 }, 'Job scheduled for retry');
    } else {
      await db.update(schema.animationJobQueue).set({
        status: 'failed' as any,
        stage: 'failed' as any,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any
      }).where(eq(schema.animationJobQueue.id, job.id));
      logger.error({ jobId: job.id }, 'Job permanently failed');
    }
    return null;
  }
}

async function main() {
  logger.info('Starting Animation Worker (Secure Mode)...');

  if (!process.env.MINIMAX_API_KEY && !process.env.HALU_API_KEY) {
    logger.warn("Warning: MINIMAX_API_KEY or HALU_API_KEY missing in env. Worker might fail on jobs.");
  }

  while (true) {
    try {
      const jobId = await processAnimationJob();
      if (!jobId) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.fatal({ err: error }, 'CRITICAL WORKER CRASH. Restarting loop in 30s...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(e => {
    logger.fatal({ err: e }, 'Fatal startup error');
    process.exit(1);
  });
}