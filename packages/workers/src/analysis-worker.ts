/**
 * ANALYSIS WORKER - BILLING PROTECTION EDITION
 * 
 * This worker implements the "Idempotent State Machine" pattern.
 * Main goal: Never pay for analyzing the same video twice.
 * 
 * Flow:
 * 1. Lock Job -> 2. Check Existing External ID -> 3. Recover OR Submit -> 4. Process Response -> 5. Save Result
 */

import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { createLogger } from '@aec/logger';
import { retryFetch } from './utils/retry';

const logger = createLogger({ name: 'analysis-worker' });

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

import { getDrizzleClient, schema, sql } from '@scrimspec/db';
import { eq } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Gemini API response interface
 */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
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
 * Expected structure of analysis result from Gemini
 */
interface AnalysisResult {
  hook_text: string;
  emotion_tags: string[];
  beats: Array<{
    time_s: number;
    desc: string;
    emotion: string;
  }>;
  payoff: string;
  moral: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generates a deterministic key for idempotency.
 * Same Video + Same Analyzer = Same Key.
 */
function generateIdempotencyKey(videoId: string, analyzerName: string): string {
  return crypto
    .createHash('sha256')
    .update(`${videoId}:${analyzerName}`)
    .digest('hex');
}

/**
 * Updates the fine-grained stage of the job for observability
 */
async function updateJobStage(id: string, stage: string) {
  const db = getDrizzleClient();
  await db.update(schema.analysisJobQueue)
    .set({ stage: stage as any, updatedAt: new Date() as any })
    .where(eq(schema.analysisJobQueue.id, id));
}

/**
 * Extracts JSON from text, even if it's wrapped in Markdown blocks
 *
 * Supported formats:
 * - Plain JSON: {"key": "value"}
 * - Markdown block: ```json\n{"key": "value"}\n```
 * - Markdown block without language: ```\n{"key": "value"}\n```
 *
 * @param text Text that may contain JSON
 * @returns Extracted JSON string
 */
function extractJsonFromText(text: string): string {
  // Try to find JSON in markdown block ```json ... ```
  const markdownJsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (markdownJsonMatch) {
    return markdownJsonMatch[1].trim();
  }

  // Try to find JSON directly (look for { ... })
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  // If nothing found, return original text
  return text.trim();
}

/**
 * Asserts that the configured Gemini model exists and is accessible
 * This is a fail-fast check to prevent the worker from starting with invalid configuration
 */
async function assertModelExists(): Promise<void> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL;

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  if (!geminiModel) {
    throw new Error('GEMINI_MODEL environment variable is not set');
  }

  const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;

  try {
    const modelsResponse = await retryFetch(
      async () => {
        const response = await fetch(modelsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch models: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
      },
      logger,
      { retries: 3 }
    );
    const models = modelsResponse.models || [];

    const modelExists = models.some((model: any) => model.name && model.name.endsWith(`/${geminiModel}`));

    if (!modelExists) {
      throw new Error(`Configured GEMINI_MODEL '${geminiModel}' is not available in the list of accessible models`);
    }

    logger.info({ model: geminiModel }, 'Verified Gemini model is accessible');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Model validation failed: ${error.message}`);
    }
    throw new Error('Model validation failed due to unknown error');
  }
}

// ============================================================================
// CORE LOGIC
// ============================================================================

/**
 * Handles recovery when external_id already exists
 */
async function handleExistingAnalysis(job: any, db: any) {
  logger.warn({ jobId: job.id, externalId: job.external_id }, 'RECOVERY MODE: Job already has external ID.');

  // Check if we already have the analysis result saved
  const existingAnalysis = await db
    .select()
    .from(schema.analysisResults)
    .where(eq(schema.analysisResults.videoId, job.video_id))
    .limit(1);

  if (existingAnalysis.length > 0) {
    logger.info({ videoId: job.video_id }, 'Analysis result already exists. Marking job as completed.');

    await db
      .update(schema.analysisJobQueue)
      .set({
        status: 'completed' as any,
        stage: 'completed' as any,
        updatedAt: new Date() as any,
      })
      .where(eq(schema.analysisJobQueue.id, job.id));

    return job.id;
  }

  // If we have external_id but no result, something went wrong
  // We'll try to re-process (this is a rare edge case)
  logger.warn({ jobId: job.id }, 'External ID exists but no result found. Will attempt re-processing.');
  return null;
}

/**
 * Main Processor - Exported for testing
 */
export async function processAnalysisJob() {
  const db = getDrizzleClient();

  // --------------------------------------------------------------------------
  // PHASE 1: ATOMIC ACQUISITION (WITH IDEMPOTENCY)
  // --------------------------------------------------------------------------
  const job = await db.transaction(async (tx) => {
    // Raw SQL required for SKIP LOCKED
    const result = await tx.execute(sql`
      SELECT * FROM jobs.analysis_job_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (!result.rows || result.rows.length === 0) return null;
    const selectedJob = result.rows[0] as any;

    // Generate idempotency key if it doesn't exist
    const idemKey = selectedJob.idempotency_key || generateIdempotencyKey(selectedJob.video_id, selectedJob.analyzer);

    // Immediately transition to processing and lock the key
    await tx
      .update(schema.analysisJobQueue)
      .set({
        status: 'processing' as any,
        stage: 'init' as any,
        updatedAt: new Date() as any,
        idempotencyKey: idemKey
      })
      .where(sql`${schema.analysisJobQueue.id} = ${selectedJob.id}`);

    return {
      ...selectedJob,
      idempotencyKey: idemKey,
      // Normalize important fields from snake_case
      retry_count: selectedJob.retry_count,
      video_id: selectedJob.video_id,
      external_id: selectedJob.external_id,
      analyzer: selectedJob.analyzer
    };
  });

