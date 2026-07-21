import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  discoveryRuns,
  discoveryRunSteps,
  nicheQueries,
  niches,
  videoDiscoveries,
  youtubeChannels,
  youtubeVideos,
} from "@/shared/lib/schema";
import type {
  YouTubeDiscoverySearchPage,
  YouTubeDiscoverySearchPageInput,
} from "@/shared/lib/youtube";
import { runDiscoveryWorkerOnce } from "./discovery-runs";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

if (!/@(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) {
  throw new Error("discovery page integration tests require a loopback Supabase database");
}

describe("discovery page restart", () => {
  const suffix = randomUUID();
  const channelYoutubeId = `UC${suffix.replace(/-/g, "").slice(0, 22)}`;
  const videoAYoutubeId = `restart-video-a-${suffix}`;
  const videoBYoutubeId = `restart-video-b-${suffix}`;
  const pageTokens: Array<string | undefined> = [];
  let nicheId: string;
  let queryId: string;
  let runId: string;
  let stepId: string;

  const pageAdapter = async ({ pageToken }: YouTubeDiscoverySearchPageInput): Promise<YouTubeDiscoverySearchPage> => {
    pageTokens.push(pageToken ?? undefined);
    const isPageA = pageToken === undefined;
    if (!isPageA && pageToken !== "token-B") {
      throw new Error(`unexpected page token: ${pageToken}`);
    }
    const youtubeId = isPageA ? videoAYoutubeId : videoBYoutubeId;
    return {
      items: [{
        youtubeChannelId: channelYoutubeId,
        channelTitle: `restart channel ${suffix}`,
        channelThumbnailUrl: null,
        resultPosition: 1,
        video: {
          youtubeId,
          url: `https://www.youtube.com/watch?v=${youtubeId}`,
          title: `restart video ${youtubeId}`,
          description: null,
          publishedAt: null,
          channelTitle: `restart channel ${suffix}`,
          durationSeconds: null,
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          tags: [],
          thumbnails: null,
        },
      }],
      nextPageToken: isPageA ? "token-B" : null,
      requestCount: 2,
      estimatedQuotaUnits: 101,
    };
  };

  beforeAll(async () => {
    const now = new Date().toISOString();
    [{ id: nicheId }] = await db.insert(niches).values({
      name: `restart niche ${suffix}`,
      slug: `restart-${suffix}`,
      updatedAt: now,
    }).returning({ id: niches.id });
    [{ id: queryId }] = await db.insert(nicheQueries).values({
      nicheId,
      query: `restart query ${suffix}`,
      updatedAt: now,
    }).returning({ id: nicheQueries.id });
    [{ id: runId }] = await db.insert(discoveryRuns).values({
      nicheId,
      status: "queued",
      searchOrders: ["relevance"],
      totalSteps: 1,
      requestBudget: 50,
      updatedAt: now,
    }).returning({ id: discoveryRuns.id });
    [{ id: stepId }] = await db.insert(discoveryRunSteps).values({
      runId,
      stepKey: `search:${queryId}:relevance`,
      stepType: "search",
      queryId,
      querySnapshot: { query: `restart query ${suffix}`, maxResults: 1, publishedAfter: null },
      searchOrder: "relevance",
      checkpoint: {},
      resultCounters: {},
      availableAt: "2000-01-01T00:00:00.000Z",
      updatedAt: now,
    }).returning({ id: discoveryRunSteps.id });
  });

  afterAll(async () => {
    await db.delete(discoveryRuns).where(eq(discoveryRuns.id, runId));
    await db.delete(niches).where(eq(niches.id, nicheId));
    await getPgClient().end();
  });

  it("continues from the committed checkpoint after the executor restarts", async () => {
    await runDiscoveryWorkerOnce("worker-A", { searchPage: pageAdapter });

    const [stepAfterPageA, videoAfterPageA, evidenceAfterPageA] = await Promise.all([
      db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, stepId) }),
      db.query.youtubeVideos.findFirst({ where: eq(youtubeVideos.youtubeId, videoAYoutubeId) }),
      db.select({ videoId: videoDiscoveries.videoId })
        .from(videoDiscoveries)
        .where(eq(videoDiscoveries.runId, runId)),
    ]);
    expect(stepAfterPageA?.status).toBe("pending");
    expect(stepAfterPageA?.lockedBy).toBeNull();
    expect(stepAfterPageA?.checkpoint).toMatchObject({
      nextPageToken: "token-B",
      pagesCompleted: 1,
      paginationComplete: false,
    });
    expect(stepAfterPageA?.resultCounters).toEqual({ videos: 1, channels: 1 });
    expect(videoAfterPageA?.youtubeId).toBe(videoAYoutubeId);
    expect(evidenceAfterPageA).toHaveLength(1);

    await runDiscoveryWorkerOnce("worker-B", { searchPage: pageAdapter });

    const channel = await db.query.youtubeChannels.findFirst({
      where: eq(youtubeChannels.youtubeChannelId, channelYoutubeId),
    });
    const [stepAfterPageB, videos, evidence] = await Promise.all([
      db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, stepId) }),
      db.select({ id: youtubeVideos.id, youtubeId: youtubeVideos.youtubeId })
        .from(youtubeVideos)
        .where(eq(youtubeVideos.channelId, channel?.id ?? "00000000-0000-0000-0000-000000000000")),
      db.select({ videoId: videoDiscoveries.videoId })
        .from(videoDiscoveries)
        .where(eq(videoDiscoveries.runId, runId)),
    ]);

    expect(stepAfterPageB?.checkpoint).toMatchObject({
      nextPageToken: null,
      paginationComplete: true,
      pagesCompleted: 2,
    });
    expect(stepAfterPageB?.resultCounters).toEqual({ videos: 2, channels: 2 });
    expect(stepAfterPageB?.status).toBe("completed");
    expect(channel).toBeDefined();
    expect(videos.map((video) => video.youtubeId).sort()).toEqual([videoAYoutubeId, videoBYoutubeId].sort());
    expect(evidence).toHaveLength(2);
    expect(new Set(evidence.map((item) => item.videoId)).size).toBe(2);
    expect(evidence.map((item) => item.videoId).sort()).toEqual(videos.map((video) => video.id).sort());

    await runDiscoveryWorkerOnce("worker-B", { searchPage: pageAdapter });
    expect(pageTokens).toEqual([undefined, "token-B"]);
  });
});
