import { NextRequest, NextResponse } from 'next/server';
import { sql, eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { generationAnimationJobs } from '@/shared/lib/schema';
import { defaultAiRouter } from '@/server/ai';
import { syncMiniMaxVideoJob } from '@/server/minimax-sync';

export const runtime = 'nodejs';

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
    const projectId = params.project_id;
    const body = await req.json();
    const sceneIndex: number = body.sceneIndex;

    if (!projectId || typeof sceneIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const keyframes = await getProjectKeyframesByScene(projectId, sceneIndex);
    if (!keyframes.length) {
      return NextResponse.json({ error: 'No keyframes for this scene' }, { status: 400 });
    }

    if (!keyframes[0]?.publicUrl) {
      return NextResponse.json({ error: 'First keyframe has no publicUrl' }, { status: 400 });
    }

    const animationKeyframes = keyframes.map((kf, idx) => ({
      assetId: kf.id,
      publicUrl: kf.publicUrl!,
      frameIndex: idx,
      frameType:
        idx === 0
          ? 'first'
          : idx === keyframes.length - 1
            ? 'last'
            : 'middle',
    }));

    const result = await defaultAiRouter.generateAnimation({
      projectId,
      sceneIndex,
      keyframes: animationKeyframes,
    });

    return NextResponse.json({ job: result });
  } catch (e: any) {
    console.error('animation start failed', e);
    return NextResponse.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function GET(_req: NextRequest, { params }: { params: { project_id: string } }) {
  const projectId = params.project_id;

  const jobs = await db.query.generationAnimationJobs.findMany({
    where: eq(generationAnimationJobs.projectId, projectId),
    orderBy: (tbl, { asc }) => [asc(tbl.sceneIndex)],
  });

  for (const job of jobs) {
    if (job.status === 'queued' || job.status === 'processing') {
      await syncMiniMaxVideoJob(job.id);
    }
  }

  const refreshed = await db.query.generationAnimationJobs.findMany({
    where: eq(generationAnimationJobs.projectId, projectId),
    orderBy: (tbl, { asc }) => [asc(tbl.sceneIndex)],
  });

  return NextResponse.json({ jobs: refreshed });
}

