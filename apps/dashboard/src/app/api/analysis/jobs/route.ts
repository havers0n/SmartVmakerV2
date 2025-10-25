import { NextRequest, NextResponse } from 'next/server';

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

    // TODO: Call database to insert multiple rows into analysis_queue table
    // For now, just return success response structure

    const jobIds = videoIds.map(() => crypto.randomUUID());

    return NextResponse.json(
      {
        success: true,
        jobIds,
        count: videoIds.length,
        analyzer,
        status: 'pending',
        message: `Created ${videoIds.length} analysis jobs with analyzer: ${analyzer}`,
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
    // TODO: Query database for analysis_queue jobs

    return NextResponse.json(
      {
        success: true,
        jobs: [],
        message: 'No analysis jobs found',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching analysis jobs:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
