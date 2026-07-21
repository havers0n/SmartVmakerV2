import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import { discoveryRuns, discoveryRunSteps, nicheQueries, niches, videoDiscoveries, youtubeVideos } from "@/shared/lib/schema";
import { cancelDiscoveryRun, claimDiscoveryStep, resumeDiscoveryRun, runDiscoveryWorkerOnce } from "./discovery-runs";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
if (!/@(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) throw new Error("cancel/resume integration tests require a loopback Supabase database");

const fixtures: Array<{ nicheId: string; runId: string }> = [];
const past = "2000-01-01T00:00:00.000Z";

async function fixture(options: { status?: "queued" | "cancelled" | "completed" | "blocked"; budget?: number; used?: number; checkpoint?: Record<string, unknown>; stepStatus?: "pending" | "processing" | "retry_wait" | "completed" | "failed" | "cancelled" | "blocked_quota"; attempts?: number; maxAttempts?: number; error?: string | null; final?: boolean } = {}) {
  const suffix = randomUUID(); const now = new Date().toISOString();
  const [{ id: nicheId }] = await db.insert(niches).values({ name: `cancel niche ${suffix}`, slug: `cancel-${suffix}`, updatedAt: now }).returning({ id: niches.id });
  const [{ id: queryId }] = await db.insert(nicheQueries).values({ nicheId, query: `cancel query ${suffix}`, updatedAt: now }).returning({ id: nicheQueries.id });
  const [{ id: runId }] = await db.insert(discoveryRuns).values({ nicheId, status: options.status ?? "queued", searchOrders: ["relevance"], totalSteps: options.final ? 2 : 1, requestBudget: options.budget ?? 50, externalRequestCount: options.used ?? 0, cancelRequestedAt: options.status === "cancelled" ? now : null, cancelledAt: options.status === "cancelled" ? now : null, updatedAt: now }).returning({ id: discoveryRuns.id });
  const [{ id: stepId }] = await db.insert(discoveryRunSteps).values({ runId, stepKey: `search:${queryId}:relevance`, stepType: "search", queryId, querySnapshot: { query: `cancel query ${suffix}`, maxResults: 1, publishedAfter: null }, searchOrder: "relevance", status: options.stepStatus ?? "pending", checkpoint: options.checkpoint ?? {}, resultCounters: (options.checkpoint as { resultCounters?: Record<string, number> } | undefined)?.resultCounters ?? {}, attemptCount: options.attempts ?? 0, maxAttempts: options.maxAttempts ?? 4, lastErrorCode: options.error ?? null, availableAt: past, lockedBy: options.stepStatus === "processing" ? "active-worker" : null, lockedAt: options.stepStatus === "processing" ? now : null, lockExpiresAt: options.stepStatus === "processing" ? new Date(Date.now() + 60_000).toISOString() : null, updatedAt: now }).returning({ id: discoveryRunSteps.id });
  let finalId: string | undefined;
  if (options.final) [{ id: finalId }] = await db.insert(discoveryRunSteps).values({ runId, stepKey: "finalize", stepType: "finalize", querySnapshot: {}, checkpoint: {}, resultCounters: {}, availableAt: past, updatedAt: now }).returning({ id: discoveryRunSteps.id });
  fixtures.push({ nicheId, runId }); return { nicheId, queryId, runId, stepId, finalId, suffix };
}

function page(suffix: string, name: string, token: string | null) {
  const videoId = `cancel-${name}-${suffix}`; return { items: [{ youtubeChannelId: `UC${suffix.replace(/-/g, "").slice(0, 22)}`, channelTitle: `channel ${suffix}`, channelThumbnailUrl: null, resultPosition: 1, video: { youtubeId: videoId, url: `https://youtube.test/${videoId}`, title: name, description: null, publishedAt: null, channelTitle: `channel ${suffix}`, durationSeconds: null, viewCount: 1, likeCount: 0, commentCount: 0, tags: [], thumbnails: null } }], nextPageToken: token, requestCount: 2, estimatedQuotaUnits: 101 };
}

afterEach(async () => { while (fixtures.length) { const item = fixtures.pop()!; await db.delete(discoveryRuns).where(eq(discoveryRuns.id, item.runId)); await db.delete(niches).where(eq(niches.id, item.nicheId)); } });
afterAll(async () => { await getPgClient().end(); });

describe("discovery run cancellation and resume", () => {
  it("cancels pending/retry work durably and idempotently without changing completed work", async () => {
    const ids = await fixture({ final: true }); const now = new Date().toISOString();
    const [{ id: retryId }] = await db.insert(discoveryRunSteps).values({ runId: ids.runId, stepKey: "retry", stepType: "search", querySnapshot: {}, checkpoint: { nextPageToken: "retry-token", pagesCompleted: 2 }, resultCounters: { videos: 2, channels: 2 }, status: "retry_wait", availableAt: past, updatedAt: now }).returning({ id: discoveryRunSteps.id });
    const [{ id: doneId }] = await db.insert(discoveryRunSteps).values({ runId: ids.runId, stepKey: "done", stepType: "search", querySnapshot: {}, checkpoint: { nextPageToken: null, pagesCompleted: 1 }, resultCounters: { videos: 1, channels: 1 }, status: "completed", completedAt: now, availableAt: past, updatedAt: now }).returning({ id: discoveryRunSteps.id });
    const first = await cancelDiscoveryRun(ids.runId); const second = await cancelDiscoveryRun(ids.runId);
    const steps = await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.runId, ids.runId));
    expect(first?.cancelRequestedAt).toBeTruthy(); expect(second?.cancelRequestedAt).toBe(first?.cancelRequestedAt);
    expect(steps.find((s) => s.id === ids.stepId)?.status).toBe("cancelled"); expect(steps.find((s) => s.id === retryId)).toMatchObject({ status: "cancelled", checkpoint: { nextPageToken: "retry-token", pagesCompleted: 2 } });
    expect(steps.find((s) => s.id === doneId)).toMatchObject({ status: "completed", resultCounters: { videos: 1, channels: 1 } }); expect(steps.find((s) => s.id === ids.finalId)?.status).toBe("cancelled");
    expect(await claimDiscoveryStep(db, "no-work")).toBeUndefined();
  });

  it("observes cancellation before an external call without reserving budget", async () => {
    const ids = await fixture(); let calls = 0; let entered!: () => void; let continueWorker!: () => void;
    const enteredGate = new Promise<void>((resolve) => { entered = resolve; }); const continueGate = new Promise<void>((resolve) => { continueWorker = resolve; });
    const worker = runDiscoveryWorkerOnce("worker-before", { beforePageExecution: async () => { entered(); await continueGate; }, searchPage: async () => { calls++; return page(ids.suffix, "A", null); } });
    await enteredGate; await cancelDiscoveryRun(ids.runId); continueWorker(); await worker;
    const [run, step] = await Promise.all([db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }), db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) })]);
    expect(calls).toBe(0); expect(run).toMatchObject({ externalRequestCount: 0, status: "cancelled" }); expect(step).toMatchObject({ status: "cancelled", checkpoint: {}, resultCounters: {}, lockedBy: null });
  });

  it("commits the in-flight page once, then cancels before the next page", async () => {
    const ids = await fixture(); let started!: () => void; let release!: () => void; const adapterStarted = new Promise<void>((resolve) => { started = resolve; }); const barrier = new Promise<void>((resolve) => { release = resolve; }); const history: Array<string | undefined> = [];
    const worker = runDiscoveryWorkerOnce("worker-A", { searchPage: async ({ pageToken }) => { history.push(pageToken ?? undefined); started(); await barrier; return page(ids.suffix, "A", "token-B"); } });
    await adapterStarted; const duringCancel = await cancelDiscoveryRun(ids.runId); expect(duringCancel?.status).not.toBe("cancelled"); release(); await worker;
    const [run, step, evidence, videos] = await Promise.all([db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }), db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }), db.select().from(videoDiscoveries).where(eq(videoDiscoveries.runId, ids.runId)), db.select().from(youtubeVideos).where(eq(youtubeVideos.youtubeId, `cancel-A-${ids.suffix}`))]);
    expect(history).toEqual([undefined]); expect(run).toMatchObject({ status: "cancelled", externalRequestCount: 2 }); expect(step).toMatchObject({ status: "cancelled", checkpoint: { nextPageToken: "token-B", pagesCompleted: 1 }, resultCounters: { videos: 1, channels: 1 }, lockedBy: null }); expect(evidence).toHaveLength(1); expect(videos).toHaveLength(1);
  });

  it("resumes the same cancelled step from its durable page checkpoint exactly once", async () => {
    const ids = await fixture(); const history: Array<string | undefined> = [];
    await runDiscoveryWorkerOnce("worker-A", { searchPage: async ({ pageToken }) => { history.push(pageToken ?? undefined); return page(ids.suffix, "A", "token-B"); } }); await cancelDiscoveryRun(ids.runId);
    const before = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }); const planCount = (await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.runId, ids.runId))).length;
    await resumeDiscoveryRun(ids.runId); await resumeDiscoveryRun(ids.runId);
    const resumed = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }); expect(resumed).toMatchObject({ id: before?.id, status: "pending", checkpoint: { nextPageToken: "token-B", pagesCompleted: 1 } }); expect(resumed?.attemptCount).toBe(before?.attemptCount); expect((await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.runId, ids.runId))).length).toBe(planCount);
    await runDiscoveryWorkerOnce("worker-B", { searchPage: async ({ pageToken }) => { history.push(pageToken ?? undefined); expect(pageToken).toBe("token-B"); return page(ids.suffix, "B", null); } });
    const [step, evidence] = await Promise.all([db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }), db.select().from(videoDiscoveries).where(eq(videoDiscoveries.runId, ids.runId))]);
    expect(history).toEqual([undefined, "token-B"]); expect(step).toMatchObject({ status: "completed", checkpoint: { pagesCompleted: 2, nextPageToken: null } }); expect(evidence).toHaveLength(2);
  });

  it("does not revive completed, malformed, exhausted, or budget-blocked work", async () => {
    const completed = await fixture({ status: "completed", stepStatus: "completed", final: true }); await db.update(discoveryRunSteps).set({ status: "completed", completedAt: new Date().toISOString() }).where(eq(discoveryRunSteps.id, completed.finalId!)); const malformed = await fixture({ status: "cancelled", stepStatus: "failed", checkpoint: { pagesCompleted: "bad", nextPageToken: "saved" }, error: "malformed_checkpoint" }); const exhausted = await fixture({ status: "cancelled", stepStatus: "failed", checkpoint: { pagesCompleted: 1, nextPageToken: "saved" }, attempts: 4, maxAttempts: 4, error: "upstream_5xx" }); const blocked = await fixture({ status: "cancelled", stepStatus: "blocked_quota", budget: 2, used: 2, checkpoint: { pagesCompleted: 1, nextPageToken: "saved" }, error: "quota_budget_exhausted" }); let calls = 0;
    await Promise.all([resumeDiscoveryRun(completed.runId), resumeDiscoveryRun(malformed.runId), resumeDiscoveryRun(exhausted.runId), resumeDiscoveryRun(blocked.runId)]);
    const rows = await Promise.all([completed, malformed, exhausted, blocked].map((ids) => db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }))); const runs = await Promise.all([completed, malformed, exhausted, blocked].map((ids) => db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) })));
    expect(rows.map((row) => row?.status)).toEqual(["completed", "failed", "failed", "blocked_quota"]); expect(runs.map((run) => run?.status)).toEqual(["completed", "cancelled", "cancelled", "cancelled"]); expect(rows[1]?.checkpoint).toMatchObject({ pagesCompleted: "bad", nextPageToken: "saved" }); expect(rows[2]?.attemptCount).toBe(4); await runDiscoveryWorkerOnce("no-loop", { searchPage: async () => { calls++; return page(blocked.suffix, "unexpected", null); } }); expect(calls).toBe(0);
  });

  it("resumes retryable failures below their attempt limit without resetting attempts", async () => {
    const ids = await fixture({ status: "cancelled", stepStatus: "failed", checkpoint: { pagesCompleted: 1, nextPageToken: "token-B" }, attempts: 2, maxAttempts: 4, error: "upstream_5xx" }); await resumeDiscoveryRun(ids.runId);
    expect(await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) })).toMatchObject({ status: "pending", attemptCount: 2, checkpoint: { pagesCompleted: 1, nextPageToken: "token-B" } });
  });
});