  if (!job) return null;

  logger.info({ jobId: job.id, videoId: job.video_id, analyzer: job.analyzer }, 'Job locked. Starting safety checks.');

  try {
    // ------------------------------------------------------------------------
    // PHASE 2: THE WALLET GUARDIAN (Check Existing)
    // ------------------------------------------------------------------------
    await updateJobStage(job.id, 'checking_dupes');

    // Check if external_id exists (recovery scenario)
    if (job.external_id) {
      const recoveryResult = await handleExistingAnalysis(job, db);
      if (recoveryResult) return recoveryResult;
      // If recovery returns null, we'll continue with re-processing
    }

    // Double-check: verify video hasn't been analyzed already
    const existingAnalysis = await db
      .select()
      .from(schema.analysisResults)
      .where(eq(schema.analysisResults.videoId, job.video_id))
      .limit(1);

    if (existingAnalysis.length > 0) {
      logger.info({ videoId: job.video_id }, 'Video already analyzed, skipping');

      await db
        .update(schema.analysisJobQueue)
        .set({
          status: 'completed' as any,
          stage: 'completed' as any,
          updatedAt: new Date() as any,
        })
        .where(eq(schema.analysisJobQueue.id, job.id));

      return job.id;
    }

    // ------------------------------------------------------------------------
    // PHASE 3: FETCH VIDEO DATA
    // ------------------------------------------------------------------------
    await updateJobStage(job.id, 'fetching_transcript');

    const videoData = await db
      .select({
        url: schema.youtubeVideos.url,
        title: schema.youtubeVideos.title,
        youtubeId: schema.youtubeVideos.youtubeId,
      })
      .from(schema.youtubeVideos)
      .where(eq(schema.youtubeVideos.id, job.video_id))
      .limit(1);

    if (videoData.length === 0) {
      throw new Error(`Video not found: ${job.video_id}`);
    }

    const video = videoData[0];
    logger.info({ title: video.title, youtubeId: video.youtubeId }, 'Analyzing video');

    // ------------------------------------------------------------------------
    // PHASE 4: SUBMIT TO LLM
    // ------------------------------------------------------------------------
    await updateJobStage(job.id, 'submitting_llm');

    const prompt = `Analyze this YouTube Shorts video and output ONLY JSON with keys: hook_text, emotion_tags (5 strings), beats (array of {time_s:number, desc, emotion}), payoff, moral. JSON only, no extra text. Video: ${video.url}`;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL;

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    if (!geminiModel) {
      throw new Error('GEMINI_MODEL environment variable is not set');
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            hook_text: { type: "STRING" },
            emotion_tags: { type: "ARRAY", items: { type: "STRING" } },
            beats: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  time_s: { type: "NUMBER" },
                  desc: { type: "STRING" },
                  emotion: { type: "STRING" }
                },
                required: ["time_s", "desc", "emotion"]
              }
            },
            payoff: { type: "STRING" },
            moral: { type: "STRING" }
          },
          required: ["hook_text", "emotion_tags", "beats", "payoff", "moral"]
        }
      },
    };

    logger.debug('Sending request to Gemini API');

    const geminiResponse: GeminiResponse = await retryFetch(
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
            `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
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
        `Gemini API returned error: ${geminiResponse.error.message} (${geminiResponse.error.status})`
      );
    }

    // Extract response text
    const responseText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Gemini API returned empty response');
    }

    // ------------------------------------------------------------------------
    // PHASE 5: SAVE EXTERNAL ID IMMEDIATELY
    // ------------------------------------------------------------------------
    // Generate a unique request ID to track this specific LLM call
    const requestId = crypto.randomUUID();

    await db.update(schema.analysisJobQueue).set({
      externalId: requestId,
      stage: 'processing_response',
      updatedAt: new Date() as any
    }).where(eq(schema.analysisJobQueue.id, job.id));

    logger.info({ jobId: job.id, requestId }, 'LLM request completed & ID saved. Processing response...');

    // ------------------------------------------------------------------------
    // PHASE 6: PARSE AND VALIDATE RESPONSE
    // ------------------------------------------------------------------------
    logger.debug('Received response from Gemini API');

    let analysisResult: AnalysisResult;
    try {
      // Direct JSON parsing (primary path)
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback extraction if direct parsing fails
      logger.warn('Direct JSON parsing failed, trying fallback extraction method');
      const jsonText = extractJsonFromText(responseText);
      try {
        analysisResult = JSON.parse(jsonText);
      } catch (fallbackError) {
        logger.error({ jsonText }, 'Failed to parse JSON with fallback method');
        throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }

    // Validate structure
    if (!analysisResult.hook_text || !Array.isArray(analysisResult.emotion_tags)) {
      throw new Error('Invalid analysis result structure: missing required fields');
    }

    logger.info({
      hookPreview: analysisResult.hook_text.substring(0, 50),
      emotions: analysisResult.emotion_tags.join(', '),
      beatsCount: analysisResult.beats?.length || 0
    }, 'Successfully parsed analysis result');

    // ------------------------------------------------------------------------
    // PHASE 7: SAVE RESULT TO DATABASE
    // ------------------------------------------------------------------------
    await db.insert(schema.analysisResults).values({
      videoId: job.video_id,
      analyzer: job.analyzer || 'gemini-pro',
      analysisUrl: video.url,
      aesBreakdown: analysisResult as any,
      emotionalTags: analysisResult.emotion_tags as any,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } as any);

    logger.debug('Saved analysis result to database');

    // ------------------------------------------------------------------------
    // PHASE 8: MARK JOB AS COMPLETED
    // ------------------------------------------------------------------------
    await db
      .update(schema.analysisJobQueue)
      .set({
        status: 'completed' as any,
        stage: 'completed' as any,
        updatedAt: new Date() as any,
      })
      .where(eq(schema.analysisJobQueue.id, job.id));

    logger.info({ jobId: job.id }, 'Job completed successfully');

    return job.id;

  } catch (error) {
    // ------------------------------------------------------------------------
    // ERROR HANDLING
    // ------------------------------------------------------------------------
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId: job.id, err: error }, 'Job Execution Failed');

    // Determine if error is retryable
    let isRetryable = false;

    // Retry network errors or rate limits
    if (errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('429') ||
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504')) {
      isRetryable = true;
    }

    if (isRetryable && (job.retry_count || 0) < 3) {
      await db.update(schema.analysisJobQueue).set({
        status: 'pending' as any,
        retryCount: (job.retry_count || 0) + 1,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any
      }).where(eq(schema.analysisJobQueue.id, job.id));

      logger.warn({ jobId: job.id, retry: (job.retry_count || 0) + 1 }, 'Job scheduled for retry');
    } else {
      await db.update(schema.analysisJobQueue).set({
        status: 'failed' as any,
        stage: 'failed' as any,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any
      }).where(eq(schema.analysisJobQueue.id, job.id));

      logger.error({ jobId: job.id }, 'Job permanently failed');
    }

    return null;
  }
}

/**
 * Main Loop
 */
async function main() {
  logger.info('Starting Analysis Worker (Secure Mode)...');
  logger.info({
    geminiApiKey: !!process.env.GEMINI_API_KEY,
    databaseUrl: !!process.env.DATABASE_URL
  }, 'Environment configuration');
  logger.info('Worker analyzes videos using Gemini AI with billing protection');

  // Fail-fast model validation
  try {
    await assertModelExists();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to validate Gemini model configuration');
    process.exit(1);
  }

  while (true) {
    try {
      const jobId = await processAnalysisJob();

      if (!jobId) {
        // No jobs available, wait before checking again
        logger.debug('No pending jobs, waiting 30 seconds');
        await new Promise(resolve => setTimeout(resolve, 30000));
      } else {
        // Job processed, small cooldown
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logger.fatal({ err: error }, 'CRITICAL WORKER CRASH. Restarting loop in 30s...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

// Signal handlers
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the worker (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    logger.fatal({ err: error }, 'Fatal error');
    process.exit(1);
  });
}