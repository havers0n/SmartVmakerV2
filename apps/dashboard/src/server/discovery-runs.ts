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
