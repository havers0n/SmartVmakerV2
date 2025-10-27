/**
 * POST /api/generation/shorts
 * Create a new short from a template and enqueue generation jobs.
 */

import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { 
  generationProjects, 
  assets,
  generationJobQueue
} from '@/shared/lib/schema';
import { desc, inArray, sql } from 'drizzle-orm';

// Simple function to generate a random ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Mock function to simulate creating a short and enqueuing jobs
// In a real implementation, this would interact with the generation service
async function createShortAndEnqueue(templateId: string, provider: string) {
  // Create a new generation project
  const [project] = await db.insert(generationProjects).values({
    template_id: templateId,
    owner_id: 'mock-user-id', // This would come from auth in real implementation
    status: 'pending',
    meta: {
      provider,
      createdAt: new Date().toISOString()
    }
  }).returning();

  // Create mock assets for this project
  const assetTypes = ['intro', 'scene1', 'scene2', 'outro'];
  let enqueued = 0;
  
  for (const assetType of assetTypes) {
    const [asset] = await db.insert(assets).values({
      generation_project_id: project.id,
      asset_type: assetType,
      storage_url: `https://example.com/assets/${generateId()}`,
      status: 'pending',
      meta: {
        prompt: `Generate ${assetType} for template ${templateId}`,
        provider
      }
    }).returning();
    
    // Enqueue generation job for this asset
    await db.insert(generationJobQueue).values({
      asset_id: asset.id,
      provider,
      status: 'pending',
      retry_count: 0
    });
    
    enqueued++;
  }

  return {
    shortId: project.id,
    enqueued
  };
}

export async function POST(req: Request) {
  try {
    const { templateId, provider = 'minimax' } = await req.json();

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 },
      );
    }

    if (!['minimax', 'hailuo'].includes(provider)) {
      return NextResponse.json(
        { error: 'provider must be "minimax" or "hailuo"' },
        { status: 400 },
      );
    }

    const { shortId, enqueued } = await createShortAndEnqueue(
      templateId,
      provider as 'minimax' | 'hailuo',
    );

    return NextResponse.json({
      ok: true,
      shortId,
      enqueued,
      message: `Created short ${shortId} with ${enqueued} assets enqueued for generation`,
    });

  } catch (error) {
    console.error('[API] Error creating short:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/generation/shorts
 * List all shorts with their status.
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Simple implementation to get projects with asset counts
    const projects = await db
      .select({
        id: generationProjects.id,
        templateId: generationProjects.template_id,
        status: generationProjects.status,
        createdAt: generationProjects.created_at,
        updatedAt: generationProjects.updated_at,
      })
      .from(generationProjects)
      .orderBy(desc(generationProjects.created_at))
      .limit(limit);

    // Get asset counts for each project
    const projectIds = projects.map(p => p.id);
    let assetCounts: { projectId: string; count: number }[] = [];
    
    if (projectIds.length > 0) {
      assetCounts = await db
        .select({
          projectId: assets.generation_project_id,
          count: sql<number>`count(*)`.mapWith(Number)
        })
        .from(assets)
        .where(inArray(assets.generation_project_id, projectIds))
        .groupBy(assets.generation_project_id);
    }

    // Combine projects with asset counts
    const projectsWithCounts = projects.map(project => {
      const countObj = assetCounts.find(ac => ac.projectId === project.id);
      return {
        ...project,
        assetCount: countObj ? countObj.count : 0
      };
    });

    return NextResponse.json({
      ok: true,
      count: projectsWithCounts.length,
      shorts: projectsWithCounts,
    });

  } catch (error) {
    console.error('[API] Error listing shorts:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}