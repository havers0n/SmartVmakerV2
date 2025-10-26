/**
 * GET /api/generation/status
 * Get generation status for all shorts and assets.
 * Supports filtering and pagination.
 */

import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { 
  generationProjects, 
  assets, 
  generationJobQueue 
} from '@/shared/lib/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const assetStatus = url.searchParams.get('status');
    const pageSize = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

    // Build where conditions
    const conditions = [];
    if (projectId) {
      conditions.push(eq(generationProjects.id, projectId));
    }
    if (assetStatus) {
      conditions.push(eq(assets.status, assetStatus));
    }

    // Get generation projects with counts
    const projects = await db
      .select({
        id: generationProjects.id,
        templateId: generationProjects.template_id,
        finalVideoUrl: generationProjects.final_video_url,
        status: generationProjects.status,
        ownerId: generationProjects.owner_id,
        createdAt: generationProjects.created_at,
        updatedAt: generationProjects.updated_at,
        assetCount: sql<number>`count(${assets.id})`.as('asset_count'),
        pendingAssets: sql<number>`count(case when ${assets.status} = 'pending' then 1 end)`.as('pending_assets'),
        processingAssets: sql<number>`count(case when ${assets.status} = 'processing' then 1 end)`.as('processing_assets'),
        completedAssets: sql<number>`count(case when ${assets.status} = 'completed' then 1 end)`.as('completed_assets'),
        failedAssets: sql<number>`count(case when ${assets.status} = 'failed' then 1 end)`.as('failed_assets'),
      })
      .from(generationProjects)
      .leftJoin(assets, eq(generationProjects.id, assets.generation_project_id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(
        generationProjects.id,
        generationProjects.template_id,
        generationProjects.final_video_url,
        generationProjects.status,
        generationProjects.owner_id,
        generationProjects.created_at,
        generationProjects.updated_at
      )
      .orderBy(desc(generationProjects.created_at))
      .limit(pageSize);

    // Get job queue stats
    const jobQueueStats = await db
      .select({
        status: generationJobQueue.status,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(generationJobQueue)
      .groupBy(generationJobQueue.status);

    return NextResponse.json({
      ok: true,
      projects,
      jobQueueStats,
      count: projects.length,
    });
  } catch (error) {
    console.error('[API] Error getting generation status:', error);
    
    // Check if it's a table not found error
    if (error instanceof Error && error.message.includes('does not exist')) {
      return NextResponse.json({
        ok: true,
        projects: [],
        jobQueueStats: [],
        count: 0,
        message: 'Database tables not yet created. This is expected during initial setup.',
        info: 'After database migration is complete, generation data will appear here.'
      });
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to fetch generation status'
      },
      { status: 500 },
    );
  }
}