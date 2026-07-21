import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Client } from "pg";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  discoveryRuns,
  discoveryRunSteps,
  nicheQueries,
  niches,
} from "@/shared/lib/schema";
import { claimDiscoveryStep } from "./discovery-runs";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

if (!/@(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) {
  throw new Error("discovery concurrent claim integration tests require a loopback Supabase database");
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => { resolve = next; });
  return { promise, resolve };
}

async function openWorkers() {
  const [clientA, clientB] = [new Client({ connectionString: databaseUrl }), new Client({ connectionString: databaseUrl })];
  await Promise.all([clientA.connect(), clientB.connect()]);
  return {
    clientA,
    clientB,
    dbA: drizzle(clientA) as typeof db,
    dbB: drizzle(clientB) as typeof db,
  };
}

async function createRunnableSteps(stepCount: number) {
  const suffix = randomUUID();
  const now = new Date().toISOString();
  const [{ id: nicheId }] = await db.insert(niches).values({
    name: `concurrent claim niche ${suffix}`,
    slug: `concurrent-claim-${suffix}`,
    updatedAt: now,
  }).returning({ id: niches.id });
  const [{ id: queryId }] = await db.insert(nicheQueries).values({
    nicheId,
    query: `concurrent claim query ${suffix}`,
    updatedAt: now,
  }).returning({ id: nicheQueries.id });
  const [{ id: runId }] = await db.insert(discoveryRuns).values({
    nicheId,
    status: "running",
    searchOrders: ["relevance"],
    totalSteps: stepCount,
    requestBudget: 50,
    updatedAt: now,
  }).returning({ id: discoveryRuns.id });
  const steps = await db.insert(discoveryRunSteps).values(Array.from({ length: stepCount }, (_, index) => ({
    runId,
    stepKey: `search:${queryId}:relevance:${index}`,
    stepType: "search" as const,
    queryId,
    querySnapshot: { query: `concurrent claim query ${suffix}`, maxResults: 1, publishedAfter: null },
    searchOrder: "relevance" as const,
    checkpoint: {},
    resultCounters: {},
    availableAt: "2000-01-01T00:00:00.000Z",
    updatedAt: now,
  }))).returning({ id: discoveryRunSteps.id });

  return { nicheId, runId, stepIds: steps.map((step) => step.id) };
}

async function concurrentClaims(dbA: typeof db, dbB: typeof db) {
  const bothReady = deferred();
  const releaseClaims = deferred();
  let readyWorkers = 0;
  const claim = async (workerDb: typeof db, workerId: string) => {
    readyWorkers += 1;
    if (readyWorkers === 2) bothReady.resolve();
    await releaseClaims.promise;
    return claimDiscoveryStep(workerDb, workerId);
  };

  const workerA = claim(dbA, "worker-A");
  const workerB = claim(dbB, "worker-B");
  await bothReady.promise;
  releaseClaims.resolve();
  return Promise.all([workerA, workerB] as const);
}

