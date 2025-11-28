/**
 * KEYFRAME WORKER - BILLING PROTECTION EDITION
 * 
 * This worker implements the "Idempotent State Machine" pattern.
 * Main goal: Never pay for generating the same keyframe twice.
 * 
 * Flow:
 * 1. Lock Job -> 2. Check Existing External ID -> 3. Recover OR Submit -> 4. Download/Upload
 */

import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// Load environment variables from root .env file
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

// Ensure NODE_ENV is set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { createLogger } from '@aec/logger';
import { retryFetch } from './utils/retry';
import { loadModelConfig, deepGet, isOkValue, mergeRequest } from './lib/model-config';

const logger = createLogger({ name: 'keyframe-worker' });

logger.info({ nodeEnv: process.env.NODE_ENV }, 'Worker environment initialized (Safe Mode)');

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
import { uploadLargeStream, R2_BUCKET } from '@aec/storage-client';
import { Readable } from 'stream';

// ============================================================================
// CONFIGURATION & SETUP
// ============================================================================

/**
 * Generic API response type
 */
type ApiResponse = Record<string, any>;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generates a deterministic key for idempotency.
 * Same Project + Same Scene + Same Frame Type = Same Key.
 */
function generateIdempotencyKey(projectId: string, sceneIndex: number, frameType: string): string {
  return crypto
    .createHash('sha256')
    .update(`${projectId}:${sceneIndex}:${frameType}`)
    .digest('hex');
}

/**
 * Updates the fine-grained stage of the job for observability
 */
async function updateJobStage(id: string, stage: string) {
  const db = getDrizzleClient();
  await db.update(schema.keyframeJobQueue)
    .set({ stage: stage as any, updatedAt: new Date() as any })
    .where(eq(schema.keyframeJobQueue.id, id));
}

/**
 * Asserts that the required API keys are configured based on enabled models
 */
