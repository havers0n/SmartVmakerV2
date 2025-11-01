import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Ensure NODE_ENV is set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { createLogger } from '@aec/logger';
import { retryFetch } from './utils/retry';

const logger = createLogger({ name: 'animation-worker' });

logger.info({ nodeEnv: process.env.NODE_ENV }, 'Worker environment initialized');

if (process.env.DRIZZLE_DATABASE_URL) {
  logger.info('Using DRIZZLE_DATABASE_URL (Pooler)');

  // Remove sslmode parameter from the connection string to avoid conflict with Pool SSL options
  let databaseUrl = process.env.DRIZZLE_DATABASE_URL;
  if (databaseUrl && databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/\?sslmode=[^&]*&?/, '?').replace(/&sslmode=[^&]*$/, '').replace(/&sslmode=[^&]*/, '');
    databaseUrl = databaseUrl.replace(/\?$/, ''); // Remove trailing ? if no params left
  }

  // Also update DRIZZLE_DATABASE_URL itself to ensure client.ts picks it up without sslmode
  process.env.DRIZZLE_DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;

  logger.info('Cleaned database URL (sslmode removed)');
}

import { getDrizzleClient, schema, sql } from '@scrimspec/db';
import { eq } from 'drizzle-orm';
import { createHaluClient, HaluApiError, MinimaxErrorCode } from '@scrimspec/halu-client';
import { getPresignedDownloadUrl, uploadLargeStream, R2_BUCKET } from '@aec/storage-client';
import { Readable } from 'stream';

/**
 * Asserts that the HALU API key is configured
 */
async function assertHaluConfig(): Promise<void> {
  const haluApiKey = process.env.MINIMAX_API_KEY;

  if (!haluApiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is not set');
  }

  logger.info('HALU API key configured');
}

/**
 * Upload video bytes to Cloudflare R2
 *
 * @param videoBytes - Buffer containing video data
 * @param projectId - Project UUID
 * @param sceneIndex - Scene index (0-based)
 * @returns R2 object key (not a full URL, just the key)
 */
async function uploadVideoToR2(
  videoBytes: Buffer,
  projectId: string,
  sceneIndex: number
): Promise<string> {
  // Generate R2 object key (path)
  const key = `animations/${projectId}/scene-${sceneIndex}-${Date.now()}.mp4`;

  logger.info({ key, bucket: R2_BUCKET, sizeBytes: videoBytes.length }, 'Uploading video to R2');

  // Convert Buffer to Readable stream
  const stream = Readable.from(videoBytes);

  // Upload to R2 using multipart upload
  await uploadLargeStream(key, stream, 'video/mp4');

  logger.info({ key }, 'Video uploaded successfully to R2');

  return key;
}

/**
 * Process a single animation generation job
 */
