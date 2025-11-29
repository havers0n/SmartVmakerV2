// packages/hwar-core/src/analysis/handler.ts

import { HwarDeps } from '../index';
import { JobRecord } from '../jobs/types';
import { eq } from 'drizzle-orm';
import { analysisResults, youtubeVideos, analysisJobQueue } from '@scrimspec/db'; // Import schema directly

// Define specific job type
export interface AnalysisJob extends JobRecord {
    videoId: string;
    analyzer: string;
}

export function createAnalysisHandler(deps: HwarDeps) {
    return async (job: AnalysisJob) => {
        const { db, logger, aiRouter } = deps;

        logger.info({ jobId: job.id, videoId: job.videoId }, 'Processing analysis job');

        // 1. Check if result already exists (Idempotency)
        const existing = await db.select()
            .from(analysisResults)
            .where(eq(analysisResults.videoId, job.videoId))
            .limit(1);

        if (existing.length > 0) {
            logger.info({ videoId: job.videoId }, 'Analysis already exists, skipping');
            return; // JobProcessor will mark as completed
        }

        // 2. Fetch Video Data
        const videoData = await db.select()
            .from(youtubeVideos)
            .where(eq(youtubeVideos.id, job.videoId))
            .limit(1);

        if (videoData.length === 0) {
            throw new Error(`Video not found: ${job.videoId}`);
        }
        const video = videoData[0];

        // 3. Call AI Router
        // We update stage to 'submitting'
        // Note: JobProcessor doesn't expose a way to update stage easily inside handler unless we pass the repo or use db directly.
        // We'll use db directly for granular updates.
        await db.update(analysisJobQueue)
            .set({ stage: 'submitting', updatedAt: new Date() })
            .where(eq(analysisJobQueue.id, job.id));

        const result = await aiRouter.analyzeVideo({
            videoUrl: video.url,
            videoId: video.id,
            analyzerName: job.analyzer
        });

        // 4. Save Result
        await db.insert(analysisResults).values({
            videoId: job.videoId,
            analyzer: job.analyzer,
            analysisUrl: video.url,
            aesBreakdown: result,
            emotionalTags: result.emotion_tags,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        logger.info({ jobId: job.id }, 'Analysis saved successfully');
    };
}
