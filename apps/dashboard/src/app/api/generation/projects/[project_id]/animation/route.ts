import { NextRequest, NextResponse } from 'next/server';
import { sql, eq, and, desc } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { generationAnimationJobs, generationProjects } from '@/shared/lib/schema';
import { defaultAiRouter } from '@/server/ai';
import { syncMiniMaxVideoJob } from '@/server/minimax-sync';
import type { AnimationKeyframe } from '@scrimspec/hwar-core';
import {
  AnimationOverviewResponse,
  AnimationJobDto,
  AnimationJobStatus,
} from '@scrimspec/hwar-core/types/generation';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export const runtime = 'nodejs';

const COOLDOWN_MS = 30_000;

const toFrameType = (v: unknown): AnimationKeyframe['frameType'] =>
  v === 'first' || v === 'middle' || v === 'last' ? v : undefined;

function mapDbStatus(status: string): AnimationJobStatus {
  switch (status) {
    case 'queued':
    case 'pending':
      return 'pending';
    case 'processing':
    case 'running':
      return 'running';
    case 'success':
    case 'succeeded':
      return 'succeeded';
    default:
      return 'failed';
  }
}

function toDto(job: typeof generationAnimationJobs.$inferSelect): AnimationJobDto {
  return {
    id: job.id,
    projectId: job.projectId,
    sceneIndex: job.sceneIndex ?? null,
    provider: 'minimax',
    minimaxTaskId: job.minimaxTaskId ?? null,
    status: mapDbStatus(job.status),
    videoUrl: job.videoUrl ?? null,
    durationSeconds: job.durationSec ?? null,
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lastSyncAt: job.updatedAt ?? null,
  };
}

function calcOverallStatus(jobs: AnimationJobDto[]): AnimationOverviewResponse['overallStatus'] {
  if (jobs.length === 0) return 'idle';
  if (jobs.some((j) => j.status === 'failed')) return 'failed';
  if (jobs.some((j) => j.status === 'pending' || j.status === 'running')) return 'running';
  return 'succeeded';
}

async function getProjectKeyframesByScene(projectId: string, sceneIndex: number) {
  const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || '';

  const result = await db.execute(sql`
    SELECT id, storage_url, meta
    FROM generation_pipeline.assets
    WHERE generation_project_id = ${projectId}
      AND asset_type = 'keyframe'
      AND (meta->>'sceneIndex')::int = ${sceneIndex}
    ORDER BY
      CASE (meta->>'frameType')
        WHEN 'first' THEN 0
        WHEN 'last' THEN 2
        ELSE 1
      END,
      created_at ASC
  `);

  return result.rows.map((row: any) => {
    const meta = row.meta || {};
    const storageUrl: string | null = row.storage_url ?? null;
    return {
      id: row.id as string,
      publicUrl: storageUrl && PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/${storageUrl}` : null,
      frameType: meta.frameType as 'first' | 'last' | 'middle' | undefined,
    };
  });
}

export async function POST(req: NextRequest, { params }: { params: { project_id: string } }) {
  try {
    const userId = getTrustedUserId(req);
    if (!userId) return unauthorizedResponse();

    const projectId = params.project_id;
    const body = await req.json();
    const sceneIndex: number = body.sceneIndex;

    if (!projectId || typeof sceneIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const [project] = await db
      .select({ id: generationProjects.id })
      .from(generationProjects)
      .where(and(eq(generationProjects.id, projectId), eq(generationProjects.ownerId, userId)))
      .limit(1);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [lastJob] = await db
      .select()
      .from(generationAnimationJobs)
      .where(
        and(
          eq(generationAnimationJobs.projectId, projectId),
          eq(generationAnimationJobs.sceneIndex, sceneIndex),
        ),
      )
      .orderBy(desc(generationAnimationJobs.createdAt))
      .limit(1);

    if (lastJob) {
      const lastCreated = new Date(lastJob.createdAt).getTime();
      if (Date.now() - lastCreated < COOLDOWN_MS) {
        return NextResponse.json(
          {
            error: 'rate_limited',
            message: 'You can start a new clip for this scene only once every 30 seconds.',
          },
          { status: 429 },
        );
      }
    }

    const keyframes = await getProjectKeyframesByScene(projectId, sceneIndex);
    if (!keyframes.length) {
      return NextResponse.json({ error: 'No keyframes for this scene' }, { status: 400 });
    }

    if (!keyframes[0]?.publicUrl) {
      return NextResponse.json({ error: 'First keyframe has no publicUrl' }, { status: 400 });
    }

    const animationKeyframes: AnimationKeyframe[] = keyframes.map((kf, idx) => {
      const frameType = idx === 0 ? 'first' : idx === keyframes.length - 1 ? 'last' : 'middle';

      return {
        assetId: kf.id,
        publicUrl: kf.publicUrl!,
        frameIndex: idx,
        frameType: toFrameType(frameType),
      };
    });

    const result = await defaultAiRouter.generateAnimation({
      projectId,
      sceneIndex,
      keyframes: animationKeyframes,
    });

    const createdJob = await db.query.generationAnimationJobs.findFirst({
      where: eq(generationAnimationJobs.minimaxTaskId, result.externalTaskId),
    });

    return NextResponse.json(
      { job: createdJob ? toDto(createdJob) : result },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('animation start failed', e);
    return NextResponse.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function GET(_req: NextRequest, { params }: { params: { project_id: string } }) {
  const userId = getTrustedUserId(_req);
  if (!userId) return unauthorizedResponse();

  const projectId = params.project_id;

  const [project] = await db
    .select({ id: generationProjects.id })
    .from(generationProjects)
    .where(and(eq(generationProjects.id, projectId), eq(generationProjects.ownerId, userId)))
    .limit(1);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const jobs = await db.query.generationAnimationJobs.findMany({
    where: eq(generationAnimationJobs.projectId, projectId),
    orderBy: (tbl, { asc }) => [asc(tbl.sceneIndex)],
  });

  for (const job of jobs) {
    const status = mapDbStatus(job.status);
    if (status === 'pending' || status === 'running') {
      try {
        await syncMiniMaxVideoJob(job.id);
      } catch (err: any) {
        await db
          .update(generationAnimationJobs)
          .set({
            status: 'failed',
            errorCode: err?.code ? String(err.code) : 'minimax_sync_error',
            errorMessage: err?.message || 'MiniMax sync failed',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(generationAnimationJobs.id, job.id));
      }
    }
  }

  const refreshed = await db.query.generationAnimationJobs.findMany({
    where: eq(generationAnimationJobs.projectId, projectId),
    orderBy: (tbl, { asc }) => [asc(tbl.sceneIndex)],
  });

  const dto = refreshed.map(toDto);
  const overallStatus = calcOverallStatus(dto);

  return NextResponse.json<AnimationOverviewResponse>(
    {
      projectId,
      overallStatus,
      jobs: dto,
    },
    { status: 200 },
  );
}
