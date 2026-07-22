import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  generationRuns,
  getDrizzleClient,
  getPgClient,
  scenarioArtifacts,
  scenarioGenerationAttempts,
  scenarioGenerationJobQueue,
  videoProjects,
} from "@scrimspec/db";
import { ScenarioGenerationError } from "@scrimspec/shared-types";
import { processScenarioJob, SCENARIO_WORKER_ID } from "../scenario-worker";

const db = getDrizzleClient();
const ownerId = randomUUID();
const projects: string[] = [];
const validScenario = {
  title: "Escalating crusher test",
  description: "Vehicles grow larger while the crusher remains unchanged.",
  aesScore: 88,
  hookStrength: 92,
  emotionalCurve: ["surprise", "tension", "relief"],
  scenes: [
    { phase: "HOOK", duration: 2, description: "Show the final impact first." },
  ],
};

async function queuedExecution() {
  const [project] = await db
    .insert(videoProjects)
    .values({
      ownerId,
      title: "Worker integration",
      idea: "Prove calls start after durable claim.",
    })
    .returning();
  projects.push(project.id);
  const snapshots = {
    inputSnapshot: {
      schemaVersion: 1,
      production: { ratio: "9:16", targetDurationSeconds: 20 },
      models: {},
    },
    projectSnapshot: {
      schemaVersion: 1,
      title: project.title,
      idea: project.idea,
    },
    modelSnapshot: {
      schemaVersion: 1,
      text: { provider: "minimax", modelId: "minimax-m2" },
    },
    promptSnapshot: {
      schemaVersion: 1,
      scenario: { compilerVersion: "scenario-prompt-compiler:v1" },
    },
  };
  const [run] = await db
    .insert(generationRuns)
    .values({
      projectId: project.id,
      runNumber: 1,
      status: "active",
      stage: "scenario",
      ...snapshots,
    })
    .returning();
  const [attempt] = await db
    .insert(scenarioGenerationAttempts)
    .values({
      runId: run.id,
      attemptNumber: 1,
      status: "queued",
      provider: "minimax",
      modelId: "minimax-m2",
      correlationId: randomUUID(),
      idempotencyKey: randomUUID(),
    })
    .returning();
  const [job] = await db
    .insert(scenarioGenerationJobQueue)
    .values({
      attemptId: attempt.id,
      eventKey: `scenario-attempt:${attempt.id}`,
      status: "queued",
    })
    .returning();
  return { project, run, attempt, job };
}

afterEach(async () => {
  for (const projectId of projects.splice(0)) {
    await db.delete(videoProjects).where(eq(videoProjects.id, projectId));
  }
});
afterAll(async () => {
  await getPgClient().end();
});

describe.sequential("durable scenario worker", () => {
  it("commits Run, Attempt, queue and running claim before the provider call", async () => {
    const durable = await queuedExecution();
    const provider = vi.fn(async () => {
      const [attempt] = await db
        .select()
        .from(scenarioGenerationAttempts)
        .where(eq(scenarioGenerationAttempts.id, durable.attempt.id));
      const [job] = await db
        .select()
        .from(scenarioGenerationJobQueue)
        .where(eq(scenarioGenerationJobQueue.id, durable.job.id));
      expect(attempt.status).toBe("running");
      expect(job.status).toBe("processing");
      expect(job.lockedBy).toBe(SCENARIO_WORKER_ID);
      return {
        scenarios: [validScenario],
        providerRequestId: "provider-request-1",
        finishReason: "stop",
        usage: { total_tokens: 123 },
        diagnostic: { payloadType: "string", payloadLength: 100 },
      };
    });
    expect(await processScenarioJob(provider)).toBe(true);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await processScenarioJob(provider)).toBe(false);
    expect(provider).toHaveBeenCalledTimes(1);
    const [attempt] = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.id, durable.attempt.id));
    const [job] = await db
      .select()
      .from(scenarioGenerationJobQueue)
      .where(eq(scenarioGenerationJobQueue.id, durable.job.id));
    const artifacts = await db
      .select()
      .from(scenarioArtifacts)
      .where(eq(scenarioArtifacts.runId, durable.run.id));
    expect(attempt).toMatchObject({
      status: "succeeded",
      providerRequestId: "provider-request-1",
    });
    expect(job.status).toBe("completed");
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].payload).toEqual([validScenario]);
  });

  it("turns truncated output into explicit failure and never creates an artifact", async () => {
    const durable = await queuedExecution();
    await processScenarioJob(async () => {
      throw new ScenarioGenerationError("SCENARIO_GENERATION_TRUNCATED", {
        finishReason: "length",
      });
    });
    const [attempt] = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.id, durable.attempt.id));
    const artifacts = await db
      .select()
      .from(scenarioArtifacts)
      .where(eq(scenarioArtifacts.runId, durable.run.id));
    expect(attempt).toMatchObject({
      status: "failed",
      errorCode: "SCENARIO_GENERATION_TRUNCATED",
    });
    expect(artifacts).toHaveLength(0);
  });
});
