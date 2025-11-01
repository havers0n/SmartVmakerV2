import { startAnalysisPayloadSchema } from '@scrimspec/core-domain';
import { getDrizzleClient, schema } from '@scrimspec/db';
import { ZodError } from 'zod';
import { inArray } from 'drizzle-orm';
import { createLogger } from '@aec/logger';

const logger = createLogger({ name: 'api-analysis' });

/**
 * Start analysis for selected videos
 * - Validates payload
 * - Checks which videos don't have analysis yet
 * - Creates analysis jobs only for videos without existing analysis
 */
export async function startAnalysis(payload: unknown) {
  try {
    // Step 1: Validate payload
    const validatedPayload = startAnalysisPayloadSchema.parse(payload);
    const { videoIds } = validatedPayload;

    logger.info({ videoCount: videoIds.length }, 'Starting analysis for videos');

    const db = getDrizzleClient();

    // Step 2: Check which videos already have analysis results
    const existingAnalysis = await db
      .select({ videoId: schema.analysisResults.videoId })
      .from(schema.analysisResults)
      .where(inArray(schema.analysisResults.videoId, videoIds)); // <-- Fixed: replaced sql`${schema.analysisResults.videoId} = ANY(${videoIds})` with inArray

    const existingVideoIds = new Set(
      existingAnalysis.map((result) => result.videoId)
    );

    // Step 3: Filter out videos that already have analysis
    const idsToAnalyze = videoIds.filter((id) => !existingVideoIds.has(id));

    // Step 4: If all videos already analyzed, return early
    if (idsToAnalyze.length === 0) {
      logger.info({ totalRequested: videoIds.length }, 'All videos already analyzed');
      return {
        success: true,
        message: 'All selected videos have already been analyzed',
        data: {
          totalRequested: videoIds.length,
          alreadyAnalyzed: videoIds.length,
          newJobsCreated: 0,
        },
      };
    }

    // Step 5: Create analysis jobs for videos without analysis
    const jobsToInsert = idsToAnalyze.map((videoId) => ({
      videoId,
      analyzer: 'default', // Default analyzer name
      status: 'pending' as const,
      retryCount: 0,
    }));

    await db.insert(schema.analysisJobQueue).values(jobsToInsert as any);

    // Step 6: Return success message
    const alreadyAnalyzedCount = videoIds.length - idsToAnalyze.length;

    logger.info({
      newJobsCreated: idsToAnalyze.length,
      alreadyAnalyzed: alreadyAnalyzedCount
    }, 'Analysis jobs created');

    return {
      success: true,
      message: `Successfully created ${idsToAnalyze.length} analysis job${idsToAnalyze.length === 1 ? '' : 's'}${
        alreadyAnalyzedCount > 0
          ? `. ${alreadyAnalyzedCount} video${alreadyAnalyzedCount === 1 ? ' was' : 's were'} already analyzed.`
          : '.'
      }`,
      data: {
        totalRequested: videoIds.length,
        alreadyAnalyzed: alreadyAnalyzedCount,
        newJobsCreated: idsToAnalyze.length,
      },
    };
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return {
        success: false,
        message: 'Invalid payload',
        errors: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      };
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, 'Failed to start analysis');

    return {
      success: false,
      message: 'Failed to start analysis',
      error: errorMessage,
    };
  }
}