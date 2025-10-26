/**
 * Ingest Queue Worker
 * Processes pending ingest jobs by fetching videos from YouTube
 * and storing them in the database
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import {
  getDrizzleClient,
  getNextPendingIngestJob,
  updateIngestJobStatus,
  upsertYouTubeVideo,
  createAnalysisJob,
  type DB,
} from '@scrimspec/db';

// Load environment variables from root
dotenvConfig({ path: resolve(__dirname, '../.env') });

// YouTube API integration
import { searchYouTubeVideos } from './youtube';

const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_VIDEOS_PER_JOB = 50;

/**
 * Process a single ingest job
 */
async function processIngestJob(db: DB) {
  // Get next pending job
  const job = await getNextPendingIngestJob(db);
  if (!job) {
    return false; // No jobs to process
  }

  console.log(`📥 Processing ingest job ${job.id}:`, {
    query: job.query,
    duration: job.duration,
    publishedAfter: job.publishedAfter,
  });

  try {
    // Update status to processing
    await updateIngestJobStatus(db, job.id, 'processing');

    // Search YouTube
    const result = await searchYouTubeVideos({
      query: job.query,
      duration: job.duration as 'short' | 'medium' | 'long',
      publishedAfter: job.publishedAfter || undefined,
      maxResults: MAX_VIDEOS_PER_JOB,
    });

    console.log(`  ✅ Found ${result.videos.length} videos`);

    // Store videos in database
    let videosSaved = 0;
    let analysisJobsCreated = 0;

    for (const video of result.videos) {
      try {
        // Upsert video
        await upsertYouTubeVideo(db, video);
        videosSaved++;

        // Create analysis job for this video (auto-queue for analysis)
        await createAnalysisJob(db, {
          videoId: video.id,
          analyzer: 'gemini', // Default analyzer
          status: 'pending',
        });
        analysisJobsCreated++;
      } catch (error) {
        console.error(`  ⚠️  Failed to save video ${video.id}:`, error);
      }
    }

    // Update job status to completed
    await updateIngestJobStatus(db, job.id, 'completed');

    console.log(`  ✅ Saved ${videosSaved} videos, queued ${analysisJobsCreated} analysis jobs`);

    return true; // Job processed successfully
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Failed to process job ${job.id}:`, errorMessage);

    // Update job status to failed
    await updateIngestJobStatus(db, job.id, 'failed', errorMessage);

    return true; // Job attempted (failed)
  }
}

/**
 * Main worker loop
 */
async function main() {
  console.log('🚀 Ingest Queue Worker started');
  console.log(`   Polling interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`   Max videos per job: ${MAX_VIDEOS_PER_JOB}`);
  console.log('');

  const db = getDrizzleClient();

  // Main loop
  while (true) {
    try {
      const processed = await processIngestJob(db);

      if (!processed) {
        // No jobs to process, wait before polling again
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      } else {
        // Job was processed, check immediately for next job
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('❌ Unexpected error in worker loop:', error);
      // Wait before retrying on error
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down worker...');
  process.exit(0);
});

// Start worker
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
