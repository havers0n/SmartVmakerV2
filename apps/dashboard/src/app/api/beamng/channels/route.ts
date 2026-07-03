export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { desc, eq, count, sql, and } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { youtubeVideos, youtubeChannels } from '@/shared/lib/schema';
import { z } from 'zod';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['title', 'subscriberCount', 'videoCount', 'viewCount', 'avgViewsPerVideo', 'latestVideoDate']).default('subscriberCount'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams));

    const whereConditions = [];
    if (query.search) {
      whereConditions.push(sql`LOWER(${youtubeChannels.title}) LIKE LOWER(${'%' + query.search + '%'})`);
    }

    // Get channels with video aggregates
    const rows = await db
      .select({
        id: youtubeChannels.id,
        youtubeChannelId: youtubeChannels.youtubeChannelId,
        handle: youtubeChannels.handle,
        title: youtubeChannels.title,
        description: youtubeChannels.description,
        country: youtubeChannels.country,
        subscriberCount: youtubeChannels.subscriberCount,
        videoCount: youtubeChannels.videoCount,
        viewCount: youtubeChannels.viewCount,
        publishedAt: youtubeChannels.publishedAt,
        thumbnailUrl: youtubeChannels.thumbnailUrl,
        createdAt: youtubeChannels.createdAt,
        // Video aggregates
        totalVideos: count(youtubeVideos.id),
        totalViews: sql<number>`COALESCE(SUM(${youtubeVideos.viewCount}), 0)`,
        avgViews: sql<number>`COALESCE(AVG(${youtubeVideos.viewCount}), 0)`,
        latestVideoDate: sql<string | null>`MAX(${youtubeVideos.publishedAt})`,
      })
      .from(youtubeChannels)
      .leftJoin(youtubeVideos, eq(youtubeChannels.id, youtubeVideos.channelId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(youtubeChannels.id)
      .orderBy(desc(youtubeChannels.subscriberCount))
      .limit(query.limit)
      .offset(query.offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(youtubeChannels);

    const channels = rows.map((row) => {
      const totalViewsNum = Number(row.totalViews) || 0;
      const totalVideosNum = row.totalVideos || 0;
      const avgViewsNum = Number(row.avgViews) || 0;
      const avgViewsPerVideo = totalVideosNum > 0 ? Math.round(avgViewsNum) : null;

      // Compute avg views per day from channel publish date
      let avgViewsPerDay: number | null = null;
      if (row.publishedAt && totalViewsNum > 0) {
        const ageMs = Date.now() - new Date(row.publishedAt).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays > 1) {
          avgViewsPerDay = Math.round(totalViewsNum / ageDays);
        }
      }

      return {
        id: row.id,
        youtubeChannelId: row.youtubeChannelId,
        handle: row.handle,
        title: row.title,
        description: row.description,
        country: row.country,
        subscriberCount: row.subscriberCount,
        videoCount: row.videoCount,
        viewCount: row.viewCount,
        publishedAt: row.publishedAt,
        thumbnailUrl: row.thumbnailUrl,
        createdAt: row.createdAt,
        aggregates: {
          totalVideos: totalVideosNum,
          totalViews: totalViewsNum,
          avgViewsPerVideo,
          avgViewsPerDay,
          latestVideoDate: row.latestVideoDate,
        },
      };
    });

    return NextResponse.json({
      success: true,
      channels,
      count: channels.length,
      total,
      pagination: { limit: query.limit, offset: query.offset },
    });
  } catch (error) {
    console.error('[BEAMNG API] Error getting channels:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
