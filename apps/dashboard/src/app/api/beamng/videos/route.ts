export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { BEAMNG_PATTERNS } from "@/shared/lib/beamng-patterns";
import { loadDiscoveryVideos } from "@/shared/lib/beamng-discovery";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z
    .enum([
      "viewsPerDay",
      "outlierScore",
      "publishedAt",
      "views",
      "durationSeconds",
    ])
    .default("publishedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  pattern: z
    .enum(BEAMNG_PATTERNS.map((item) => item.id) as [string, ...string[]])
    .optional(),
  durationBucket: z
    .enum(["shorts", "1_5m", "5_10m", "10m_plus", "unknown"])
    .optional(),
  channelId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  try {
    const query = QuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    let videos = await loadDiscoveryVideos();
    if (query.channelId)
      videos = videos.filter((video) => video.channelId === query.channelId);
    if (query.pattern)
      videos = videos.filter((video) =>
        video.patterns.some((pattern) => pattern.id === query.pattern),
      );
    if (query.durationBucket)
      videos = videos.filter(
        (video) => video.durationBucket === query.durationBucket,
      );
    if (query.search) {
      const search = query.search.toLocaleLowerCase();
      videos = videos.filter((video) =>
        video.title.toLocaleLowerCase().includes(search),
      );
    }
    const value = (video: (typeof videos)[number]): number | string | null => {
      if (query.sortBy === "viewsPerDay") return video.metrics.viewsPerDay;
      if (query.sortBy === "outlierScore") return video.outlierScore;
      if (query.sortBy === "views") return video.viewCount;
      if (query.sortBy === "durationSeconds") return video.durationSeconds;
      return video.publishedAt;
    };
    videos.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      const comparison =
        typeof av === "string" ? av.localeCompare(String(bv)) : av - Number(bv);
      return query.sortDir === "asc" ? comparison : -comparison;
    });
    const total = videos.length;
    const page = videos.slice(query.offset, query.offset + query.limit);
    return NextResponse.json({
      success: true,
      videos: page,
      count: page.length,
      total,
      pagination: { limit: query.limit, offset: query.offset },
    });
  } catch (error) {
    console.error("[BEAMNG API] Error getting videos:", error);
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
