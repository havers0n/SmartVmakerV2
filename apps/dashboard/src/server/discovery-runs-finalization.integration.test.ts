import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  discoveryClusterVideos,
  discoveryClusters,
  discoveryRuns,
  discoveryRunSteps,
  discoveryVideoEmbeddings,
  nicheQueries,
  niches,
  videoDiscoveries,
  youtubeChannels,
  youtubeVideos,
} from "@/shared/lib/schema";
import { embeddingFingerprint } from "./discovery-intelligence";
import { DiscoveryMalformedCheckpointError } from "./discovery-execution-errors";
import {
  claimDiscoveryStep,
  finalizeDiscoveryStep,
  getDiscoveryRunProgress,
  runDiscoveryWorkerOnce,
} from "./discovery-runs";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
if (!/@(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) throw new Error("discovery finalization integration tests require a loopback Supabase database");
type CreatedItem = { runId: string; nicheId: string; queryId: string; videoIds: string[]; channelIds: string[] };
const created: CreatedItem[] = [];
const past = "2000-01-01T00:00:00.000Z";

async function fixture(searchStatuses: Array<"pending" | "processing" | "retry_wait" | "completed" | "failed" | "blocked_quota">, status = "running") {
  const suffix = randomUUID(); const now = new Date().toISOString();
  const [{ id: nicheId }] = await db.insert(niches).values({ name: `finalization ${suffix}`, slug: `finalization-${suffix}`, updatedAt: now }).returning({ id: niches.id });
  const [{ id: queryId }] = await db.insert(nicheQueries).values({ nicheId, query: `finalization ${suffix}`, updatedAt: now }).returning({ id: nicheQueries.id });
  const [{ id: runId }] = await db.insert(discoveryRuns).values({ nicheId, status: status as "running", searchOrders: ["relevance"], totalSteps: searchStatuses.length + 1, requestBudget: 50, updatedAt: now }).returning({ id: discoveryRuns.id });
  const search = await db.insert(discoveryRunSteps).values(searchStatuses.map((stepStatus, index) => ({ runId, stepKey: `search:${queryId}:relevance:${index}`, stepType: "search" as const, queryId, querySnapshot: { query: suffix, maxResults: 1 }, searchOrder: "relevance" as const, status: stepStatus, checkpoint: {}, resultCounters: {}, availableAt: past, lockedBy: stepStatus === "processing" ? "search-worker" : null, lockExpiresAt: stepStatus === "processing" ? new Date(Date.now() + 60_000).toISOString() : null, updatedAt: now })) ).returning({ id: discoveryRunSteps.id });
  const [{ id: finalizeId }] = await db.insert(discoveryRunSteps).values({ runId, stepKey: "finalize", stepType: "finalize", querySnapshot: {}, checkpoint: {}, resultCounters: {}, availableAt: past, updatedAt: now }).returning({ id: discoveryRunSteps.id });
  const item: CreatedItem = { runId, nicheId, queryId, videoIds: [], channelIds: [] }; created.push(item);
  return { runId, nicheId, queryId, searchIds: search.map(x => x.id), finalizeId, created: item };
}

async function addNonEmptyResults(ids: Awaited<ReturnType<typeof fixture>>) {
  const now = new Date().toISOString();
  const channels = await db.insert(youtubeChannels).values([
    { youtubeChannelId: `fixture-channel-a-${ids.runId}`, title: "Fixture Channel A", subscriberCount: 1000, hiddenSubscriberCount: false },
    { youtubeChannelId: `fixture-channel-b-${ids.runId}`, title: "Fixture Channel B", subscriberCount: 1000, hiddenSubscriberCount: false },
  ]).returning({ id: youtubeChannels.id });
  const videos = await db.insert(youtubeVideos).values([
    { youtubeId: `fixture-video-a-${ids.runId}`, url: `https://youtube.test/${ids.runId}/a`, title: "Weird science facts A", channelId: channels[0].id, channelTitle: "Fixture Channel A", viewCount: 1000, publishedAt: "2025-01-01T00:00:00.000Z", updatedAt: now },
    { youtubeId: `fixture-video-b-${ids.runId}`, url: `https://youtube.test/${ids.runId}/b`, title: "Weird science facts B", channelId: channels[1].id, channelTitle: "Fixture Channel B", viewCount: 1100, publishedAt: "2025-01-02T00:00:00.000Z", updatedAt: now },
    { youtubeId: `fixture-video-c-${ids.runId}`, url: `https://youtube.test/${ids.runId}/c`, title: "Weird science facts C", channelId: channels[0].id, channelTitle: "Fixture Channel A", viewCount: 1200, publishedAt: "2025-01-03T00:00:00.000Z", updatedAt: now },
  ]).returning({ id: youtubeVideos.id, title: youtubeVideos.title, channelId: youtubeVideos.channelId, channelTitle: youtubeVideos.channelTitle, viewCount: youtubeVideos.viewCount, publishedAt: youtubeVideos.publishedAt });
  await db.insert(videoDiscoveries).values(videos.map((video, index) => ({ runId: ids.runId, videoId: video.id, queryId: ids.queryId, searchOrder: "relevance", resultPosition: index + 1 })));
  await db.insert(discoveryVideoEmbeddings).values(videos.map(video => ({ videoId: video.id, contentHash: embeddingFingerprint({ videoId: video.id, title: video.title, channelId: video.channelId!, channelTitle: video.channelTitle, subscriberCount: 1000, viewCount: video.viewCount, publishedAt: video.publishedAt }), provider: "local", model: "fixture", embedding: [1, 0, 0], updatedAt: now })));
  ids.created.videoIds.push(...videos.map(video => video.id)); ids.created.channelIds.push(...channels.map(channel => channel.id));
}

async function workers() { const a = new Client({ connectionString: databaseUrl }); const b = new Client({ connectionString: databaseUrl }); await Promise.all([a.connect(), b.connect()]); return { a, b, dbA: drizzle(a) as typeof db, dbB: drizzle(b) as typeof db }; }
async function derived(runId: string) { return { clusters: await db.select().from(discoveryClusters).where(eq(discoveryClusters.runId, runId)), memberships: await db.select().from(discoveryClusterVideos).where(eq(discoveryClusterVideos.runId, runId)) }; }

afterEach(async () => {
  while (created.length) {
    const item = created.pop()!;
    await db.delete(discoveryClusterVideos).where(eq(discoveryClusterVideos.runId, item.runId));
    await db.delete(discoveryClusters).where(eq(discoveryClusters.runId, item.runId));
    await db.delete(videoDiscoveries).where(eq(videoDiscoveries.runId, item.runId));
    await db.delete(discoveryRunSteps).where(eq(discoveryRunSteps.runId, item.runId));
    await db.delete(discoveryRuns).where(eq(discoveryRuns.id, item.runId));
    for (const videoId of item.videoIds) await db.delete(youtubeVideos).where(eq(youtubeVideos.id, videoId));
    for (const channelId of item.channelIds) await db.delete(youtubeChannels).where(eq(youtubeChannels.id, channelId));
    await db.delete(nicheQueries).where(eq(nicheQueries.id, item.queryId));
    await db.delete(niches).where(eq(niches.id, item.nicheId));
  }
});
afterAll(async () => { await getPgClient().end(); });

describe("discovery finalization", { timeout: 30_000 }, () => {
  it.each(["pending", "processing", "retry_wait"] as const)("does not claim finalization while a search is %s", async (searchStatus) => {
    const ids = await fixture(["completed", searchStatus]);
    const claimed = await claimDiscoveryStep(db, "too-early");
    expect(claimed?.id).not.toBe(ids.finalizeId);
    const [run, final, result] = await Promise.all([db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }), db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.finalizeId) }), derived(ids.runId)]);
    expect(run?.status).toBe("running"); expect(final?.status).toBe("pending"); expect(result.clusters).toHaveLength(0); expect(result.memberships).toHaveLength(0);
  });

  it("finalizes non-empty results, is idempotent, preserves curation, and stays terminal", async () => {
    const ids = await fixture(["completed"]); await addNonEmptyResults(ids);
    await runDiscoveryWorkerOnce("final-worker");
    const first = await derived(ids.runId); const clustersBeforeRetry = first.clusters.length; const membershipsBeforeRetry = first.memberships.length;
    expect(clustersBeforeRetry).toBe(1); expect(membershipsBeforeRetry).toBe(3); expect(clustersBeforeRetry).toBeGreaterThanOrEqual(1); expect(membershipsBeforeRetry).toBeGreaterThanOrEqual(1);
    expect(first.memberships.every(m => first.clusters.some(c => c.id === m.clusterId))).toBe(true);
    expect(first.memberships.every(m => ids.created.videoIds.includes(m.videoId))).toBe(true);
    expect(new Set(first.memberships.map(m => m.videoId)).size).toBe(membershipsBeforeRetry);
    const [completedStep, completedRun] = await Promise.all([db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.finalizeId) }), db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) })]);
    expect(completedStep?.status).toBe("completed"); expect(completedRun?.status).toBe("completed");
    const curatedVideoId = first.memberships[0].videoId;
    await db.update(discoveryClusterVideos).set({ isExcluded: true }).where(eq(discoveryClusterVideos.videoId, curatedVideoId));
    await finalizeDiscoveryStep(completedStep!, completedRun!, "forced-retry");
    const second = await derived(ids.runId); const clustersAfterRetry = second.clusters.length; const membershipsAfterRetry = second.memberships.length;
    expect({ clustersBeforeRetry, membershipsBeforeRetry, clustersAfterRetry, membershipsAfterRetry }).toEqual({ clustersBeforeRetry, membershipsBeforeRetry, clustersAfterRetry: clustersBeforeRetry, membershipsAfterRetry: membershipsBeforeRetry });
    expect(second.memberships.filter(m => m.videoId === curatedVideoId)).toHaveLength(1);
    expect(second.memberships.find(m => m.videoId === curatedVideoId)?.isExcluded).toBe(true);
    expect((await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }))?.status).toBe("completed");
    // claimDiscoveryStep is intentionally a global worker operation.  Do not
    // claim arbitrary work from another fixture just to prove this run is terminal.
    expect((await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.finalizeId) }))?.status).toBe("completed");
    expect(await getDiscoveryRunProgress(ids.runId)).toMatchObject({ status: "completed" });
  });

  it("rolls back derived rows on failure before completion, then retries successfully", async () => {
    const ids = await fixture(["completed"]); await addNonEmptyResults(ids);
    await runDiscoveryWorkerOnce("failing-worker", { beforeFinalizationCommit: () => { throw new Error("test transaction failure"); } });
    const failed = await derived(ids.runId); const step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.finalizeId) }); const run = await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) });
    expect(failed.clusters).toHaveLength(0); expect(failed.memberships).toHaveLength(0); expect(step).toMatchObject({ status: "retry_wait", lastErrorCode: "internal_error" }); expect(run?.status).toBe("running");
    expect((await db.select().from(videoDiscoveries).where(eq(videoDiscoveries.runId, ids.runId))).length).toBe(3);
    await db.update(discoveryRunSteps).set({ availableAt: past }).where(eq(discoveryRunSteps.id, ids.finalizeId)); await runDiscoveryWorkerOnce("retry-worker");
    const retried = await derived(ids.runId); expect(retried.clusters.length).toBeGreaterThanOrEqual(1); expect(retried.memberships.length).toBeGreaterThanOrEqual(1); expect((await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }))?.status).toBe("completed");
  });

  it("keeps non-empty derived results for partial terminal search failure", async () => {
    const ids = await fixture(["completed", "failed"]); await addNonEmptyResults(ids); await runDiscoveryWorkerOnce("partial-worker");
    const result = await derived(ids.runId); expect(result.clusters.length).toBe(1); expect(result.memberships.length).toBe(3); expect(result.clusters.length).toBeGreaterThanOrEqual(1); expect(result.memberships.length).toBeGreaterThanOrEqual(1); expect((await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }))?.status).toBe("completed_with_errors"); expect((await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.searchIds[1]) }))?.status).toBe("failed");
    const run = await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }); const step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.finalizeId) }); await finalizeDiscoveryStep(step!, run!, "partial-forced-retry"); const retried = await derived(ids.runId); expect(retried.clusters).toHaveLength(result.clusters.length); expect(retried.memberships).toHaveLength(result.memberships.length);
  });

  it("leases a runnable finalization step to exactly one concurrent worker", async () => {
    const ids = await fixture(["completed"]); const { a, b, dbA, dbB } = await workers();
    try { const [left, right] = await Promise.all([claimDiscoveryStep(dbA, "worker-A"), claimDiscoveryStep(dbB, "worker-B")]); const claims = [left, right].filter(Boolean); const step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.finalizeId) }); expect(claims).toHaveLength(1); expect(claims[0]?.id).toBe(ids.finalizeId); expect(step).toMatchObject({ status: "processing", attemptCount: 1 }); } finally { await Promise.all([a.end(), b.end()]); }
  });

  it("allows partial terminal failure, but cancelled and budget-blocked runs never finalize", async () => {
    const cancelled = await fixture(["completed"], "cancelled"); await db.update(discoveryRuns).set({ cancelRequestedAt: new Date().toISOString() }).where(eq(discoveryRuns.id, cancelled.runId)); const blocked = await fixture(["blocked_quota"], "blocked"); expect(await claimDiscoveryStep(db, "no-cancel")).toBeUndefined(); expect((await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, cancelled.runId) }))?.status).toBe("cancelled"); expect((await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, blocked.runId) }))?.status).toBe("blocked");
  });

  it("does not expose lease ownership and sanitizes finalization errors", async () => {
    const ids = await fixture(["completed"]); await runDiscoveryWorkerOnce("bad-final", { beforeFinalizationCommit: () => { throw new DiscoveryMalformedCheckpointError(); } }); const progress = await getDiscoveryRunProgress(ids.runId); expect(progress).toMatchObject({ status: "running", progress: { retry_wait: 0, failed: 1, lastError: "The discovery checkpoint is malformed" } }); expect(progress).not.toHaveProperty("lockedBy"); expect(progress?.progress).not.toHaveProperty("lockedBy");
  });
});
