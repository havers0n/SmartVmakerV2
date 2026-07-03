export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { asc, count, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import { youtubeChannels } from "@/shared/lib/schema";
import { loadDiscoveryVideos } from "@/shared/lib/beamng-discovery";
import { average, median } from "@/shared/lib/beamng-metrics";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z
    .enum([
      "title",
      "subscriberCount",
      "videoCount",
      "viewCount",
      "avgViewsPerVideo",
      "latestVideoDate",
    ])
    .default("subscriberCount"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  try {
    const query = QuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    const where = query.search
      ? sql`LOWER(${youtubeChannels.title}) LIKE LOWER(${"%" + query.search + "%"})`
      : undefined;
    const columns = {
      title: youtubeChannels.title,
      subscriberCount: youtubeChannels.subscriberCount,
      videoCount: youtubeChannels.videoCount,
      viewCount: youtubeChannels.viewCount,
    };
    const sortColumn =
      columns[query.sortBy as keyof typeof columns] ??
      youtubeChannels.subscriberCount;
    const rows = await db
      .select()
      .from(youtubeChannels)
      .where(where)
      .orderBy(query.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn))
      .limit(query.limit)
      .offset(query.offset);
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(youtubeChannels)
      .where(where);
    const videos = await loadDiscoveryVideos();
    const channels = rows.map((row) => {
      const channelVideos = videos.filter(
        (video) => video.channelId === row.id,
      );
      const views = channelVideos.map((video) => video.viewCount ?? 0);
      const viewsPerDay = channelVideos.map(
        (video) => video.metrics.viewsPerDay,
      );
      const patternCounts = new Map<
        string,
        { id: string; label: string; videoCount: number }
      >();
      for (const video of channelVideos)
        for (const pattern of video.patterns.length
          ? video.patterns
          : [{ id: "other", label: "Other" }]) {
          const item = patternCounts.get(pattern.id) ?? {
            ...pattern,
            videoCount: 0,
          };
          item.videoCount += 1;
          patternCounts.set(pattern.id, item);
        }
      const best = [...channelVideos]
        .filter((video) => video.outlierScore != null)
        .sort((a, b) => (b.outlierScore ?? 0) - (a.outlierScore ?? 0))[0];
      return {
        ...row,
        averageViewsPerDay: average(viewsPerDay),
        medianViewsPerDay: median(viewsPerDay),
        dominantPatterns: [...patternCounts.values()]
          .sort((a, b) => b.videoCount - a.videoCount)
          .slice(0, 3),
        bestOutlier: best
          ? {
              videoId: best.id,
              youtubeId: best.youtubeId,
              title: best.title,
              viewsPerDay: best.metrics.viewsPerDay,
              outlierScore: best.outlierScore,
              url: best.url,
            }
          : null,
        aggregates: {
          totalVideos: channelVideos.length,
          totalViews: views.reduce((sum, value) => sum + value, 0),
          avgViewsPerVideo: average(views),
          avgViewsPerDay: average(viewsPerDay),
          latestVideoDate:
            channelVideos
              .map((video) => video.publishedAt)
              .filter((value): value is string => Boolean(value))
              .sort()
              .reverse()[0] ?? null,
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
    console.error("[BEAMNG API] Error getting channels:", error);
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 },
      );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
