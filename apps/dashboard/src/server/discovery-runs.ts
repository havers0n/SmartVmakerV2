import { and, asc, countDistinct, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import {
  discoveryRuns,
  nicheQueries,
  niches,
  videoDiscoveries,
  youtubeChannels,
  youtubeVideos,
} from "@/shared/lib/schema";
import {
  searchYouTubeForDiscovery,
  type YouTubeSearchOrder,
} from "@/shared/lib/youtube";

const searchOrderSchema = z.enum(["relevance", "viewCount", "date"]);

export const discoveryChannelFiltersSchema = z.object({
  maxChannelAgeMonths: z.coerce.number().nonnegative().optional(),
  minMatchedVideos: z.coerce.number().int().nonnegative().optional(),
  minSubscribers: z.coerce.number().nonnegative().optional(),
  maxSubscribers: z.coerce.number().nonnegative().optional(),
  minMedianViews: z.coerce.number().nonnegative().optional(),
  minRelevanceScore: z.coerce.number().min(0).max(1).optional(),
  minQueryCoverage: z.coerce.number().int().nonnegative().optional(),
  minMedianViewsPerDay: z.coerce.number().nonnegative().optional(),
});

export type DiscoveryChannelFilters = z.infer<
  typeof discoveryChannelFiltersSchema
>;

export type DiscoveryChannelEvidenceRow = {
  channelId: string;
  channelTitle: string | null;
  channelPublishedAt: string | null;
  subscriberCount: number | null;
  totalViewCount: number | null;
  channelVideoCount: number | null;
  internalVideoId: string;
  youtubeVideoId: string | null;
  title: string;
  publishedAt: string | null;
  viewCount: number | null;
  queryId: string;
  query: string;
  searchOrder: string;
  resultPosition: number;
};

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateRecencyScore(uploadRecencyDays: number | null) {
  if (uploadRecencyDays === null) return 0;
  if (uploadRecencyDays <= 7) return 1;
  if (uploadRecencyDays <= 30) return 0.75;
  if (uploadRecencyDays <= 90) return 0.5;
  if (uploadRecencyDays <= 180) return 0.25;
  return 0;
}

export function aggregateDiscoveryChannels(
  rows: DiscoveryChannelEvidenceRow[],
  filters: DiscoveryChannelFilters = {},
  now = new Date(),
) {
  const channels = new Map<string, DiscoveryChannelEvidenceRow[]>();
  for (const row of rows) {
    const existing = channels.get(row.channelId) ?? [];
    existing.push(row);
    channels.set(row.channelId, existing);
  }

  return Array.from(channels.values(), (channelRows) => {
    const channel = channelRows[0];
    const videos = new Map<string, DiscoveryChannelEvidenceRow>();
    for (const row of channelRows) videos.set(row.internalVideoId, row);
    const uniqueVideos = [...videos.values()];
    const views = uniqueVideos.map((video) => Number(video.viewCount ?? 0));
    const subscribers = Number(channel.subscriberCount ?? 0);
    const latestMatchedVideoAt =
      uniqueVideos
        .map((video) => video.publishedAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    const viewsPerDay = uniqueVideos.map((video) => {
      const videoAgeDays = video.publishedAt
        ? Math.max(
            1,
            (now.getTime() - new Date(video.publishedAt).getTime()) /
              86_400_000,
          )
        : 1;
      return Number(video.viewCount ?? 0) / videoAgeDays;
    });
    const queryCoverage = new Set(channelRows.map((row) => row.queryId)).size;
    const medianViewsPerDay = median(viewsPerDay);
    const bestViewsPerDay = viewsPerDay.length ? Math.max(...viewsPerDay) : 0;
    const uploadRecencyDays = latestMatchedVideoAt
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(latestMatchedVideoAt).getTime()) /
              86_400_000,
          ),
        )
      : null;
    const recencyScore = calculateRecencyScore(uploadRecencyDays);
    const viewsPerSubscriber =
      subscribers > 0 ? median(views) / subscribers : null;
    const viewsPerSubscriberScore =
      viewsPerSubscriber === null ? 0 : Math.min(viewsPerSubscriber / 10, 1);
    const relevanceScore =
      Math.min(uniqueVideos.length / 10, 1) * 0.3 +
      Math.min(queryCoverage / 3, 1) * 0.2 +
      Math.min(medianViewsPerDay / 10_000, 1) * 0.25 +
      recencyScore * 0.15 +
      viewsPerSubscriberScore * 0.1;
    const channelAgeDays = channel.channelPublishedAt
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(channel.channelPublishedAt).getTime()) /
              86_400_000,
          ),
        )
      : null;

    return {
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      channelPublishedAt: channel.channelPublishedAt,
      channelAgeDays,
      subscriberCount: channel.subscriberCount,
      totalViewCount: channel.totalViewCount,
      channelVideoCount: channel.channelVideoCount,
      matchedVideoCount: uniqueVideos.length,
      queryCoverage,
      latestMatchedVideoAt,
      medianMatchedVideoViews: median(views),
      bestMatchedVideoViews: views.length ? Math.max(...views) : 0,
      medianViewsPerDay,
      bestViewsPerDay,
      uploadRecencyDays,
      recencyScore,
      viewsPerSubscriber,
      viewsPerSubscriberScore,
      relevanceScore,
      evidenceVideos: channelRows.map((video) => ({
        videoId: video.youtubeVideoId ?? video.internalVideoId,
        title: video.title,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        queryId: video.queryId,
        query: video.query,
        searchOrder: video.searchOrder,
        resultPosition: video.resultPosition,
      })),
    };
  })
    .filter(
      (channel) =>
        (filters.maxChannelAgeMonths === undefined ||
          (channel.channelAgeDays !== null &&
            channel.channelAgeDays <= filters.maxChannelAgeMonths * 30.4375)) &&
        (filters.minMatchedVideos === undefined ||
          channel.matchedVideoCount >= filters.minMatchedVideos) &&
        (filters.minSubscribers === undefined ||
          Number(channel.subscriberCount ?? 0) >= filters.minSubscribers) &&
        (filters.maxSubscribers === undefined ||
          Number(channel.subscriberCount ?? 0) <= filters.maxSubscribers) &&
        (filters.minMedianViews === undefined ||
          channel.medianMatchedVideoViews >= filters.minMedianViews) &&
        (filters.minRelevanceScore === undefined ||
          channel.relevanceScore >= filters.minRelevanceScore) &&
        (filters.minQueryCoverage === undefined ||
          channel.queryCoverage >= filters.minQueryCoverage) &&
        (filters.minMedianViewsPerDay === undefined ||
          channel.medianViewsPerDay >= filters.minMedianViewsPerDay),
    )
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore ||
        b.matchedVideoCount - a.matchedVideoCount ||
        b.medianMatchedVideoViews - a.medianMatchedVideoViews ||
        Date.parse(b.latestMatchedVideoAt ?? "1970-01-01") -
          Date.parse(a.latestMatchedVideoAt ?? "1970-01-01"),
    );
}