describe("discovery concurrent step claim", () => {
  afterAll(async () => {
    await getPgClient().end();
  });

  it("leases one runnable step to exactly one of two concurrent workers", async () => {
    const { nicheId, runId, stepIds } = await createRunnableSteps(1);
    const { clientA, clientB, dbA, dbB } = await openWorkers();
    try {
      const [claimA, claimB] = await concurrentClaims(dbA, dbB);
      const successfulClaims = [claimA, claimB].filter(Boolean);
      const noWorkResults = [claimA, claimB].filter((claim) => !claim);
      const winner = claimA ? "worker-A" : "worker-B";
      const loser = claimA ? "worker-B" : "worker-A";

      expect(successfulClaims).toHaveLength(1);
      expect(noWorkResults).toHaveLength(1);
      expect(successfulClaims[0]?.id).toBe(stepIds[0]);

      const stepsAfterClaims = await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.runId, runId));
      expect(stepsAfterClaims).toHaveLength(1);
      expect(new Set(stepsAfterClaims.map((step) => step.id)).size).toBe(1);
      const [step] = stepsAfterClaims;
      expect(step.id).toBe(stepIds[0]);
      expect(step.status).toBe("processing");
      expect(step.lockedBy).toBe(winner);
      expect(step.attemptCount).toBe(1);
      expect(step.lockedAt).not.toBeNull();
      expect(step.lockExpiresAt).not.toBeNull();
      expect(new Date(step.lockExpiresAt ?? 0).getTime()).toBeGreaterThan(Date.now());
      expect([claimA, claimB].find((claim) => claim?.lockedBy === loser)).toBeUndefined();

      const originalLease = step.lockExpiresAt;
      const loserRetry = await claimDiscoveryStep(loser === "worker-A" ? dbA : dbB, loser);
      const winnerRetry = await claimDiscoveryStep(winner === "worker-A" ? dbA : dbB, winner);
      expect(loserRetry).toBeUndefined();
      expect(winnerRetry).toBeUndefined();

      const [afterRetries] = await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.id, stepIds[0]));
      expect(afterRetries.status).toBe("processing");
      expect(afterRetries.lockedBy).toBe(winner);
      expect(afterRetries.attemptCount).toBe(1);
      expect(afterRetries.lockExpiresAt).toBe(originalLease);
    } finally {
      await Promise.all([clientA.end(), clientB.end()]);
      await db.delete(discoveryRuns).where(eq(discoveryRuns.id, runId));
      await db.delete(niches).where(eq(niches.id, nicheId));
    }
  });

  it("expired processing step is reclaimed in one claim operation", async () => {
    const { nicheId, runId, stepIds } = await createRunnableSteps(1);
    const stepId = stepIds[0];
    const checkpoint = { pagesCompleted: 3, nextPageToken: "saved-token" };
    await db.update(discoveryRunSteps).set({
      status: "processing",
      lockedBy: "old-worker",
      lockedAt: new Date(Date.now() - 5_000).toISOString(),
      lockExpiresAt: new Date(Date.now() - 1_000).toISOString(),
      attemptCount: 1,
      checkpoint,
    }).where(eq(discoveryRunSteps.id, stepId));

    const { clientA, clientB, dbA, dbB } = await openWorkers();
    try {
      const [claimA, claimB] = await concurrentClaims(dbA, dbB);
      const claims = [claimA, claimB].filter(Boolean);
      const [step] = await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.id, stepId));

      expect(claims).toHaveLength(1);
      expect(claims[0]?.id).toBe(stepId);
      expect(["worker-A", "worker-B"]).toContain(claims[0]?.lockedBy);
      expect(step.status).toBe("processing");
      expect(step.lockedBy).toBe(claims[0]?.lockedBy);
      expect(step.attemptCount).toBe(2);
      expect(step.checkpoint).toEqual(checkpoint);
      expect(step.availableAt).not.toBeNull();
      expect(new Date(step.lockExpiresAt ?? 0).getTime()).toBeGreaterThan(Date.now());
    } finally {
      await Promise.all([clientA.end(), clientB.end()]);
      await db.delete(discoveryRuns).where(eq(discoveryRuns.id, runId));
      await db.delete(niches).where(eq(niches.id, nicheId));
    }
  });

  it("leases different runnable steps to two concurrent workers", async () => {
    const { nicheId, runId, stepIds } = await createRunnableSteps(2);
    const { clientA, clientB, dbA, dbB } = await openWorkers();
    try {
      const [claimA, claimB] = await concurrentClaims(dbA, dbB);
      const successfulClaims = [claimA, claimB].filter(Boolean);

      expect(successfulClaims).toHaveLength(2);
      expect(claimA?.id).not.toBe(claimB?.id);
      expect(new Set(successfulClaims.map((claim) => claim!.id)).size).toBe(2);
      expect(new Set(successfulClaims.map((claim) => claim!.lockedBy)).size).toBe(2);
      expect(successfulClaims.every((claim) => stepIds.includes(claim!.id))).toBe(true);
      expect(successfulClaims.every((claim) => claim!.attemptCount === 1)).toBe(true);

      const stepsAfterClaims = await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.runId, runId));
      expect(stepsAfterClaims).toHaveLength(2);
      expect(new Set(stepsAfterClaims.map((step) => step.id)).size).toBe(2);
      expect(stepsAfterClaims.every((step) => step.status === "processing")).toBe(true);
      expect(stepsAfterClaims.every((step) => step.attemptCount === 1)).toBe(true);
      expect(new Set(stepsAfterClaims.map((step) => step.lockedBy)).size).toBe(2);
      expect(stepsAfterClaims.every((step) => step.lockedBy === "worker-A" || step.lockedBy === "worker-B")).toBe(true);
    } finally {
      await Promise.all([clientA.end(), clientB.end()]);
      await db.delete(discoveryRuns).where(eq(discoveryRuns.id, runId));
      await db.delete(niches).where(eq(niches.id, nicheId));
    }
  });
});
