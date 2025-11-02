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

const logger = createLogger({ name: 'keyframe-worker' });

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
import { uploadLargeStream, R2_BUCKET } from '@aec/storage-client';
import { Readable } from 'stream';

/**
 * Generic API response type
 */
type ApiResponse = Record<string, any>;

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

/**
 * Generate image using the specified model with dynamic configuration
 */
async function generateImageWithModel(modelId: string, prompt: string, aspectRatio: string): Promise<Buffer> {
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

  // Extract image data based on data paths
  const dataPaths = adapter.dataPaths ?? {};
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

  return imageBuffer;
}

/**
 * Process a single keyframe generation job
 */
async function processKeyframeJob() {
  const db = getDrizzleClient();

  // Step 1: Atomic job capture using transaction and FOR UPDATE SKIP LOCKED
  const job = await db.transaction(async (tx) => {
    // Use raw SQL for FOR UPDATE SKIP LOCKED
    const result = await tx.execute(
      sql`
        SELECT * FROM jobs.keyframe_job_queue
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
      .update(schema.keyframeJobQueue)
      .set({
        status: 'processing' as any,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.keyframeJobQueue.id} = ${selectedJob.id}`);

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
        frameType: job.frame_type,
        modelId: job.model_id
      },
      'Processing keyframe job'
    );

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

    // Generate image using the specified model
    const imageBuffer = await generateImageWithModel(modelId, job.prompt, aspectRatio);

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
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.keyframeJobQueue.id} = ${job.id}`);

    logger.info({ jobId: job.id }, 'Keyframe job completed successfully');

    return job.id;

  } catch (error) {
    // Step 7: Handle errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({ err: error, jobId: job.id }, 'Keyframe job failed');

    // Update job status to 'failed' with error message
    await db
      .update(schema.keyframeJobQueue)
      .set({
        status: 'failed' as any,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.keyframeJobQueue.id} = ${job.id}`);

    // Also update the asset status
    await db
      .update(schema.assets)
      .set({
        status: 'failed' as any,
        updatedAt: new Date() as any,
      })
      .where(eq(schema.assets.id, job.asset_id));

    return null;
  }
}

/**
 * Main worker loop
 */
async function main() {
  logger.info('Starting keyframe worker');
  logger.info({
    geminiApiKey: !!process.env.GEMINI_API_KEY,
    minimaxApiKey: !!process.env.MINIMAX_API_KEY,
    databaseUrl: !!process.env.DATABASE_URL
  }, 'Environment configuration');
  logger.info('Worker generates keyframes using multiple AI providers and uploads to Cloudflare R2');

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