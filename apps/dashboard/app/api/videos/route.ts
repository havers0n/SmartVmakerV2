/**
 * GET /api/videos
 * Get all ingested YouTube videos
 * Supports filtering and pagination
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET(req: Request) {
  const client = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const url = new URL(req.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || '100', 10),
      500,
    );

    // Query youtube_videos table
    const result = await client.query(
      'SELECT id, title, url, channel_title, duration_seconds, view_count, published_at FROM youtube_videos ORDER BY created_at DESC LIMIT $1',
      [limit]
    );

    const videos = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      channel_title: row.channel_title,
      duration_seconds: row.duration_seconds,
      view_count: row.view_count,
      published_at: row.published_at,
    }));

    return NextResponse.json({
      ok: true,
      videos,
      count: videos.length,
    });
  } catch (error) {
    console.error('[API] Error getting videos:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  } finally {
    await client.end();
  }
}
