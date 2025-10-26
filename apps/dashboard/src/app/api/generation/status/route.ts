/**
 * GET /api/generation/status
 * Get generation status for all shorts and assets.
 * Supports filtering and pagination.
 *
 * TODO: This route needs to be updated to use correct schema tables:
 * - generationShorts -> generationProjects
 * - generationAssets -> assets
 * - generationQueue -> generationJobQueue
 */

import { NextResponse } from 'next/server';
// Temporarily disabled until schema is updated
// import { getDrizzleClient } from '@scrimspec/db';
// import {
//   generationProjects,
//   assets,
//   generationJobQueue,
// } from '@scrimspec/db/schema';
// import { eq, desc } from 'drizzle-orm';

// const db = getDrizzleClient();

export async function GET(_req: Request) {
  // TODO: Temporarily disabled - needs schema migration
  return NextResponse.json(
    {
      error: 'This endpoint is temporarily disabled pending schema migration',
      message: 'Please use /api/hwar/factory/stats for generation statistics',
    },
    { status: 501 } // Not Implemented
  );

  // TODO: Re-enable after updating to use correct schema:
  /*
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const assetStatus = url.searchParams.get('status');
    const pageSize = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

    // Use generationProjects, assets, generationJobQueue instead
    // ...implementation
  } catch (error) {
    console.error('[API] Error getting generation status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
  */
}
