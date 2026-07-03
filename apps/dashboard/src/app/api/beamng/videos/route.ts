export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { desc, asc, eq, count, sql, and } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { youtubeVideos, youtubeChannels } from '@/shared/lib/schema';
import { z } from 'zod';
import { computeVideoMetrics } from '@/shared/lib/beamng-metrics';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['views', 'publishedAt', 'viewsPerDay', 'durationSeconds', 'title']).default('publishedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  channelId: z.string().uuid().optional(),
  minViews: z.coerce.number().int().min(0).optional(),
  search: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams));

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(youtubeVideos);

    const whereConditions = [];
    if (query.channelId) {
      whereConditions.push(eq(youtubeVideos.channelId, query.channelId));
    }
    if (query.minViews !== undefined) {
      whereConditions.push(sql`${youtubeVideos.viewCount} >= ${query.minViews}`);
    }
    if (query.search) {
      whereConditions.push(sql`LOWER(${youtubeVideos.title}) LIKE LOWER(${'%' + query.search + '%'})`);
    }

    const sortColumns: Record<string, any> = {
      views: youtubeVideos.viewCount,
      publishedAt: youtubeVideos.publishedAt,
      viewsPerDay: youtubeVideos.publishedAt,
      durationSeconds: youtubeVideos.durationSeconds,
      title: youtubeVideos.title,
    };
    const orderBy = query.sortDir === 'desc'
      ? desc(sortColumns[query.sortBy] ?? youtubeVideos.publishedAt)
      : asc(sortColumns[query.sortBy] ?? youtubeVideos.publishedAt);

    const rows = await db
      .select({
        id: youtubeVideos.id,
        youtubeId: youtubeVideos.youtubeId,
        title: youtubeVideos.title,
        url: youtubeVideos.url,
        description: youtubeVideos.description,
        publishedAt: youtubeVideos.publishedAt,
        channelTitle: youtubeVideos.channelTitle,
        channelId: youtubeVideos.channelId,
        durationSeconds: youtubeVideos.durationSeconds,
        viewCount: youtubeVideos.viewCount,
        likeCount: youtubeVideos.likeCount,
        commentCount: youtubeVideos.commentCount,
        tags: youtubeVideos.tags,
        thumbnails: youtubeVideos.thumbnails,
        createdAt: youtubeVideos.createdAt,
        updatedAt: youtubeVideos.updatedAt,
        // Channel info
        channelYoutubeId: youtubeChannels.youtubeChannelId,
        channelHandle: youtubeChannels.handle,
        channelSubscriberCount: youtubeChannels.subscriberCount,
      })
      .from(youtubeVideos)
      .leftJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset(query.offset);

    const videosWithMetrics = rows.map((row) => {
      const metrics = computeVideoMetrics(
        row.viewCount,
        row.likeCount,
        row.commentCount,
        row.publishedAt,
        row.durationSeconds,
      );
      return {
        id: row.id,
        youtubeId: row.youtubeId,
        title: row.title,
        url: row.url,
        description: row.description,
        publishedAt: row.publishedAt,
        channelTitle: row.channelTitle,
        channelId: row.channelId,
        durationSeconds: row.durationSeconds,
        viewCount: row.viewCount,
        likeCount: row.likeCount,
        commentCount: row.commentCount,
        tags: row.tags,
        thumbnails: row.thumbnails,
        createdAt: row.createdAt,
        channel: row.channelYoutubeId ? {
          youtubeChannelId: row.channelYoutubeId,
          handle: row.channelHandle,
          subscriberCount: row.channelSubscriberCount,
        } : null,
        metrics,
      };
    });

    return NextResponse.json({
      success: true,
      videos: videosWithMetrics,
      count: videosWithMetrics.length,
      total,
      pagination: {
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    console.error('[BEAMNG API] Error getting videos:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
