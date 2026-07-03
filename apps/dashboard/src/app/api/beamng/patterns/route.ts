export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { loadDiscoveryVideos } from "@/shared/lib/beamng-discovery";
import { average, median } from "@/shared/lib/beamng-metrics";
import { BEAMNG_PATTERNS, OTHER_PATTERN } from "@/shared/lib/beamng-patterns";

const QuerySchema = z.object({
  durationBucket: z
    .enum(["shorts", "1_5m", "5_10m", "10m_plus", "unknown"])
    .optional(),
  channelId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  try {
    const query = QuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    let videos = await loadDiscoveryVideos();
    if (query.durationBucket)
      videos = videos.filter(
        (video) => video.durationBucket === query.durationBucket,
      );
    if (query.channelId)
      videos = videos.filter((video) => video.channelId === query.channelId);

    const registry = [
      ...BEAMNG_PATTERNS.map(({ id, label }) => ({ id, label })),
      OTHER_PATTERN,
    ];
    const patterns = registry
      .map((pattern) => {
        const matches = videos.filter((video) =>
          video.patterns.length === 0
            ? pattern.id === OTHER_PATTERN.id
            : video.patterns.some((item) => item.id === pattern.id),
        );
        const values = matches.map((video) => video.metrics.viewsPerDay);
        const channelIds = new Set(
          matches.map((video) => video.channelId).filter(Boolean),
        );
        const topVideo = [...matches].sort(
          (a, b) =>
            (b.metrics.viewsPerDay ?? -1) - (a.metrics.viewsPerDay ?? -1),
        )[0];
        const channelPerformance = new Map<
          string,
          { video: (typeof matches)[number]; values: Array<number | null> }
        >();
        for (const video of matches) {
          if (!video.channelId) continue;
          const entry = channelPerformance.get(video.channelId) ?? {
            video,
            values: [],
          };
          entry.values.push(video.metrics.viewsPerDay);
          channelPerformance.set(video.channelId, entry);
        }
        const topChannelEntry = [...channelPerformance.values()].sort(
          (a, b) => (average(b.values) ?? -1) - (average(a.values) ?? -1),
        )[0];
        const durationBuckets = matches.reduce<Record<string, number>>(
          (result, video) => {
            result[video.durationBucket] =
              (result[video.durationBucket] ?? 0) + 1;
            return result;
          },
          {},
        );
        return {
          patternId: pattern.id,
          label: pattern.label,
          videoCount: matches.length,
          channelCount: channelIds.size,
          averageViewsPerDay: average(values),
          medianViewsPerDay: median(values),
          durationBuckets,
          topVideo: topVideo
            ? {
                id: topVideo.id,
                youtubeId: topVideo.youtubeId,
                title: topVideo.title,
                viewsPerDay: topVideo.metrics.viewsPerDay,
                url: topVideo.url,
              }
            : null,
          topChannel: topChannelEntry
            ? {
                id: topChannelEntry.video.channelId,
                title:
                  topChannelEntry.video.channel?.title ??
                  topChannelEntry.video.channelTitle,
                handle: topChannelEntry.video.channel?.handle ?? null,
              }
            : null,
        };
      })
      .filter((pattern) => pattern.videoCount > 0);

    patterns.sort(
      (a, b) =>
        b.videoCount - a.videoCount ||
        (b.averageViewsPerDay ?? 0) - (a.averageViewsPerDay ?? 0),
    );
    return NextResponse.json({
      success: true,
      patterns,
      count: patterns.length,
    });
  } catch (error) {
    console.error("[BEAMNG API] Error getting patterns:", error);
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
