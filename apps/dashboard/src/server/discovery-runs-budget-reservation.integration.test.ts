import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import { discoveryRuns, discoveryRunSteps, nicheQueries, niches } from "@/shared/lib/schema";
import {
  createDiscoveryRun,
  getDiscoveryRunProgress,
  reserveDiscoveryPageBudget,
  runDiscoveryWorkerOnce,
} from "./discovery-runs";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
if (!/@(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) {
  throw new Error("discovery budget integration tests require a loopback Supabase database");
}

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function openWorkers() {
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  await Promise.all([clientA.connect(), clientB.connect()]);
  return { clientA, clientB, dbA: drizzle(clientA) as typeof db, dbB: drizzle(clientB) as typeof db };
}

async function fixture(requestBudget: number, requestsUsed = 0, steps = 1) {
  const suffix = randomUUID();
  const now = new Date().toISOString();
  const [{ id: nicheId }] = await db.insert(niches).values({ name: `budget niche ${suffix}`, slug: `budget-${suffix}`, updatedAt: now }).returning({ id: niches.id });
  const [{ id: queryId }] = await db.insert(nicheQueries).values({ nicheId, query: `budget query ${suffix}`, updatedAt: now }).returning({ id: nicheQueries.id });
  const [{ id: runId }] = await db.insert(discoveryRuns).values({ nicheId, status: "queued", searchOrders: ["relevance"], totalSteps: steps, requestBudget, externalRequestCount: requestsUsed, updatedAt: now }).returning({ id: discoveryRuns.id });
  const created = await db.insert(discoveryRunSteps).values(Array.from({ length: steps }, (_, index) => ({
    runId, stepKey: `search:${queryId}:relevance:${index}`, stepType: "search" as const, queryId,
    querySnapshot: { query: `budget query ${suffix}`, maxResults: 1 }, searchOrder: "relevance" as const,
    checkpoint: {}, resultCounters: {}, availableAt: "2000-01-01T00:00:00.000Z", updatedAt: now,
  }))).returning({ id: discoveryRunSteps.id });
  return { nicheId, queryId, runId, stepIds: created.map((step) => step.id) };
}

async function cleanup(ids: { nicheId: string; runId: string }) {
  await db.delete(discoveryRuns).where(eq(discoveryRuns.id, ids.runId));
  await db.delete(niches).where(eq(niches.id, ids.nicheId));
}

const emptyPage = async () => ({ items: [], nextPageToken: null, requestCount: 2, estimatedQuotaUnits: 0 });

describe("discovery page request-budget reservation", () => {
  afterAll(async () => { await getPgClient().end(); });

  it("atomically allows exactly one of two concurrent workers when budget is 2", async () => {
    const ids = await fixture(2, 0, 2); const { clientA, clientB, dbA, dbB } = await openWorkers();
    const gate = barrier(); let ready = 0; const calls: string[] = [];
    const execute = async (workerId: string, workerDb: typeof db) => {
      ready += 1; if (ready === 2) gate.release(); await gate.promise;
      return runDiscoveryWorkerOnce(workerId, { database: workerDb, searchPage: async () => { calls.push(workerId); return emptyPage(); } });
    };
    try {
      const [a, b] = await Promise.all([execute("worker-A", dbA), execute("worker-B", dbB)]);
      const run = await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) });
      const steps = await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.runId, ids.runId));
      const blocked = steps.filter((step) => step.status === "blocked_quota");
      expect([a, b].filter((result) => (result as { blocked?: boolean }).blocked)).toHaveLength(1);
      expect([a, b].filter((result) => !(result as { blocked?: boolean }).blocked && result.processed)).toHaveLength(1);
      expect(run?.externalRequestCount).toBe(2); expect(run?.externalRequestCount).not.toBe(4);
      expect(run!.requestBudget - run!.externalRequestCount).toBeGreaterThanOrEqual(0);
      expect(calls).toHaveLength(1); expect(blocked).toHaveLength(1);
      expect(blocked[0].lastErrorCode).toBe("quota_budget_exhausted");
      expect(new Date(blocked[0].availableAt).getTime()).toBeLessThan(Date.now() - 60_000);
      const progress = await getDiscoveryRunProgress(ids.runId);
      expect(progress).toMatchObject({ status: "blocked", progress: { requestBudget: 2, requestsUsed: 2, requestsRemaining: 0, blockReason: "quota_budget_exhausted" } });
      expect(progress?.progress).not.toHaveProperty("lockedBy"); expect(progress?.progress).not.toHaveProperty("reservation");
    } finally { await Promise.all([clientA.end(), clientB.end()]); await cleanup(ids); }
  });

  it("blocks an exhausted page before the adapter and leaves its checkpoint untouched", async () => {
    const ids = await fixture(2, 2); let calls = 0;
    try {
      const first = await runDiscoveryWorkerOnce("worker-zero", { searchPage: async () => { calls += 1; return emptyPage(); } });
      const step = await db.query.discoveryRunSteps.findFirst({ where: eq(discoveryRunSteps.id, ids.stepIds[0]) });
      const progress = await getDiscoveryRunProgress(ids.runId);
      expect(first).toMatchObject({ processed: true, blocked: true }); expect(calls).toBe(0);
      expect(step).toMatchObject({ status: "blocked_quota", lastErrorCode: "quota_budget_exhausted", checkpoint: {}, resultCounters: {} });
      expect((step?.checkpoint as { pagesCompleted?: number }).pagesCompleted ?? 0).toBe(0);
      expect(step?.externalRequestCount).toBe(0); expect(new Date(step!.availableAt).getTime()).toBeLessThan(Date.now() - 60_000);
      expect(progress).toMatchObject({ status: "blocked", progress: { requestBudget: 2, requestsUsed: 2, requestsRemaining: 0, blockReason: "quota_budget_exhausted", retry_wait: 0 } });
      await runDiscoveryWorkerOnce("worker-zero-retry", { searchPage: async () => { calls += 1; return emptyPage(); } });
      expect(calls).toBe(0);
    } finally { await cleanup(ids); }
  });

  it("permits exact exhaustion and rejects the next reservation", async () => {
    const ids = await fixture(4, 2); let calls = 0;
    try {
      await runDiscoveryWorkerOnce("worker-exact", { searchPage: async () => { calls += 1; return emptyPage(); } });
      expect((await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }))?.externalRequestCount).toBe(4);
      expect(calls).toBe(1);
      expect(await reserveDiscoveryPageBudget(db, ids.runId)).toBeUndefined();
      expect((await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }))?.externalRequestCount).toBe(4);
    } finally { await cleanup(ids); }
  });

  it("reserves all four units for two concurrent workers without loss or duplication", async () => {
    const ids = await fixture(4, 0, 2); const { clientA, clientB, dbA, dbB } = await openWorkers();
    const gate = barrier(); let ready = 0; const calls: string[] = [];
    const execute = async (workerId: string, workerDb: typeof db) => { ready += 1; if (ready === 2) gate.release(); await gate.promise; return runDiscoveryWorkerOnce(workerId, { database: workerDb, searchPage: async () => { calls.push(workerId); return emptyPage(); } }); };
    try {
      const results = await Promise.all([execute("worker-A", dbA), execute("worker-B", dbB)]);
      expect(results.every((result) => result.processed && !(result as { blocked?: boolean }).blocked)).toBe(true);
      expect((await db.query.discoveryRuns.findFirst({ where: eq(discoveryRuns.id, ids.runId) }))?.externalRequestCount).toBe(4);
      expect(calls.sort()).toEqual(["worker-A", "worker-B"]);
      expect(await reserveDiscoveryPageBudget(db, ids.runId)).toBeUndefined();
    } finally { await Promise.all([clientA.end(), clientB.end()]); await cleanup(ids); }
  });

  it("validates the server-side create-run request budget", async () => {
    const suffix = randomUUID(); const now = new Date().toISOString();
    const [{ id: nicheId }] = await db.insert(niches).values({ name: `validation niche ${suffix}`, slug: `validation-${suffix}`, updatedAt: now }).returning({ id: niches.id });
    await db.insert(nicheQueries).values({ nicheId, query: `validation query ${suffix}`, updatedAt: now });
    try {
      const defaultRun = await createDiscoveryRun({ nicheId });
      expect(defaultRun.requestBudget).toBe(50);
      await expect(createDiscoveryRun({ nicheId, requestBudget: -1 })).rejects.toThrow();
      await expect(createDiscoveryRun({ nicheId, requestBudget: 0 })).rejects.toThrow();
      await expect(createDiscoveryRun({ nicheId, requestBudget: 51 })).rejects.toThrow();
      for (const requestBudget of ["2", Number.NaN, 1.5, 2.1]) await expect(createDiscoveryRun({ nicheId, requestBudget })).rejects.toThrow();
      await expect(createDiscoveryRun({ nicheId, requestBudget: 51, clientRequestBudget: 2 })).rejects.toThrow();
      await db.delete(discoveryRuns).where(eq(discoveryRuns.nicheId, nicheId));
    } finally { await db.delete(discoveryRuns).where(eq(discoveryRuns.nicheId, nicheId)); await db.delete(niches).where(eq(niches.id, nicheId)); }
  });
});
