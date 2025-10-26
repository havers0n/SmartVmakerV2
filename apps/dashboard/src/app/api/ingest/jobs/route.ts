import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { ingestJobQueue } from '@/shared/lib/schema';

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
    const { query, publishedAfter: _publishedAfter, duration: _duration = 'short' } = body ?? {};

    // Validate required fields
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    // Insert into ingest_queue table
    const [job] = await db.insert(ingestJobQueue).values({
      query,
      published_after: _publishedAfter ? new Date(_publishedAfter) : null,
      duration: _duration ? parseInt(_duration) : null,
      status: 'pending',
      retry_count: 0,
    }).returning();

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: job.status,
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
export async function GET(_req: NextRequest) {
  try {
    // Query database for ingest_queue jobs, ordered by most recent first
    const jobs = await db
      .select()
      .from(ingestJobQueue)
      .orderBy(desc(ingestJobQueue.created_at))
      .limit(50);

    return NextResponse.json(
      {
        success: true,
        jobs,
        message: jobs.length > 0 ? `Found ${jobs.length} ingest jobs` : 'No ingest jobs found',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching ingest jobs:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
