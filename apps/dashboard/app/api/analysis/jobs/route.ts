import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { analysisJobQueue } from '@/shared/lib/schema';

/**
 * POST /api/analysis/jobs
 * Create analysis jobs for selected videos
 *
 * Request body:
 * {
 *   videoIds: string[],     // Array of YouTube video IDs
 *   analyzer: string        // 'gemini', 'nanobanana', etc.
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoIds = [], analyzer = 'gemini' } = body ?? {};

    // Validate required fields
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'videoIds is required and must be a non-empty array' },
        { status: 400 },
      );
    }

    if (typeof analyzer !== 'string' || analyzer.trim().length === 0) {
      return NextResponse.json(
        { error: 'analyzer is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    // Insert multiple analysis jobs into database
    const jobs = await db
      .insert(analysisJobQueue)
      .values(
        videoIds.map((videoId) => ({
          video_id: videoId,
          analyzer,
          status: 'pending' as const,
          retry_count: 0,
        }))
      )
      .returning();

    const jobIds = jobs.map((job: typeof analysisJobQueue.$inferSelect) => job.id);

    return NextResponse.json(
      {
        success: true,
        jobIds,
        count: jobs.length,
        analyzer,
        status: 'pending',
        message: `Created ${jobs.length} analysis jobs with analyzer: ${analyzer}`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating analysis jobs:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/analysis/jobs
 * Get list of analysis jobs
 */
export async function GET(_req: NextRequest) {
  try {
    // Query database for analysis_queue jobs, ordered by most recent first
    const jobs = await db
      .select()
      .from(analysisJobQueue)
      .orderBy(desc(analysisJobQueue.created_at))
      .limit(50);

    return NextResponse.json(
      {
        success: true,
        jobs,
        message: jobs.length > 0 ? `Found ${jobs.length} analysis jobs` : 'No analysis jobs found',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching analysis jobs:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
