// apps/dashboard/src/app/api/generation/projects/[project_id]/debug/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { sql } from 'drizzle-orm';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';
import { generationProjects } from '@/shared/lib/schema';
import { and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/generation/projects/[project_id]/debug
 * 
 * Diagnostic endpoint to check:
 * - Assets status and storage_url
 * - Keyframe jobs status
 * - R2 configuration
 */
export async function GET(
  req: Request,
  { params }: { params: { project_id: string } }
) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const userId = getTrustedUserId(req);
    if (!userId) {
      return unauthorizedResponse();
    }

    const { project_id } = params;

    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const [project] = await db
      .select({ id: generationProjects.id })
      .from(generationProjects)
      .where(and(eq(generationProjects.id, project_id), eq(generationProjects.ownerId, userId)))
      .limit(1);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get assets
    const assetsResult = await db.execute(sql`
      SELECT 
        id,
        asset_type,
        status,
        storage_url,
        LENGTH(storage_url) as storage_url_length,
        created_at,
        updated_at,
        meta
      FROM generation_pipeline.assets
      WHERE generation_project_id = ${project_id}
        AND asset_type = 'keyframe'
      ORDER BY 
        (meta->>'sceneIndex')::int ASC,
        (meta->>'frameType') ASC
    `);

    // Get keyframe jobs
    const jobsResult = await db.execute(sql`
      SELECT 
        id,
        asset_id,
        status,
        stage,
        external_id,
        created_at,
        updated_at
      FROM jobs.keyframe_job_queue
      WHERE project_id = ${project_id}
      ORDER BY created_at ASC
    `);

    // Check R2 config - check both server and client env vars
    const r2Config = {
      hasPublicBaseUrl: !!process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL,
      publicBaseUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || 'NOT SET',
      hasAccountId: !!process.env.R2_ACCOUNT_ID,
      hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME || 'NOT SET',
      // Check if variables exist but are empty
      accountIdEmpty: process.env.R2_ACCOUNT_ID === '',
      accessKeyEmpty: process.env.R2_ACCESS_KEY_ID === '',
      secretKeyEmpty: process.env.R2_SECRET_ACCESS_KEY === '',
    };

    // Analyze assets
    const assets = assetsResult.rows as any[];
    const assetsAnalysis = {
      total: assets.length,
      byStatus: {} as Record<string, number>,
      withStorageUrl: assets.filter(a => a.storage_url && a.storage_url.trim() !== '').length,
      withoutStorageUrl: assets.filter(a => !a.storage_url || a.storage_url.trim() === '').length,
      emptyStorageUrl: assets.filter(a => a.storage_url === '').length,
      sampleAssets: assets.slice(0, 3).map(a => ({
        id: a.id,
        status: a.status,
        storage_url: a.storage_url || '(empty)',
        storage_url_length: a.storage_url_length,
        sceneIndex: a.meta?.sceneIndex,
        frameType: a.meta?.frameType,
      })),
    };

    assets.forEach(a => {
      const status = a.status || 'unknown';
      assetsAnalysis.byStatus[status] = (assetsAnalysis.byStatus[status] || 0) + 1;
    });

    // Analyze jobs
    const jobs = jobsResult.rows as any[];
    const jobsAnalysis = {
      total: jobs.length,
      byStatus: {} as Record<string, number>,
      byStage: {} as Record<string, number>,
      sampleJobs: jobs.slice(0, 3).map(j => ({
        id: j.id,
        asset_id: j.asset_id,
        status: j.status,
        stage: j.stage,
        external_id: j.external_id,
      })),
    };

    jobs.forEach(j => {
      const status = j.status || 'unknown';
      const stage = j.stage || 'unknown';
      jobsAnalysis.byStatus[status] = (jobsAnalysis.byStatus[status] || 0) + 1;
      jobsAnalysis.byStage[stage] = (jobsAnalysis.byStage[stage] || 0) + 1;
    });

    return NextResponse.json({
      projectId: project_id,
      r2Config,
      assets: assetsAnalysis,
      jobs: jobsAnalysis,
      summary: {
        assetsTotal: assetsAnalysis.total,
        assetsWithStorageUrl: assetsAnalysis.withStorageUrl,
        assetsWithoutStorageUrl: assetsAnalysis.withoutStorageUrl,
        jobsTotal: jobsAnalysis.total,
        potentialIssue: assetsAnalysis.withoutStorageUrl > 0 
          ? `Found ${assetsAnalysis.withoutStorageUrl} assets without storage_url. Worker may not be processing jobs.`
          : 'All assets have storage_url',
      },
    });
  } catch (error) {
    console.error('[Debug API] Failed to fetch debug info:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
