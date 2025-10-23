import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ingest/jobs
 * Create a new YouTube ingestion job
 *
 * Request body:
 * {
 *   query: string,           // Search query
 *   publishedAfter?: string, // ISO date string
 *   duration?: 'short' | 'medium' | 'long' // Video duration filter
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, publishedAfter, duration = 'short' } = body ?? {};

    // Validate required fields
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    // TODO: Call database to insert into ingest_queue table
    // For now, just return success response structure

    const jobId = crypto.randomUUID();

    return NextResponse.json(
      {
        success: true,
        jobId,
        status: 'pending',
        message: `Ingest job created: will search for "${query}"`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating ingest job:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/ingest/jobs
 * Get list of ingest jobs
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Query database for ingest_queue jobs

    return NextResponse.json(
      {
        success: true,
        jobs: [],
        message: 'No ingest jobs found',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching ingest jobs:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
