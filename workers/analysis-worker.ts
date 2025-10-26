/**
 * Analysis Queue Worker
 * Processes pending analysis jobs by analyzing videos
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import {
  getDrizzleClient,
  getNextPendingAnalysisJob,
  updateAnalysisJobStatus,
  createVideoAnalysis,
  type DB,
} from '@scrimspec/db';

// Load environment variables from root
dotenvConfig({ path: resolve(__dirname, '../.env') });

const POLL_INTERVAL_MS = 5000; // 5 seconds

/**
 * Mock analyzer - in production this would call actual analysis services
 * (Gemini, NanoBanana, etc.)
 */
async function analyzeVideo(videoId: string, analyzer: string): Promise<string> {
  console.log(`  🔬 Analyzing video ${videoId} with ${analyzer}...`);

  // Simulate analysis time
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // In production, this would:
  // 1. Fetch video metadata
  // 2. Download/stream video
  // 3. Run analysis (emotional architecture, frame detection, etc.)
  // 4. Upload results to storage
  // 5. Return storage URL

  // For now, return mock analysis URL
  return `https://storage.example.com/analysis/${videoId}_${analyzer}_${Date.now()}.json`;
}

/**
 * Process a single analysis job
 */
async function processAnalysisJob(db: DB) {
  // Get next pending job
  const job = await getNextPendingAnalysisJob(db);
  if (!job) {
    return false; // No jobs to process
  }

  console.log(`🔬 Processing analysis job ${job.id}:`, {
    videoId: job.videoId,
    analyzer: job.analyzer,
  });

  try {
    // Update status to processing
    await updateAnalysisJobStatus(db, job.id, 'processing');

    // Run analysis
    const analysisUrl = await analyzeVideo(job.videoId, job.analyzer);

    // Create video_analysis record
    await createVideoAnalysis(db, {
      videoId: job.videoId,
      analyzer: job.analyzer,
      analysisUrl,
      metadata: {
        processedAt: new Date().toISOString(),
        jobId: job.id,
      },
    });

    // Update job status to completed
    await updateAnalysisJobStatus(db, job.id, 'completed');

    console.log(`  ✅ Analysis complete: ${analysisUrl}`);

    return true; // Job processed successfully
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Failed to process job ${job.id}:`, errorMessage);

    // Update job status to failed
    await updateAnalysisJobStatus(db, job.id, 'failed', errorMessage);

    return true; // Job attempted (failed)
  }
}

/**
 * Main worker loop
 */
async function main() {
  console.log('🚀 Analysis Queue Worker started');
  console.log(`   Polling interval: ${POLL_INTERVAL_MS}ms`);
  console.log('');

  const db = getDrizzleClient();

  // Main loop
  while (true) {
    try {
      const processed = await processAnalysisJob(db);

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
