import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import { discoveryRuns, discoveryRunSteps, nicheQueries, niches } from "@/shared/lib/schema";
import { getDiscoveryRunProgress, runDiscoveryWorkerOnce } from "./discovery-runs";
import { DiscoveryConfigurationError, DiscoveryLeaseLostError, YouTubeDiscoveryApiError, YouTubeQuotaExhaustedError } from "./discovery-execution-errors";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
if (!/@(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) throw new Error("discovery retry integration tests require a loopback Supabase database");

async function fixture(options: { checkpoint?: object; counters?: Record<string, number>; maxAttempts?: number } = {}) {
  const suffix = randomUUID(); const now = new Date().toISOString();
  const [{ id: nicheId }] = await db.insert(niches).values({ name: `retry niche ${suffix}`, slug: `retry-${suffix}`, updatedAt: now }).returning({ id: niches.id });
  const [{ id: queryId }] = await db.insert(nicheQueries).values({ nicheId, query: `retry query ${suffix}`, updatedAt: now }).returning({ id: nicheQueries.id });
  const [{ id: runId }] = await db.insert(discoveryRuns).values({ nicheId, status: "queued", searchOrders: ["relevance"], totalSteps: 1, requestBudget: 50, updatedAt: now }).returning({ id: discoveryRuns.id });
  const [{ id: stepId }] = await db.insert(discoveryRunSteps).values({ runId, stepKey: `search:${queryId}:relevance`, stepType: "search", queryId, querySnapshot: { query: `retry query ${suffix}`, maxResults: 1, publishedAfter: null }, searchOrder: "relevance", checkpoint: (options.checkpoint ?? { pagesCompleted: 1, nextPageToken: "saved-token", resultCounters: { videos: 3, channels: 2 } }) as Record<string, unknown>, resultCounters: options.counters ?? { videos: 3, channels: 2 }, maxAttempts: options.maxAttempts ?? 4, availableAt: "2000-01-01T00:00:00.000Z", updatedAt: now }).returning({ id: discoveryRunSteps.id });
  return { nicheId, runId, stepId };
}
async function cleanup(ids: { nicheId: string; runId: string }) { await db.delete(discoveryRuns).where(eq(discoveryRuns.id, ids.runId)); await db.delete(niches).where(eq(niches.id, ids.nicheId)); }

describe("discovery retry state transitions", () => {
  afterAll(async () => { await getPgClient().end(); });

  it("persists a retryable 503 with checkpoint, counters, sanitized code, and released lease", async () => {
    const ids = await fixture(); const before = Date.now();
    try {
      await runDiscoveryWorkerOnce("retry-503", { searchPage: async () => { throw new YouTubeDiscoveryApiError({ status: 503 }); } });
      const step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }); const run = await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) });
      expect(step).toMatchObject({ status: "retry_wait", attemptCount: 1, lastErrorCode: "upstream_5xx", lastErrorMessage: "YouTube service is temporarily unavailable", checkpoint: { pagesCompleted: 1, nextPageToken: "saved-token" }, resultCounters: { videos: 3, channels: 2 }, lockedBy: null, lockedAt: null, lockExpiresAt: null });
      expect(new Date(step!.availableAt).getTime()).toBeGreaterThan(before); expect(run?.status).not.toBe("completed");
    } finally { await cleanup(ids); }
  });

  it("fails terminal configuration errors without retrying or deleting checkpoint", async () => {
    const ids = await fixture();
    try {
      await runDiscoveryWorkerOnce("terminal", { searchPage: async () => { throw new DiscoveryConfigurationError(); } });
      const step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }); const progress = await getDiscoveryRunProgress(ids.runId);
      expect(step).toMatchObject({ status: "failed", lastErrorCode: "youtube_not_configured", checkpoint: { pagesCompleted: 1, nextPageToken: "saved-token" }, lockedBy: null });
      expect(new Date(step!.availableAt).getTime()).toBeLessThanOrEqual(Date.now() + 1_000); expect((progress?.progress as Record<string, unknown>).retry_wait).toBe(0); expect(progress?.status).not.toBe("completed");
    } finally { await cleanup(ids); }
  });

  it("blocks daily YouTube quota without scheduling exponential retry", async () => {
    const ids = await fixture();
    try {
      const result = await runDiscoveryWorkerOnce("quota", { searchPage: async () => { throw new YouTubeQuotaExhaustedError(); } });
      const step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }); const progress = await getDiscoveryRunProgress(ids.runId);
      expect(result).toMatchObject({ blocked: true }); expect(step).toMatchObject({ status: "blocked_quota", lastErrorCode: "youtube_quota_exhausted", checkpoint: { pagesCompleted: 1, nextPageToken: "saved-token" }, lockedBy: null });
      expect(progress).toMatchObject({ status: "blocked", progress: { blockReason: "youtube_quota_exhausted", retry_wait: 0 } });
      expect(new Date(step!.availableAt).getTime()).toBeLessThanOrEqual(Date.now() + 1_000);
    } finally { await cleanup(ids); }
  });

  it("does not mutate a step when the worker reports a lost lease", async () => {
    const ids = await fixture();
    try {
      const result = await runDiscoveryWorkerOnce("lost-lease", { searchPage: async () => { throw new DiscoveryLeaseLostError(); } });
      const step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) });
      expect(result).toMatchObject({ ownershipLost: true });
      expect(step).toMatchObject({ status: "processing", lockedBy: "lost-lease", lastErrorCode: null, lastErrorMessage: null });
      expect(step?.lockExpiresAt).not.toBeNull();
    } finally { await cleanup(ids); }
  });

  it("stops retrying at max attempts", async () => {
    const ids = await fixture({ maxAttempts: 2 });
    try {
      const error = async () => { throw new YouTubeDiscoveryApiError({ status: 503 }); };
      await runDiscoveryWorkerOnce("max-one", { searchPage: error });
      let step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }); expect(step).toMatchObject({ status: "retry_wait", attemptCount: 1 });
      await db.update(discoveryRunSteps).set({ availableAt: "2000-01-01T00:00:00.000Z" }).where(eq(discoveryRunSteps.id, ids.stepId));
      await runDiscoveryWorkerOnce("max-two", { searchPage: error });
      step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepId) }); expect(step).toMatchObject({ status: "failed", attemptCount: 2, lastErrorCode: "upstream_5xx" });
      expect(step!.attemptCount).toBeLessThanOrEqual(step!.maxAttempts);
    } finally { await cleanup(ids); }
  });
});
