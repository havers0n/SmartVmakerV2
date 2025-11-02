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
import { loadModelConfig, deepGet, isOkValue, mergeRequest } from './lib/model-config';

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
import { eq, and } from 'drizzle-orm';
import { HaluApiError, MinimaxErrorCode } from '@scrimspec/halu-client';
import { createDownloadUrl, uploadLargeStream, R2_BUCKET } from '@aec/storage-client';
import { Readable } from 'stream';

/**
 * Asserts that the required API keys are configured based on enabled models
 */
async function assertApiConfig(): Promise<void> {
  const db = getDrizzleClient();

  // Check which providers are used by enabled video generation models
  const enabledModels = await db
    .select({
      model: schema.aiModels,
      provider: schema.aiProviders,
    })
    .from(schema.aiModels)
    .leftJoin(schema.aiProviders, eq(schema.aiModels.providerId, schema.aiProviders.id))
    .where(and(eq(schema.aiModels.isEnabled, true), eq(schema.aiModels.type, 'text-to-video')));

  const requiredEnvVars: string[] = [];

  for (const { provider } of enabledModels) {
    if (provider && provider.apiKeyEnvVarName && !requiredEnvVars.includes(provider.apiKeyEnvVarName)) {
      requiredEnvVars.push(provider.apiKeyEnvVarName);
    }
  }

  // Check that all required environment variables are set
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }

  logger.info({ requiredEnvVars }, 'API configuration validated');
}

/**
 * Make authenticated API request based on provider authentication type
 */
async function makeAuthenticatedRequest(
  url: string,
  apiKey: string,
  authType: string,
  payload: any
): Promise<Record<string, any>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Apply authentication based on type
  switch (authType) {
    case 'bearer_token':
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    case 'api_key_header':
      headers['X-API-Key'] = apiKey;
      break;
    case 'query_param':
      // Add API key to URL query params
      const urlObj = new URL(url);
      urlObj.searchParams.set('key', apiKey);
      url = urlObj.toString();
      break;
    default:
      throw new Error(`Unsupported authentication type: ${authType}`);
  }

  logger.debug({ url, authType }, 'Making authenticated API request');

  const response = await retryFetch(
    async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `API error: ${res.status} ${res.statusText} - ${errorText}`
        );
      }

      return res.json();
    },
    logger,
    { retries: 3 }
  );

  return response;
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
        modelId: job.model_id,
      },
      'Processing animation job'
    );

    // Step 2: Load keyframe assets
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
    const firstFrameUrl = await createDownloadUrl(
      firstFrameAsset.storageUrl,
      3600 // 1 hour
    );

    const lastFrameUrl = await createDownloadUrl(
      lastFrameAsset.storageUrl,
      3600 // 1 hour
    );

    logger.info({ firstFrameUrl, lastFrameUrl }, 'Generated presigned URLs for keyframes');

    // Step 4: Load model configuration
    let modelId = job.model_id;

    // If no model specified, use default text-to-video model
    if (!modelId) {
      const [defaultModel] = await db
        .select()
        .from(schema.aiModels)
        .where(
          and(
            eq(schema.aiModels.type, 'text-to-video'),
            eq(schema.aiModels.isDefault, true),
            eq(schema.aiModels.isEnabled, true)
          )
        )
        .limit(1);

      if (defaultModel) {
        modelId = defaultModel.id;
        logger.info({ modelId }, 'Using default text-to-video model');
      } else {
        throw new Error('No default text-to-video model found');
      }
    }

    const cfg = await loadModelConfig(modelId);
    const apiKey = process.env[cfg.apiKeyEnvVarName];
    if (!apiKey) {
      throw new Error(`Missing API key in env: ${cfg.apiKeyEnvVarName} for provider ${cfg.providerId}`);
    }

    // Get webhook URL from environment
    const webhookUrl = process.env.HALU_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/halu`;

    // Step 5: Build request payload with defaults
    const rawPayload: Record<string, any> = {
      model: cfg.modelId,
      first_frame_image: firstFrameUrl,
      last_frame_image: lastFrameUrl,
      prompt: job.scene_description || 'Smooth transition between frames',
      callback_url: webhookUrl,
    };

    // Merge with request defaults from DB configuration
    const payload = mergeRequest(rawPayload, cfg.requestDefaults);

    logger.debug({ payload }, 'Request payload prepared');

    // Step 6: Make authenticated API request
    const apiUrl = cfg.apiBaseUrl || 'https://api.minimax.io/v1';
    const videoResponse = await makeAuthenticatedRequest(
      apiUrl,
      apiKey,
      cfg.authenticationType,
      payload
    );

    // Step 7: Adapt response using response adapter
    const adapter = cfg.responseAdapter ?? {};

    // Check if response is OK
    const okVal = deepGet(videoResponse, adapter.okPath);
    if (!isOkValue(okVal, adapter.okValues)) {
      const errMsg = deepGet(videoResponse, adapter.errorPath) ?? 'Unknown provider error';
      throw new Error(`Model ${cfg.modelId} error: ${String(errMsg)}`);
    }

    logger.debug('API response validated as successful');

    // Extract data based on data paths
    const dataPaths = adapter.dataPaths ?? {};
    const url = deepGet(videoResponse, dataPaths.url);
    const taskId = deepGet(videoResponse, dataPaths.task_id);

    // Scenario 1: Provider returned video URL immediately (synchronous)
    if (typeof url === 'string' && url.length > 0) {
      logger.info({ videoUrl: url }, 'Received synchronous video URL');

      // Download and upload to R2
      const videoBytes = await fetch(url).then(res => res.arrayBuffer()).then(ab => Buffer.from(ab));
      const r2Key = await uploadVideoToR2(videoBytes, job.project_id, job.scene_index);

      // Update job to completed
      await db
        .update(schema.animationJobQueue)
        .set({
          status: 'completed' as any,
          updatedAt: new Date() as any,
        })
        .where(sql`${schema.animationJobQueue.id} = ${job.id}`);

      logger.info({ jobId: job.id, r2Key }, 'Animation job completed synchronously');
      return job.id;
    }

    // Scenario 2: Provider returned task_id for asynchronous processing
    if (typeof taskId === 'string' && taskId.length > 0) {
      logger.info({ taskId }, 'Received asynchronous task_id');

      // Save task_id to job record - webhook will complete it later
      await db
        .update(schema.animationJobQueue)
        .set({
          haluTaskId: taskId,
          updatedAt: new Date() as any,
        })
        .where(sql`${schema.animationJobQueue.id} = ${job.id}`);

      logger.info({ jobId: job.id, taskId }, 'Animation job submitted for async processing');

      // Job remains in 'processing' status
      // Webhook will update it to 'completed' when provider finishes
      return job.id;
    }

    // No url or task_id found
    throw new Error(
      `Model ${cfg.modelId} responded OK but no url/task_id found at paths: ` +
      `url='${dataPaths.url}', task_id='${dataPaths.task_id}'`
    );

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
    databaseUrl: !!process.env.DATABASE_URL,
    webhookUrl: process.env.HALU_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/halu`,
  }, 'Environment configuration');
  logger.info('Worker animates keyframe pairs using configured AI video generation providers');

  // Fail-fast config validation
  try {
    await assertApiConfig();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to validate API configuration');
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