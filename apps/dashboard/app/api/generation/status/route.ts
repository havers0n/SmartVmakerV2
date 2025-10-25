/**
 * GET /api/generation/status
 * Get generation status for all shorts and assets.
 * Supports filtering and pagination.
 */

import { NextResponse } from 'next/server';
import { getDrizzleClient } from '@scrimspec/db';
import {
  generationShorts,
  generationAssets,
  generationQueue,
} from '@scrimspec/db/schema';
import { eq, desc } from 'drizzle-orm';

const db = getDrizzleClient();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shortId = url.searchParams.get('shortId');
    const assetStatus = url.searchParams.get('status'); // 'pending', 'processing', 'completed', 'failed'
    const pageSize = Math.min(
      parseInt(url.searchParams.get('limit') || '50', 10),
      200,
    );

    // Build shorts query with filters
    let shortsConditions = [];

    if (shortId) {
      shortsConditions.push(eq(generationShorts.id, shortId));
    }

    const shorts = await db
      .select()
      .from(generationShorts)
      .where(shortsConditions.length > 0 ? shortsConditions[0] : undefined)
      .orderBy(desc(generationShorts.createdAt))
      .limit(pageSize);

    if (!shorts.length) {
      return NextResponse.json({
        ok: true,
        shorts: [],
        assets: [],
        jobs: [],
        count: {
          shorts: 0,
          assets: 0,
          jobs: 0,
        },
      });
    }

    // Get assets for these shorts
    const shortIds = shorts.map((s) => s.id);
    let assets = await db
      .select()
      .from(generationAssets)
      .where(eq(generationAssets.shortId, shortIds[0]));

    // For multiple shorts, fetch all and filter
    if (shortIds.length > 1) {
      const allAssets = await db.select().from(generationAssets);
      assets = allAssets.filter((a) => shortIds.includes(a.shortId));
    }

    // Filter assets by status if requested
    if (assetStatus) {
      assets = assets.filter((a) => a.status === assetStatus);
    }

    // Get jobs for these assets
    const assetIds = assets.map((a) => a.id);
    let jobs = [];

    if (assetIds.length > 0) {
      const allJobs = await db.select().from(generationQueue);
      jobs = allJobs.filter((j) => assetIds.includes(j.assetId));
    }

    return NextResponse.json({
      ok: true,
      shorts,
      assets,
      jobs,
      count: {
        shorts: shorts.length,
        assets: assets.length,
        jobs: jobs.length,
      },
    });

  } catch (error) {
    console.error('[API] Error getting generation status:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
