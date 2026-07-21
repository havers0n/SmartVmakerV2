import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { generationAnimationJobs, generationProjects } from '@/shared/lib/schema';
import { AnimationJobDto } from '@scrimspec/hwar-core/types/generation';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export const runtime = 'nodejs';

function mapStatus(status: string): AnimationJobDto['status'] {
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
    status: mapStatus(job.status),
    videoUrl: job.videoUrl ?? null,
    durationSeconds: job.durationSec ?? null,
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lastSyncAt: job.updatedAt ?? null,
  };
}

export async function POST(
  req: Request,
  { params }: { params: { project_id: string; job_id: string } },
) {
  const userId = getTrustedUserId(req);
  if (!userId) return unauthorizedResponse();

  const { project_id: projectId, job_id: jobId } = params;

  if (!projectId || !jobId) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const [project] = await db
    .select({ id: generationProjects.id })
    .from(generationProjects)
    .where(and(eq(generationProjects.id, projectId), eq(generationProjects.ownerId, userId)))
    .limit(1);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const job = await db.query.generationAnimationJobs.findFirst({
    where: and(
      eq(generationAnimationJobs.id, jobId),
      eq(generationAnimationJobs.projectId, projectId),
    ),
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const status = mapStatus(job.status);
  if (status === 'succeeded') {
    return NextResponse.json({ error: 'Job already succeeded' }, { status: 400 });
  }

  const [updated] = await db
    .update(generationAnimationJobs)
    .set({
      status: 'pending',
      errorCode: null,
      errorMessage: null,
      videoUrl: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(generationAnimationJobs.id, job.id))
    .returning();

  return NextResponse.json(toDto(updated));
}

