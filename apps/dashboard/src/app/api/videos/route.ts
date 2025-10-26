/**
 * GET /api/videos
 * Get all ingested YouTube videos with analysis status
 * Supports filtering and pagination
 */

import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { youtubeVideos, analysisJobQueue, analysisResults } from '@/shared/lib/schema';
import { z } from 'zod';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams));

    // Query youtube_videos with analysis status
    const videos = await db
      .select({
        id: youtubeVideos.id,
        title: youtubeVideos.title,
        url: youtubeVideos.url,
        channelTitle: youtubeVideos.channel_title,
        durationSeconds: youtubeVideos.duration_seconds,
        viewCount: youtubeVideos.view_count,
        publishedAt: youtubeVideos.published_at,
        createdAt: youtubeVideos.created_at,
        // Analysis job status (if exists)
        analysisStatus: analysisJobQueue.status,
        analysisJobId: analysisJobQueue.id,
        analyzer: analysisJobQueue.analyzer,
        // Analysis result (if completed)
        analysisResultId: analysisResults.id,
        analysisUrl: analysisResults.analysis_url,
      })
      .from(youtubeVideos)
      .leftJoin(analysisJobQueue, eq(youtubeVideos.id, analysisJobQueue.video_id))
      .leftJoin(analysisResults, eq(youtubeVideos.id, analysisResults.video_id))
      .orderBy(desc(youtubeVideos.created_at))
      .limit(query.limit)
      .offset(query.offset);

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      pagination: {
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    console.error('[API] Error getting videos:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
