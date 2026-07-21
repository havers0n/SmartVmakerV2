import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Client } from "pg";
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => { resolve = next; });
  return { promise, resolve };
}

type DbConnection = Client;
type WorkerResult = Awaited<ReturnType<typeof runDiscoveryWorkerOnce>>;

async function readLeaseState(stepId: string, runId: string) {
  const [step, run, clock] = await Promise.all([
    db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, stepId) }),
    db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, runId) }),
    db.execute(sql`select now() as now`),
  ]);
  const databaseNow = (clock as unknown as { rows: Array<{ now: string }> }).rows[0]?.now;
  return {
    status: step?.status,
    lockedBy: step?.lockedBy,
    lockExpiresAt: step?.lockExpiresAt,
    databaseNow,
    cancelRequestedAt: run?.cancelRequestedAt,
    runStatus: run?.status,
    attemptCount: step?.attemptCount,
    availableAt: step?.availableAt,
  };
}

describe("discovery stale lease ownership", () => {
  const suffix = randomUUID();
  const staleChannelId = `UC${suffix.replace(/-/g, "").slice(0, 22)}`;
  const currentChannelId = `UC${randomUUID().replace(/-/g, "").slice(0, 22)}`;
  const staleVideoId = `stale-video-A-${suffix}`;
  const currentVideoId = `current-video-B-${suffix}`;
  let nicheId: string;
  let queryId: string;
  let runId: string;
  let stepId: string;

  beforeAll(async () => {
    const now = new Date().toISOString();
    [{ id: nicheId }] = await db.insert(niches).values({
      name: `stale lease niche ${suffix}`,
      slug: `stale-lease-${suffix}`,
      updatedAt: now,
    }).returning({ id: niches.id });
    [{ id: queryId }] = await db.insert(nicheQueries).values({
      nicheId,
      query: `stale lease query ${suffix}`,
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
      querySnapshot: { query: `stale lease query ${suffix}`, maxResults: 1, publishedAfter: null },
      searchOrder: "relevance",
      checkpoint: {},
      resultCounters: {},
      availableAt: "2000-01-01T00:00:00.000Z",
      updatedAt: now,
    }).returning({ id: discoveryRunSteps.id });
  });

  afterAll(async () => {
    await getPgClient().end();
  });

  it("rolls back a stale worker page after another worker reclaims the lease", async () => {
    const aFetchedPage = deferred();
    const allowAUpserts = deferred();
    const bFetchedPage = deferred();
    const allowBCommit = deferred();
    let releaseWorkerA: (() => void) | undefined;
    let workerAPromise: Promise<WorkerResult> | undefined;
    let workerBPromise: Promise<WorkerResult> | undefined;
    let workerAConnection: DbConnection | undefined;
    let workerBConnection: DbConnection | undefined;
    let settled: PromiseSettledResult<WorkerResult>[] = [];
    let bodyError: unknown;

    const pageA = async (_input: YouTubeDiscoverySearchPageInput): Promise<YouTubeDiscoverySearchPage> => {
      aFetchedPage.resolve();
      await allowAUpserts.promise;
      return {
        items: [{
          youtubeChannelId: staleChannelId,
          channelTitle: `stale-channel-A-${suffix}`,
          channelThumbnailUrl: null,
          resultPosition: 1,
          video: {
            youtubeId: staleVideoId,
            url: `https://www.youtube.com/watch?v=${staleVideoId}`,
            title: `stale-video-A-${suffix}`,
            description: null,
            publishedAt: null,
            channelTitle: `stale-channel-A-${suffix}`,
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
    };
    const pageB = async (_input: YouTubeDiscoverySearchPageInput): Promise<YouTubeDiscoverySearchPage> => {
      bFetchedPage.resolve();
      await allowBCommit.promise;
      return {
        items: [{
          youtubeChannelId: currentChannelId,
          channelTitle: `current-channel-B-${suffix}`,
          channelThumbnailUrl: null,
          resultPosition: 1,
          video: {
            youtubeId: currentVideoId,
            url: `https://www.youtube.com/watch?v=${currentVideoId}`,
            title: `current-video-B-${suffix}`,
            description: null,
            publishedAt: null,
            channelTitle: `current-channel-B-${suffix}`,
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
    };

    try {
      const workerADb = db;
      const workerBDb = db;

      let released = false;
      const resolveWorkerABarrier = allowAUpserts.resolve;
      releaseWorkerA = () => {
        if (released) return;
        released = true;
        resolveWorkerABarrier();
      };

      workerAPromise = runDiscoveryWorkerOnce("worker-A", { database: workerADb, searchPage: pageA });
      await aFetchedPage.promise;

      const ownedByA = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, stepId) });
      expect(ownedByA?.lockedBy).toBe("worker-A");
      expect(new Date(ownedByA?.lockExpiresAt ?? 0).getTime()).toBeGreaterThan(Date.now());
      const attemptA = ownedByA?.attemptCount;

      const stillOwnedByA = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, stepId) });
      expect(stillOwnedByA?.lockedBy).toBe("worker-A");
      expect(stillOwnedByA?.attemptCount).toBe(attemptA);
      expect(stillOwnedByA?.lockExpiresAt).toBe(ownedByA?.lockExpiresAt);

      await workerBDb.update(discoveryRunSteps).set({
        lockExpiresAt: new Date(Date.now() - 1_000).toISOString(),
        availableAt: "2000-01-01T00:00:00.000Z",
      }).where(eq(discoveryRunSteps.id, stepId));
      const beforeB = await readLeaseState(stepId, runId);
      expect(beforeB.status).toBe("processing");
      expect(beforeB.lockedBy).toBe("worker-A");
      expect(new Date(beforeB.lockExpiresAt ?? 0).getTime()).toBeLessThan(new Date(beforeB.databaseNow).getTime());
      expect(beforeB.cancelRequestedAt).toBeNull();
      expect(beforeB.runStatus).toBe("running");

      workerBPromise = runDiscoveryWorkerOnce("worker-B", { database: workerBDb, searchPage: pageB });
      const bClaimOutcome = await Promise.race([
        bFetchedPage.promise.then(() => "claimed" as const),
        workerBPromise.then((result) => ({ result })),
      ]);
      if (bClaimOutcome !== "claimed") {
        const afterB = await readLeaseState(stepId, runId);
        throw new Error(`worker B did not reclaim: ${JSON.stringify({ beforeB, afterB, result: bClaimOutcome.result })}`);
      }
      const ownedByB = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, stepId) });
      expect(ownedByB?.lockedBy).toBe("worker-B");
      expect(new Date(ownedByB?.lockExpiresAt ?? 0).getTime()).toBeGreaterThan(Date.now());
      expect(ownedByB?.attemptCount).toBe((attemptA ?? 0) + 1);
      const reclaimedLease = ownedByB?.lockExpiresAt;

      allowBCommit.resolve();
      const workerBResult = await workerBPromise;
      expect(workerBResult).toMatchObject({ processed: true, stepId });
      expect(workerBResult).not.toMatchObject({ processed: false });

      releaseWorkerA();
      const staleResult = await workerAPromise;
      expect(staleResult).toMatchObject({ processed: true, ownershipLost: true });

      const [completedStep, staleChannel, staleVideo, staleEvidence, currentVideos, currentEvidence] = await Promise.all([
        db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, stepId) }),
        db.query.youtubeChannels.findFirst({ where: eq(youtubeChannels.youtubeChannelId, staleChannelId) }),
        db.query.youtubeVideos.findFirst({ where: eq(youtubeVideos.youtubeId, staleVideoId) }),
        db.select().from(videoDiscoveries)
          .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
          .where(and(eq(videoDiscoveries.runId, runId), eq(youtubeVideos.youtubeId, staleVideoId))),
        db.select().from(youtubeVideos).where(eq(youtubeVideos.youtubeId, currentVideoId)),
        db.select().from(videoDiscoveries)
          .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
          .where(and(eq(videoDiscoveries.runId, runId), eq(youtubeVideos.youtubeId, currentVideoId))),
      ]);
      expect(completedStep?.lockedBy).toBeNull();
      expect(completedStep?.status).toBe("completed");
      expect(completedStep?.checkpoint).toMatchObject({ pagesCompleted: 1, paginationComplete: true, nextPageToken: null });
      expect(completedStep?.resultCounters).toEqual({ videos: 1, channels: 1 });
      expect(completedStep?.lockExpiresAt).not.toBe(reclaimedLease);
      expect(staleChannel).toBeUndefined();
      expect(staleVideo).toBeUndefined();
      expect(staleEvidence).toHaveLength(0);
      expect(currentVideos).toHaveLength(1);
      expect(currentEvidence).toHaveLength(1);
    } catch (error) {
      bodyError = error;
      throw error;
    } finally {
      releaseWorkerA?.();

      settled = await Promise.allSettled(
        [workerAPromise, workerBPromise].filter(
          (value): value is Promise<WorkerResult> => Boolean(value),
        ),
      );

      const rejected = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      if (rejected.length) throw rejected[0]?.reason;
      if (!bodyError) {
        const results = settled.filter((result): result is PromiseFulfilledResult<WorkerResult> => result.status === "fulfilled").map((result) => result.value);
        expect(results.some((result) => "ownershipLost" in result && result.ownershipLost === true)).toBe(true);
        expect(results.some((result) => "stepId" in result && result.stepId === stepId)).toBe(true);
      }

      await db.delete(videoDiscoveries).where(eq(videoDiscoveries.runId, runId));
      await db.delete(youtubeVideos).where(inArray(youtubeVideos.youtubeId, [staleVideoId, currentVideoId]));
      await db.delete(youtubeChannels).where(inArray(youtubeChannels.youtubeChannelId, [staleChannelId, currentChannelId]));
      await db.delete(discoveryRunSteps).where(eq(discoveryRunSteps.runId, runId));
      await db.delete(discoveryRuns).where(eq(discoveryRuns.id, runId));
      await db.delete(nicheQueries).where(eq(nicheQueries.id, queryId));
      await db.delete(niches).where(eq(niches.id, nicheId));
      await Promise.all([workerAConnection?.end(), workerBConnection?.end()]);
    }
  });
});
