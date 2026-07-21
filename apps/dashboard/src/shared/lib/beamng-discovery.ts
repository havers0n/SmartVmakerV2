import { eq } from "drizzle-orm";
import { db } from "@/shared/lib/db";
import { youtubeChannels, youtubeVideos } from "@/shared/lib/schema";
import {
  average,
  computeDurationBucket,
  computeOutlierConfidence,
  computeOutlierScore,
  computeVideoMetrics,
  median,
} from "./beamng-metrics";
import { detectBeamngPatterns } from "./beamng-patterns";

export async function loadDiscoveryVideos() {
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
      channelYoutubeId: youtubeChannels.youtubeChannelId,
      channelHandle: youtubeChannels.handle,
      channelSubscriberCount: youtubeChannels.subscriberCount,
      canonicalChannelTitle: youtubeChannels.title,
    })
    .from(youtubeVideos)
    .leftJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id));

  const base = rows.map((row) => ({
    ...row,
    metrics: computeVideoMetrics(
      row.viewCount,
      row.likeCount,
      row.commentCount,
      row.publishedAt,
      row.durationSeconds,
    ),
    patterns: detectBeamngPatterns(row.title),
    durationBucket: computeDurationBucket(row.durationSeconds),
  }));

  const channelStats = new Map<
    string,
    { count: number; average: number | null; median: number | null }
  >();
  for (const video of base) {
    if (!video.channelId || channelStats.has(video.channelId)) continue;
    const values = base
      .filter((item) => item.channelId === video.channelId)
      .map((item) => item.metrics.viewsPerDay);
    channelStats.set(video.channelId, {
      count: values.length,
      average: average(values),
      median: median(values),
    });
  }

  return base.map((row) => {
    const stats = row.channelId ? channelStats.get(row.channelId) : undefined;
    const channelVideoCount = stats?.count ?? 0;
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
      updatedAt: row.updatedAt,
      metrics: row.metrics,
      patterns: row.patterns,
      durationBucket: row.durationBucket,
      channelAverageViewsPerDay: stats?.average ?? null,
      channelMedianViewsPerDay: stats?.median ?? null,
      channelVideoCount,
      outlierScore: computeOutlierScore(row.metrics.viewsPerDay, stats?.median),
      outlierConfidence: computeOutlierConfidence(channelVideoCount),
      channel: row.channelYoutubeId
        ? {
            youtubeChannelId: row.channelYoutubeId,
            handle: row.channelHandle,
            subscriberCount: row.channelSubscriberCount,
            title: row.canonicalChannelTitle,
          }
        : null,
    };
  });
}