export const createDiscoveryRunSchema = z.object({
  nicheId: z.string().uuid(),
  searchOrders: z
    .array(searchOrderSchema)
    .min(1)
    .max(3)
    .refine(
      (orders) => new Set(orders).size === orders.length,
      "Search orders must be unique",
    )
    .default(["relevance", "viewCount", "date"]),
  maxResultsPerQuery: z.coerce.number().int().min(1).max(50).default(25),
  publishedAfter: z.string().datetime({ offset: true }).optional(),
});

export class DiscoveryRunError extends Error {
  constructor(
    message: string,
    public readonly runId: string,
  ) {
    super(message);
    this.name = "DiscoveryRunError";
  }
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown discovery error";
}

export async function listDiscoveryRuns(nicheId: string) {
  const validNicheId = z.string().uuid().parse(nicheId);
  return db
    .select()
    .from(discoveryRuns)
    .where(eq(discoveryRuns.nicheId, validNicheId))
    .orderBy(desc(discoveryRuns.createdAt))
    .limit(20);
}

export async function getDiscoveryRun(id: string) {
  const validId = z.string().uuid().parse(id);
  const [run] = await db
    .select()
    .from(discoveryRuns)
    .where(eq(discoveryRuns.id, validId))
    .limit(1);
  if (!run) return null;

  const [counts] = await db
    .select({
      videoCount: countDistinct(videoDiscoveries.videoId),
      uniqueChannelCount: countDistinct(youtubeVideos.channelId),
    })
    .from(videoDiscoveries)
    .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
    .where(eq(videoDiscoveries.runId, validId));

  return {
    ...run,
    videoCount: Number(counts?.videoCount ?? 0),
    uniqueChannelCount: Number(counts?.uniqueChannelCount ?? 0),
  };
}

export async function listDiscoveryRunVideos(id: string) {
  const validId = z.string().uuid().parse(id);
  return db
    .select({
      videoId: youtubeVideos.id,
      youtubeId: youtubeVideos.youtubeId,
      title: youtubeVideos.title,
      channelTitle: youtubeVideos.channelTitle,
      viewCount: youtubeVideos.viewCount,
      publishedAt: youtubeVideos.publishedAt,
      queryId: nicheQueries.id,
      query: nicheQueries.query,
      searchOrder: videoDiscoveries.searchOrder,
      resultPosition: videoDiscoveries.resultPosition,
    })
    .from(videoDiscoveries)
    .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
    .innerJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(eq(videoDiscoveries.runId, validId))
    .orderBy(
      asc(nicheQueries.query),
      asc(videoDiscoveries.searchOrder),
      asc(videoDiscoveries.resultPosition),
    );
}

