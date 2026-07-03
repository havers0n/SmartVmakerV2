import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@aec/logger';
import { db } from '@/shared/lib/db';
import { animationJobQueue, assets, generationProjects } from '@/shared/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { HaluClient } from '@scrimspec/halu-client';
import { uploadLargeStream } from '@aec/storage-client';
import { Readable } from 'stream';
import crypto from 'crypto';

const logger = createLogger({ name: 'halu-webhook' });
const SIGNATURE_HEADERS = ['x-halu-signature', 'x-minimax-signature', 'x-signature'] as const;

function getSignatureHeader(request: NextRequest): string | null {
  for (const header of SIGNATURE_HEADERS) {
    const value = request.headers.get(header);
    if (value) return value;
  }
  return null;
}

function normalizeSignature(signature: string): string {
  return signature.replace(/^sha256=/i, '').trim();
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const provided = normalizeSignature(signature);
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  if (provided.length !== expected.length) return false;

  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (host.endsWith('.local')) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

function hostAllowed(hostname: string): boolean {
  const configured = process.env.HALU_ALLOWED_VIDEO_HOSTS;
  const rules = (configured ? configured.split(',') : ['minimax.io'])
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  const host = hostname.toLowerCase();
  return rules.some((rule) => host === rule || host.endsWith(`.${rule}`));
}

function isSafeVideoUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'https:') return false;
    if (isPrivateHost(parsed.hostname)) return false;
    return hostAllowed(parsed.hostname);
  } catch {
    return false;
  }
}

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
    const rawBody = await request.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const secret = process.env.HALU_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('HALU_WEBHOOK_SECRET is not configured in production');
        return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
      }
      logger.warn('HALU_WEBHOOK_SECRET is not configured, signature verification skipped in non-production');
    } else {
      const signature = getSignatureHeader(request);
      if (!signature) {
        logger.warn('HALU webhook rejected: missing signature header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }
      if (!verifySignature(rawBody, signature, secret)) {
        logger.warn('HALU webhook rejected: invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    logger.info({ keys: Object.keys(body || {}) }, 'Received HALU webhook request');

    // Handle challenge validation
    if ('challenge' in body) {
      const response = HaluClient.handleWebhookChallenge(body.challenge);
      logger.info('Responded to HALU challenge');
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

    if (status === 'success' && job.status === 'completed') {
      logger.info({ jobId: job.id, task_id }, 'Duplicate success webhook received for already completed job');
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
      logger.info({ jobId: job.id, hasFileId: !!file_id, hasVideoUrl: !!video_url }, 'HALU task succeeded');

      const existing = await db.execute(sql`
        SELECT id
        FROM generation_pipeline.assets
        WHERE generation_project_id = ${job.projectId}
          AND asset_type = 'animation'
          AND meta->>'haluTaskId' = ${task_id}
        LIMIT 1
      `);

      if (existing.rows.length > 0) {
        logger.info({ jobId: job.id, task_id, assetId: (existing.rows[0] as any).id }, 'Duplicate webhook skipped: animation asset already exists');

        await db
          .update(animationJobQueue)
          .set({
            status: 'completed' as any,
            updatedAt: new Date() as any,
          })
          .where(eq(animationJobQueue.id, job.id));

        return NextResponse.json({ status: 'ok' });
      }

      // Download the video
      const apiKey = process.env.MINIMAX_API_KEY;
      if (!apiKey) {
        throw new Error('MINIMAX_API_KEY is not configured');
      }
      const haluClient = new HaluClient({
        apiKey,
      });

      let videoBuffer: Buffer;

      if (file_id) {
        // File ID provided, retrieve download URL first
        logger.info({ file_id }, 'Downloading video using file_id');
        videoBuffer = await haluClient.downloadVideo(file_id);
      } else if (video_url) {
        // Fallback for direct URL payloads: strict SSRF guard
        if (!isSafeVideoUrl(video_url)) {
          throw new Error('Rejected unsafe video_url in webhook payload');
        }
        logger.info('Downloading video from validated direct URL');
        videoBuffer = await haluClient.downloadVideo(video_url);
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

    return NextResponse.json(
      { error: 'Internal error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
