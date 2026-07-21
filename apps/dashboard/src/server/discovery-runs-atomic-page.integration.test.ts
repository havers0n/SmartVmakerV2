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
import { runDiscoveryWorkerOnce } from "./discovery-runs";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const isLoopbackDatabase = /@(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl);

if (!isLoopbackDatabase) {
  throw new Error("discovery page integration tests require a loopback Supabase database");
}

describe("discovery page persistence is atomic", () => {
  const suffix = randomUUID();
  const channelYoutubeId = `UC${suffix.replace(/-/g, "").slice(0, 22)}`;
  const videoYoutubeId = `rollback-video-${suffix}`;
  let nicheId: string;
  let queryId: string;
  let runId: string;
  let stepId: string;

  beforeAll(async () => {
    const now = new Date().toISOString();
    [{ id: nicheId }] = await db.insert(niches).values({
      name: `rollback niche ${suffix}`,
      slug: `rollback-${suffix}`,
      updatedAt: now,
    }).returning({ id: niches.id });
    [{ id: queryId }] = await db.insert(nicheQueries).values({
      nicheId,
      query: `rollback query ${suffix}`,
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
      querySnapshot: { query: `rollback query ${suffix}`, maxResults: 1, publishedAfter: null },
      searchOrder: "relevance",
      checkpoint: {},
      resultCounters: {},
      updatedAt: now,
    }).returning({ id: discoveryRunSteps.id });
  });

  afterAll(async () => {
    await db.delete(discoveryRuns).where(eq(discoveryRuns.id, runId));
    await db.delete(niches).where(eq(niches.id, nicheId));
    await getPgClient().end();
  });

  it("rolls back page upserts when failure occurs before the checkpoint", async () => {
    const initialStep = await db.query.discoveryRunSteps.findFirst({
      where: eq(discoveryRunSteps.id, stepId),
    });

    let fakeAdapterCalled = false;
    let injectedFailure = false;
    await runDiscoveryWorkerOnce("worker-test", {
      searchPage: async () => {
        fakeAdapterCalled = true;
        return {
        items: [{
          youtubeChannelId: channelYoutubeId,
          channelTitle: `rollback channel ${suffix}`,
          channelThumbnailUrl: null,
          resultPosition: 1,
          video: {
            youtubeId: videoYoutubeId,
            url: `https://www.youtube.com/watch?v=${videoYoutubeId}`,
            title: `rollback video ${suffix}`,
            description: null,
            publishedAt: null,
            channelTitle: `rollback channel ${suffix}`,
            durationSeconds: null,
            viewCount: 0,
            likeCount: 0,
            commentCount: 0,
            tags: [],
            thumbnails: null,
          },
        }],
        nextPageToken: null,
        requestCount: 2,
        estimatedQuotaUnits: 101,
        };
      },
      afterPageUpserts: async () => {
        injectedFailure = true;
        throw new Error("test-only failure after page upserts");
      },
    });

    const [channel, video, evidence, step] = await Promise.all([
      db.query.youtubeChannels.findFirst({ where: eq(youtubeChannels.youtubeChannelId, channelYoutubeId) }),
      db.query.youtubeVideos.findFirst({ where: eq(youtubeVideos.youtubeId, videoYoutubeId) }),
      db.query.videoDiscoveries.findFirst({ where: eq(videoDiscoveries.runId, runId) }),
      db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, stepId) }),
    ]);

    expect(fakeAdapterCalled).toBe(true);
    expect(injectedFailure).toBe(true);
    expect(channel).toBeUndefined();
    expect(video).toBeUndefined();
    expect(evidence).toBeUndefined();
    expect(step?.checkpoint).toEqual(initialStep?.checkpoint);
    expect((step?.checkpoint as { pagesCompleted?: number }).pagesCompleted ?? 0).toBe(0);
    expect(step?.resultCounters).toEqual(initialStep?.resultCounters);
    expect(step?.status).not.toBe("completed");
  });
});
