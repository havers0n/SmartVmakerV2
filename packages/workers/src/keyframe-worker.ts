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

import { getDrizzleClient, schema, sql, getSupabaseClient } from '@scrimspec/db';
import { eq } from 'drizzle-orm';

/**
 * Gemini Image Generation API response interface
 */
interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType: string;
          data: string; // base64 encoded image
        };
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Asserts that the Gemini API key is configured
 */
async function assertGeminiConfig(): Promise<void> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  logger.info('Gemini API key configured');
}

/**
 * Upload image bytes to Supabase Storage
 */
async function uploadImageToStorage(
  imageBytes: Buffer,
  projectId: string,
  sceneIndex: number,
  frameType: string
): Promise<string> {
  const supabase = getSupabaseClient();

  // Generate file name
  const fileName = `${projectId}/scene-${sceneIndex}-${frameType}-${Date.now()}.png`;
  const bucketName = 'keyframes'; // You may need to create this bucket in Supabase

  logger.info({ fileName, bucket: bucketName }, 'Uploading image to storage');

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, imageBytes, {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image to storage: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  logger.info({ publicUrl: publicUrlData.publicUrl }, 'Image uploaded successfully');

  return publicUrlData.publicUrl;
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
        frameType: job.frame_type
      },
      'Processing keyframe job'
    );

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Use Gemini 2.5 Flash Image model
    const geminiModel = 'gemini-2.5-flash-image';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

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

    // Prepare request body for Gemini Image Generation
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: job.prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "image/png",
        responseModalities: ["IMAGE"],
        // Gemini specific image generation parameters
        imageGenerationConfig: {
          aspectRatio: aspectRatio,
          negativePrompt: "blurry, low quality, distorted, ugly, watermark, text, logo",
        },
      },
    };

    logger.debug({ prompt: job.prompt, aspectRatio }, 'Sending request to Gemini Image API');

    // Step 2: Call Gemini API with retry logic
    const geminiResponse: GeminiImageResponse = await retryFetch(
      async () => {
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Gemini Image API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return response.json();
      },
      logger,
      { retries: 3 }
    );

    // Check for errors in response
    if (geminiResponse.error) {
      throw new Error(
        `Gemini Image API returned error: ${geminiResponse.error.message} (${geminiResponse.error.status})`
      );
    }

    // Extract image data from response
    const imageData = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!imageData || !imageData.data) {
      throw new Error('Gemini Image API returned empty response or no image data');
    }

    logger.debug('Received image data from Gemini API');

    // Step 3: Convert base64 to buffer
    const imageBuffer = Buffer.from(imageData.data, 'base64');

    logger.info({ imageSizeBytes: imageBuffer.length }, 'Image decoded successfully');

    // Step 4: Upload to Supabase Storage
    const storageUrl = await uploadImageToStorage(
      imageBuffer,
      job.project_id,
      job.scene_index,
      job.frame_type
    );

    // Step 5: Update asset record with storage URL
    await db
      .update(schema.assets)
      .set({
        storageUrl,
        status: 'completed' as any,
        updatedAt: new Date() as any,
      })
      .where(eq(schema.assets.id, job.asset_id));

    logger.debug({ assetId: job.asset_id, storageUrl }, 'Updated asset with storage URL');

    // Step 6: Update job status to 'completed'
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
    databaseUrl: !!process.env.DATABASE_URL
  }, 'Environment configuration');
  logger.info('Worker generates keyframes using Gemini 2.5 Flash Image and uploads to Supabase Storage');

  // Fail-fast config validation
  try {
    await assertGeminiConfig();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to validate Gemini configuration');
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
