import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@aec/logger';
import { db } from '@/shared/lib/db';
import { animationJobQueue, assets, generationProjects } from '@/shared/lib/schema';
import { eq } from 'drizzle-orm';
import { HaluClient } from '@scrimspec/halu-client';
import { uploadLargeStream } from '@aec/storage-client';
import { Readable } from 'stream';

const logger = createLogger({ name: 'halu-webhook' });

/**
 * Upload video buffer to Cloudflare R2
 */
async function uploadVideoToR2(
  videoBuffer: Buffer,
  projectId: string,
  sceneIndex: number
): Promise<string> {
  const key = `animations/${projectId}/scene-${sceneIndex}-${Date.now()}.mp4`;

  logger.info({ key, sizeBytes: videoBuffer.length }, 'Uploading video to R2');

  const stream = Readable.from(videoBuffer);
  await uploadLargeStream(key, stream, 'video/mp4');

  logger.info({ key }, 'Video uploaded successfully to R2');

  return key;
}

/**
 * HALU Webhook Handler
 *
 * Handles two types of requests:
 * 1. Challenge validation (initial webhook setup)
 * 2. Status updates (processing, success, failed)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    logger.info({ body }, 'Received HALU webhook request');

    // Handle challenge validation
    if ('challenge' in body) {
      const response = HaluClient.handleWebhookChallenge(body.challenge);
      logger.info({ challenge: body.challenge }, 'Responded to HALU challenge');
      return NextResponse.json(response);
    }

    // Handle status updates
    const { task_id, status, file_id, video_url, base_resp } = body;

    if (!task_id || !status) {
      logger.error({ body }, 'Invalid webhook payload: missing task_id or status');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    logger.info({ task_id, status }, 'Processing HALU status update');

    // Find the animation job by HALU task_id
    const [job] = await db
      .select()
      .from(animationJobQueue)
      .where(eq(animationJobQueue.haluTaskId, task_id))
      .limit(1);

    if (!job) {
      logger.warn({ task_id }, 'No animation job found for this HALU task_id');
      // Return 200 anyway to acknowledge receipt
      return NextResponse.json({ status: 'ok' });
    }

    logger.info({ jobId: job.id, projectId: job.projectId, sceneIndex: job.sceneIndex }, 'Found animation job');

    // Handle different statuses
    if (status === 'processing') {
      logger.info({ jobId: job.id }, 'HALU task is still processing');
      // No action needed, job remains in 'processing' status
      return NextResponse.json({ status: 'ok' });
    }

    if (status === 'failed') {
      logger.error({ jobId: job.id, base_resp }, 'HALU task failed');

      // Update job status to failed
      await db
        .update(animationJobQueue)
        .set({
          status: 'failed' as any,
          error: base_resp?.status_msg || 'HALU generation failed',
          errorMessage: base_resp?.status_msg || 'HALU generation failed',
          updatedAt: new Date() as any,
        })
        .where(eq(animationJobQueue.id, job.id));

      return NextResponse.json({ status: 'ok' });
    }

    if (status === 'success') {
      logger.info({ jobId: job.id, file_id, video_url }, 'HALU task succeeded');

      // Download the video
      const haluClient = new HaluClient({
        apiKey: process.env.MINIMAX_API_KEY!,
      });

      let videoBuffer: Buffer;

      if (video_url) {
        // Direct video URL provided
        logger.info({ video_url }, 'Downloading video from direct URL');
        videoBuffer = await haluClient.downloadVideo(video_url);
      } else if (file_id) {
        // File ID provided, retrieve download URL first
        logger.info({ file_id }, 'Downloading video using file_id');
        videoBuffer = await haluClient.downloadVideo(file_id);
      } else {
        throw new Error('Neither video_url nor file_id provided in success response');
      }

      logger.info({ videoSizeBytes: videoBuffer.length }, 'Video downloaded successfully');

      // Upload to R2
      const r2Key = await uploadVideoToR2(videoBuffer, job.projectId, job.sceneIndex);

      // Create a new asset record for the animated video
      const [videoAsset] = await db
        .insert(assets)
        .values({
          generationProjectId: job.projectId,
          assetType: 'animation',
          status: 'completed',
          storageUrl: r2Key, // R2 key
          meta: {
            sceneIndex: job.sceneIndex,
            haluTaskId: task_id,
            firstFrameAssetId: job.assetIdFirstFrame,
            lastFrameAssetId: job.assetIdLastFrame,
            generatedAt: new Date().toISOString(),
          },
        } as any)
        .returning();

      logger.info({ videoAssetId: videoAsset.id, r2Key }, 'Created video asset record');

      // Update animation job status to completed
      await db
        .update(animationJobQueue)
        .set({
          status: 'completed' as any,
          updatedAt: new Date() as any,
        })
        .where(eq(animationJobQueue.id, job.id));

      logger.info({ jobId: job.id }, 'Animation job completed');

      // Check if all animation jobs for this project are completed
      const allJobs = await db
        .select()
        .from(animationJobQueue)
        .where(eq(animationJobQueue.projectId, job.projectId));

      const allCompleted = allJobs.every(j => j.status === 'completed');

      if (allCompleted) {
        logger.info({ projectId: job.projectId }, 'All animation jobs completed, updating project status');

        // Update project status to completed
        const [project] = await db
          .select()
          .from(generationProjects)
          .where(eq(generationProjects.id, job.projectId))
          .limit(1);

        if (project) {
          const meta = project.meta as any;
          await db
            .update(generationProjects)
            .set({
              status: 'completed' as any,
              meta: {
                ...meta,
                animationCompletedAt: new Date().toISOString(),
              },
              updatedAt: new Date() as any,
            })
            .where(eq(generationProjects.id, job.projectId));

          logger.info({ projectId: job.projectId }, 'Project animation pipeline completed');
        }
      }

      return NextResponse.json({ status: 'ok' });
    }

    // Unknown status
    logger.warn({ status }, 'Unknown HALU status');
    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    logger.error({ error }, 'Error processing HALU webhook');

    // Return 200 to prevent HALU from retrying
    // Log the error for manual investigation
    return NextResponse.json(
      { error: 'Internal error', message: error instanceof Error ? error.message : String(error) },
      { status: 200 } // Return 200 to acknowledge receipt
    );
  }
}