export async function listDiscoveryRunChannels(
  id: string,
  input: DiscoveryChannelFilters = {},
) {
  const validId = z.string().uuid().parse(id);
  const filters = discoveryChannelFiltersSchema.parse(input);
  const rows = await db
    .select({
      channelId: youtubeChannels.youtubeChannelId,
      channelTitle: youtubeChannels.title,
      channelPublishedAt: youtubeChannels.publishedAt,
      subscriberCount: youtubeChannels.subscriberCount,
      totalViewCount: youtubeChannels.viewCount,
      channelVideoCount: youtubeChannels.videoCount,
      internalVideoId: youtubeVideos.id,
      youtubeVideoId: youtubeVideos.youtubeId,
      title: youtubeVideos.title,
      publishedAt: youtubeVideos.publishedAt,
      viewCount: youtubeVideos.viewCount,
      queryId: nicheQueries.id,
      query: nicheQueries.query,
      searchOrder: videoDiscoveries.searchOrder,
      resultPosition: videoDiscoveries.resultPosition,
    })
    .from(videoDiscoveries)
    .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
    .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
    .innerJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(eq(videoDiscoveries.runId, validId))
    .orderBy(asc(videoDiscoveries.createdAt));

  return aggregateDiscoveryChannels(rows, filters);
}

export async function createDiscoveryRun(input: unknown) {
  const values = createDiscoveryRunSchema.parse(input);
  const [niche] = await db
    .select({ id: niches.id })
    .from(niches)
    .where(eq(niches.id, values.nicheId))
    .limit(1);
  if (!niche) throw new Error("Niche not found");

  const queries = await db
    .select({ id: nicheQueries.id, query: nicheQueries.query })
    .from(nicheQueries)
    .where(
      and(
        eq(nicheQueries.nicheId, values.nicheId),
        eq(nicheQueries.isEnabled, true),
      ),
    )
    .orderBy(asc(nicheQueries.createdAt));
  if (!queries.length)
    throw new Error("The niche has no enabled discovery queries");

  const now = new Date().toISOString();
  const [run] = await db
    .insert(discoveryRuns)
    .values({
      nicheId: values.nicheId,
      status: "running",
      cutoffDate: values.publishedAfter ?? null,
      searchOrders: values.searchOrders,
      startedAt: now,
    })
    .returning();

  try {
    for (const query of queries) {
      for (const order of values.searchOrders as YouTubeSearchOrder[]) {
        const hits = await searchYouTubeForDiscovery({
          query: query.query,
          order,
          maxResults: values.maxResultsPerQuery,
          publishedAfter: values.publishedAfter
            ? new Date(values.publishedAfter)
            : undefined,
        });
        if (!hits.length) continue;

        const channelValues = Array.from(
          new Map(hits.map((hit) => [hit.youtubeChannelId, hit])).values(),
          (hit) => ({
            youtubeChannelId: hit.youtubeChannelId,
            title: hit.channelTitle,
          }),
        );
        const persistedChannels = await db
          .insert(youtubeChannels)
          .values(channelValues)
          .onConflictDoUpdate({
            target: youtubeChannels.youtubeChannelId,
            set: { title: sql`excluded.title`, updatedAt: now },
          })
          .returning({
            id: youtubeChannels.id,
            youtubeChannelId: youtubeChannels.youtubeChannelId,
          });
        const channelIds = new Map(
          persistedChannels.map((channel) => [
            channel.youtubeChannelId,
            channel.id,
          ]),
        );

        const videos = hits.map((hit) => ({
          ...hit.video,
          channelId: channelIds.get(hit.youtubeChannelId),
          updatedAt: now,
        }));
        const persistedVideos = await db
          .insert(youtubeVideos)
          .values(videos)
          .onConflictDoUpdate({
            target: youtubeVideos.youtubeId,
            set: {
              url: sql`excluded.url`,
              title: sql`excluded.title`,
              description: sql`excluded.description`,
              publishedAt: sql`excluded.published_at`,
              channelTitle: sql`excluded.channel_title`,
              durationSeconds: sql`excluded.duration_seconds`,
              viewCount: sql`excluded.view_count`,
              likeCount: sql`excluded.like_count`,
              commentCount: sql`excluded.comment_count`,
              tags: sql`excluded.tags`,
              thumbnails: sql`excluded.thumbnails`,
              channelId: sql`excluded.channel_id`,
              updatedAt: now,
            },
          })
          .returning({
            id: youtubeVideos.id,
            youtubeId: youtubeVideos.youtubeId,
          });
        const videoIds = new Map(
          persistedVideos.map((video) => [video.youtubeId, video.id]),
        );

        await db
          .insert(videoDiscoveries)
          .values(
            hits.map((hit) => ({
              runId: run.id,
              videoId: videoIds.get(hit.video.youtubeId!)!,
              queryId: query.id,
              searchOrder: order,
              resultPosition: hit.resultPosition,
            })),
          )
          .onConflictDoUpdate({
            target: [
              videoDiscoveries.runId,
              videoDiscoveries.videoId,
              videoDiscoveries.queryId,
              videoDiscoveries.searchOrder,
            ],
            set: { resultPosition: sql`excluded.result_position` },
          });
      }
    }

    const [completed] = await db
      .update(discoveryRuns)
      .set({ status: "completed", finishedAt: new Date().toISOString() })
      .where(eq(discoveryRuns.id, run.id))
      .returning();
    return completed;
  } catch (error) {
    const message = readableError(error);
    await db
      .update(discoveryRuns)
      .set({
        status: "failed",
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      })
      .where(eq(discoveryRuns.id, run.id));
    throw new DiscoveryRunError(message, run.id);
  }
}