async function processAnimationJob() {
  const db = getDrizzleClient();

  // Step 1: Atomic job capture using transaction and FOR UPDATE SKIP LOCKED
  const job = await db.transaction(async (tx) => {
    // Use raw SQL for FOR UPDATE SKIP LOCKED
    const result = await tx.execute(
      sql`
        SELECT * FROM jobs.animation_job_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const selectedJob = result.rows[0] as any;

    // Immediately update status to 'processing' within the same transaction
    await tx
      .update(schema.animationJobQueue)
      .set({
        status: 'processing' as any,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.animationJobQueue.id} = ${selectedJob.id}`);

    return selectedJob;
  });

  if (!job) {
    // No jobs to process
    return null;
  }

  try {
    logger.info(
      {
        jobId: job.id,
        projectId: job.project_id,
        sceneIndex: job.scene_index,
        firstFrameAssetId: job.asset_id_first_frame,
        lastFrameAssetId: job.asset_id_last_frame,
      },
      'Processing animation job'
    );

    // Step 2: Fetch both keyframe assets
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
      throw new Error(
        `Keyframe assets not found: first=${job.asset_id_first_frame}, last=${job.asset_id_last_frame}`
      );
    }

    // Verify both keyframes are completed
    if (firstFrameAsset.status !== 'completed' || lastFrameAsset.status !== 'completed') {
      throw new Error(
        `Keyframe assets not ready: first=${firstFrameAsset.status}, last=${lastFrameAsset.status}. Requeueing...`
      );
    }

    // Step 3: Get presigned download URLs for both keyframes from R2
    const firstFrameUrl = await getPresignedDownloadUrl(
      firstFrameAsset.storageUrl,
      3600 // 1 hour
    );

    const lastFrameUrl = await getPresignedDownloadUrl(
      lastFrameAsset.storageUrl,
      3600 // 1 hour
    );

    logger.info({ firstFrameUrl, lastFrameUrl }, 'Generated presigned URLs for keyframes');

    // Step 4: Create HALU client and submit video generation task
    const haluClient = createHaluClient({
      apiKey: process.env.MINIMAX_API_KEY!,
    });

    // Get webhook URL from environment
    const webhookUrl = process.env.HALU_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/halu`;

    // Submit First & Last Frame video generation task
    const taskResponse = await haluClient.createFirstLastFrameTask({
      model: 'MiniMax-Hailuo-02',
      first_frame_image: firstFrameUrl,
      last_frame_image: lastFrameUrl,
      prompt: 'Smooth transition between frames. [Static shot]', // Simple default, can be enhanced
      duration: 6, // 6 seconds
      resolution: '768P',
      prompt_optimizer: false, // Use exact prompt
      callback_url: webhookUrl,
    });

    logger.info({ taskId: taskResponse.task_id, haluTaskId: taskResponse.task_id }, 'HALU task created successfully');

    // Step 5: Save HALU task_id to job record
    await db
      .update(schema.animationJobQueue)
      .set({
        haluTaskId: taskResponse.task_id,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.animationJobQueue.id} = ${job.id}`);

    logger.info({ jobId: job.id, haluTaskId: taskResponse.task_id }, 'Animation job submitted to HALU');

    // Note: The job remains in 'processing' status
    // The webhook will update it to 'completed' when HALU finishes

    return job.id;

  } catch (error) {
    // Step 6: Handle errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({ err: error, jobId: job.id }, 'Animation job failed');

    // Check if this is a retriable error (rate limit, etc.)
    const shouldRetry = error instanceof HaluApiError && error.statusCode === MinimaxErrorCode.RATE_LIMIT;

    if (shouldRetry && (job.retry_count || 0) < 3) {
      // Increment retry count and set back to pending
      await db
        .update(schema.animationJobQueue)
        .set({
          status: 'pending' as any,
          retryCount: (job.retry_count || 0) + 1,
          error: errorMessage,
          errorMessage: errorMessage,
          updatedAt: new Date() as any,
        })
        .where(sql`${schema.animationJobQueue.id} = ${job.id}`);

      logger.warn({ jobId: job.id, retryCount: job.retry_count + 1 }, 'Job will be retried');
    } else {
      // Update job status to 'failed' with error message
      await db
        .update(schema.animationJobQueue)
        .set({
          status: 'failed' as any,
          error: errorMessage,
          errorMessage: errorMessage,
          updatedAt: new Date() as any,
        })
        .where(sql`${schema.animationJobQueue.id} = ${job.id}`);
    }

    return null;
  }
}

/**
 * Main worker loop
 */
async function main() {
  logger.info('Starting animation worker');
  logger.info({
    minimaxApiKey: !!process.env.MINIMAX_API_KEY,
    databaseUrl: !!process.env.DATABASE_URL,
    webhookUrl: process.env.HALU_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/halu`,
  }, 'Environment configuration');
  logger.info('Worker animates keyframe pairs using HALU (MiniMax) First & Last Frame API');

  // Fail-fast config validation
  try {
    await assertHaluConfig();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to validate HALU configuration');
    process.exit(1);
  }

  while (true) {
    try {
      const jobId = await processAnimationJob();

      if (!jobId) {
        // No jobs, wait 30 seconds
        logger.debug('No pending jobs, waiting 30 seconds');
        await new Promise(resolve => setTimeout(resolve, 30000));
      } else {
        // Job processed, small pause before next
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logger.error({ err: error }, 'Unexpected error in main loop');
      // In case of critical error, wait before retry
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the worker
main().catch((error) => {
  logger.fatal({ err: error }, 'Fatal error');
  process.exit(1);
});