async function assertApiConfig(): Promise<void> {
  const db = getDrizzleClient();

  // Check which providers are used by enabled models
  const enabledModels = await db
    .select({
      model: schema.aiModels,
      provider: schema.aiProviders,
    })
    .from(schema.aiModels)
    .leftJoin(schema.aiProviders, eq(schema.aiModels.providerId, schema.aiProviders.id))
    .where(eq(schema.aiModels.isEnabled, true));

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
 * Upload image bytes to Cloudflare R2
 *
 * @param imageBytes - Buffer containing image data
 * @param projectId - Project UUID
 * @param sceneIndex - Scene index (0-based)
 * @param frameType - 'first' | 'last'
 * @returns R2 object key (not a full URL, just the key)
 */
async function uploadImageToR2(
  imageBytes: Buffer,
  projectId: string,
  sceneIndex: number,
  frameType: string
): Promise<string> {
  // Generate R2 object key (path)
  const key = `keyframes/${projectId}/scene-${sceneIndex}-${frameType}-${Date.now()}.png`;

  logger.info({ key, bucket: R2_BUCKET, sizeBytes: imageBytes.length }, 'Uploading image to R2');

  // Convert Buffer to Readable stream
  const stream = Readable.from(imageBytes);

  // Upload to R2 using multipart upload
  await uploadLargeStream(key, stream, 'image/png');

  logger.info({ key }, 'Image uploaded successfully to R2');

  return key;
}

/**
 * Make authenticated API request based on provider authentication type
 */
async function makeAuthenticatedRequest(
  url: string,
  apiKey: string,
  authType: string,
  payload: any
): Promise<ApiResponse> {
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

// ============================================================================
// CORE LOGIC
// ============================================================================

/**
 * Generate image using the specified model with dynamic configuration
 * Returns both the image buffer and the external task ID (if applicable)
 */
async function generateImageWithModel(
  modelId: string,
  prompt: string,
  aspectRatio: string
): Promise<{ imageBuffer: Buffer; externalId?: string }> {
  // Load model configuration from database
  const cfg = await loadModelConfig(modelId);

  // Get API key from environment
  const apiKey = process.env[cfg.apiKeyEnvVarName];
  if (!apiKey) {
    throw new Error(`Missing API key in env: ${cfg.apiKeyEnvVarName} for provider ${cfg.providerId}`);
  }

  logger.info({ modelId, providerId: cfg.providerId }, 'Generating image with model');

  // Build request payload with defaults
  const rawPayload: Record<string, any> = {
    model: cfg.modelId,
    prompt: prompt,
    aspect_ratio: aspectRatio,
  };

  // Merge with request defaults from DB configuration
  const payload = mergeRequest(rawPayload, cfg.requestDefaults);

  logger.debug({ payload }, 'Request payload prepared');

  // Make authenticated API request
  const apiUrl = cfg.apiBaseUrl || 'https://api.minimax.io/v1';
  const imageResponse = await makeAuthenticatedRequest(
    apiUrl,
    apiKey,
    cfg.authenticationType,
    payload
  );

  // Adapt response using response adapter
  const adapter = cfg.responseAdapter ?? {};

  // Check if response is OK
  const okVal = deepGet(imageResponse, adapter.okPath);
  if (!isOkValue(okVal, adapter.okValues)) {
    const errMsg = deepGet(imageResponse, adapter.errorPath) ?? 'Unknown provider error';
    throw new Error(`Model ${cfg.modelId} error: ${String(errMsg)}`);
  }

  logger.debug('API response validated as successful');

  // Extract external ID if present (for async providers like Google Gemini)
  const dataPaths = adapter.dataPaths ?? {};
  const externalId = deepGet(imageResponse, dataPaths.task_id);

  // Extract image data based on data paths
  const b64 = deepGet(imageResponse, dataPaths.image_base64);
  const url = deepGet(imageResponse, dataPaths.url);

  let imageBuffer: Buffer;

  if (typeof b64 === 'string' && b64.length > 0) {
    // Image provided as base64
    imageBuffer = Buffer.from(b64, 'base64');
    logger.info({ imageSizeBytes: imageBuffer.length }, 'Image decoded from base64');
  } else if (typeof url === 'string' && url.length > 0) {
    // Image provided as URL - download it
    logger.debug({ imageUrl: url }, 'Downloading image from URL');
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image from ${url}: ${imageResponse.statusText}`);
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
    logger.info({ imageSizeBytes: imageBuffer.length }, 'Image downloaded from URL');
  } else {
    throw new Error(
      `Model ${cfg.modelId} responded OK but no data found at paths: ` +
      `image_base64='${dataPaths.image_base64}', url='${dataPaths.url}'`
    );
  }

  return { imageBuffer, externalId: externalId ? String(externalId) : undefined };
}

/**
 * Main Processor - Idempotent State Machine
 */
export async function processKeyframeJob() {
  const db = getDrizzleClient();

  // --------------------------------------------------------------------------
  // PHASE 1: ATOMIC ACQUISITION (WITH IDEMPOTENCY)
  // --------------------------------------------------------------------------
  const job = await db.transaction(async (tx) => {
    // Raw SQL required for SKIP LOCKED
    const result = await tx.execute(
      sql`
        SELECT * FROM jobs.keyframe_job_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `
    );

    if (!result.rows || result.rows.length === 0) return null;
    const selectedJob = result.rows[0] as any;

    // Generate idempotency key if not present
    const idemKey = selectedJob.idempotency_key || generateIdempotencyKey(
      selectedJob.project_id,
      selectedJob.scene_index,
      selectedJob.frame_type
    );

    // Immediately transition to processing and lock the idempotency key
    await tx
      .update(schema.keyframeJobQueue)
      .set({
        status: 'processing' as any,
        stage: 'checking_dupes' as any, // Initial stage
        updatedAt: new Date() as any,
        idempotencyKey: idemKey
      })
      .where(sql`${schema.keyframeJobQueue.id} = ${selectedJob.id}`);

    // Return normalized job object
    return {
      ...selectedJob,
      idempotencyKey: idemKey,
      retry_count: selectedJob.retry_count,
      project_id: selectedJob.project_id,
      scene_index: selectedJob.scene_index,
      frame_type: selectedJob.frame_type,
      external_id: selectedJob.external_id,
      model_id: selectedJob.model_id
    };
  });

  if (!job) return null;

  logger.info(
    {
      jobId: job.id,
      scene: `${job.project_id}:${job.scene_index}:${job.frame_type}`
    },
    'Job locked. Starting safety checks.'
  );

  try {
    // ------------------------------------------------------------------------
    // PHASE 2: THE WALLET GUARDIAN (Check Existing)
    // ------------------------------------------------------------------------

    const existingTaskId = job.external_id;

    if (existingTaskId) {
      logger.warn(
        { jobId: job.id, existingTaskId },
        'RECOVERY MODE: Job already has external ID. Skipping submission.'
      );
      await updateJobStage(job.id, 'waiting_external');

      // For synchronous providers, we might already have the result
      // For async providers, we'd need to poll here
      // Since most image generation is synchronous, we'll treat this as an error state
      throw new Error('Job has external_id but is in pending state - inconsistent state detected');
    }

    // ------------------------------------------------------------------------
    // PHASE 3: LOAD CONFIGURATION
    // ------------------------------------------------------------------------

    // Get aspect ratio from asset meta
    const [asset] = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.id, job.asset_id))
      .limit(1);

    if (!asset) {
      throw new Error(`Asset not found: ${job.asset_id}`);
    }

    const assetMeta = asset.meta as any;
    const aspectRatio = assetMeta?.aspectRatio || '16:9';

    // Determine which model to use
    let modelId = job.model_id;

    // If no model specified, use default text-to-image model
    if (!modelId) {
      const [defaultModel] = await db
        .select()
        .from(schema.aiModels)
        .where(
          and(
            eq(schema.aiModels.type, 'text-to-image'),
            eq(schema.aiModels.isDefault, true),
            eq(schema.aiModels.isEnabled, true)
          )
        )
        .limit(1);

      if (defaultModel) {
        modelId = defaultModel.id;
        logger.info({ modelId }, 'Using default text-to-image model');
      } else {
        throw new Error('No default text-to-image model found');
      }
    }

    // ------------------------------------------------------------------------
    // PHASE 4: SUBMISSION (If safe)
    // ------------------------------------------------------------------------
    await updateJobStage(job.id, 'submitting');

    logger.info({ jobId: job.id }, 'Submitting new task to Provider...');

    // Generate image using the specified model
    const { imageBuffer, externalId } = await generateImageWithModel(modelId, job.prompt, aspectRatio);

    // ------------------------------------------------------------------------
    // PHASE 5: COMMIT TRANSACTION (The Point of No Return)
    // ------------------------------------------------------------------------
    // If the provider returned an external ID, save it immediately
    if (externalId) {
      await db.update(schema.keyframeJobQueue).set({
        externalId: externalId,
        stage: 'waiting_external',
        updatedAt: new Date() as any
      }).where(eq(schema.keyframeJobQueue.id, job.id));

      logger.info({ jobId: job.id, externalId }, 'Task submitted & ID saved.');
    } else {
      // Synchronous response - we already have the image
      await updateJobStage(job.id, 'uploading');
    }

    // ------------------------------------------------------------------------
    // PHASE 6: UPLOAD RESULT
    // ------------------------------------------------------------------------

    // Upload to Cloudflare R2
    const r2Key = await uploadImageToR2(
      imageBuffer,
      job.project_id,
      job.scene_index,
      job.frame_type
    );

    // Update asset record with R2 key
    await db
      .update(schema.assets)
      .set({
        storageUrl: r2Key, // This field now stores the R2 key instead of a URL
        status: 'completed' as any,
        updatedAt: new Date() as any,
      })
      .where(eq(schema.assets.id, job.asset_id));

    logger.debug({ assetId: job.asset_id, r2Key }, 'Updated asset with R2 key');

    // Update job status to 'completed'
    await db
      .update(schema.keyframeJobQueue)
      .set({
        status: 'completed' as any,
        stage: 'completed' as any,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.keyframeJobQueue.id} = ${job.id}`);

    logger.info({ jobId: job.id, r2Key }, 'Job fully completed and saved');

    return job.id;

  } catch (error) {
    // ------------------------------------------------------------------------
    // ERROR HANDLING
    // ------------------------------------------------------------------------
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId: job.id, err: error }, 'Job Execution Failed');

    // Determine if retryable
    let isRetryable = false;

    // Retry network errors or rate limits
    if (errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('429') ||
      errorMessage.includes('rate limit')) {
      isRetryable = true;
    }

    if (isRetryable && (job.retry_count || 0) < 3) {
      await db.update(schema.keyframeJobQueue).set({
        status: 'pending' as any, // Return to queue
        retryCount: (job.retry_count || 0) + 1,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any
      }).where(eq(schema.keyframeJobQueue.id, job.id));

      logger.warn({ jobId: job.id, retry: (job.retry_count || 0) + 1 }, 'Job scheduled for retry');
    } else {
      await db.update(schema.keyframeJobQueue).set({
        status: 'failed' as any,
        stage: 'failed' as any,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any
      }).where(eq(schema.keyframeJobQueue.id, job.id));

      // Also update the asset status
      await db
        .update(schema.assets)
        .set({
          status: 'failed' as any,
          updatedAt: new Date() as any,
        })
        .where(eq(schema.assets.id, job.asset_id));

      logger.error({ jobId: job.id }, 'Job permanently failed');
    }

    return null;
  }
}

/**
 * Main worker loop
 */


async function main() {
  logger.info('Starting Keyframe Worker (Secure Mode)...');
  logger.info({
    geminiApiKey: !!process.env.GEMINI_API_KEY,
    minimaxApiKey: !!process.env.MINIMAX_API_KEY,
    databaseUrl: !!process.env.DATABASE_URL
  }, 'Environment configuration');

  // Fail-fast config validation
  try {
    await assertApiConfig();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to validate API configuration');
    process.exit(1);
  }

  while (true) {
    try {
      const jobId = await processKeyframeJob();

      if (!jobId) {
        // Exponential backoff logic could go here, simple sleep for now
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 sec wait if empty
      } else {
        // Job done, small cooldown
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.fatal({ err: error }, 'CRITICAL WORKER CRASH. Restarting loop in 30s...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

// Signal handlers
process.on('SIGINT', () => { logger.info('SIGINT received'); process.exit(0); });
process.on('SIGTERM', () => { logger.info('SIGTERM received'); process.exit(0); });

// Start the worker (skip in test mode)
if (process.env.NODE_ENV !== 'test') {
  main().catch(e => {
    logger.fatal({ err: e }, 'Fatal startup error');
    process.exit(1);
  });
}