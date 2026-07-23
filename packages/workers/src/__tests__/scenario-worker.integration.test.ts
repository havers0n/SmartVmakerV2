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
import {
  beamNgContract,
  compliantScenario,
  fakeSuccess,
  invalidScenario,
  missingPlanScenario,
} from "./scenario-fixtures";

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

async function queuedExecution(contentFormatSnapshot: unknown = null) {
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
    contentFormatSnapshot,
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

  it.each([
    [
      "invalid camera response",
      [invalidScenario()],
      ["CAMERA_ANGLE_OUT_OF_RANGE", "SLOW_MOTION_FORBIDDEN"],
    ],
    [
      "missing productionPlan response",
      [missingPlanScenario()],
      ["STRUCTURED_COMPLIANCE_MISSING"],
    ],
    [
      "mixed response",
      [compliantScenario(), invalidScenario()],
      ["CAMERA_ANGLE_OUT_OF_RANGE"],
    ],
  ])(
    "rejects a contracted %s before any artifact is inserted",
    async (_name, scenarios, expectedCodes) => {
      const durable = await queuedExecution({
        productionRules: beamNgContract,
      });
      const provider = vi.fn(async () => fakeSuccess(scenarios));
      expect(await processScenarioJob(provider)).toBe(true);
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
        status: "failed",
        errorCode: "SCENARIO_FORMAT_ADHERENCE_FAILED",
      });
      expect(
        ((attempt.validationResult as any).details.issues as any[]).map(
          (issue) => issue.code,
        ),
      ).toEqual(expect.arrayContaining(expectedCodes));
      expect(job.status).toBe("failed");
      expect(artifacts).toHaveLength(0);
      expect(await processScenarioJob(provider)).toBe(false);
      expect(provider).toHaveBeenCalledTimes(1);
    },
  );

  it("uses the immutable Run contract and supports legacy uncontracted artifacts", async () => {
    const contracted = await queuedExecution({
      productionRules: beamNgContract,
    });
    const legacy = await queuedExecution();
    const provider = vi
      .fn()
      .mockResolvedValueOnce(fakeSuccess([compliantScenario()]))
      .mockResolvedValueOnce(fakeSuccess([missingPlanScenario()]));
    expect(await processScenarioJob(provider)).toBe(true);
    expect(await processScenarioJob(provider)).toBe(true);
    expect(provider).toHaveBeenCalledTimes(2);
    const attempts = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.runId, contracted.run.id));
    const legacyAttempts = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.runId, legacy.run.id));
    expect(attempts[0].status).toBe("succeeded");
    expect(legacyAttempts[0].status).toBe("succeeded");
    const legacyArtifacts = await db
      .select()
      .from(scenarioArtifacts)
      .where(eq(scenarioArtifacts.runId, legacy.run.id));
    expect(
      (legacyArtifacts[0].payload as any)[0].productionPlan,
    ).toBeUndefined();
  });

  it("never calls the provider a second time after terminal success", async () => {
    const durable = await queuedExecution({ productionRules: beamNgContract });
    const provider = vi.fn(async () => fakeSuccess([compliantScenario()]));
    await processScenarioJob(provider);
    await processScenarioJob(provider);
    const artifacts = await db
      .select()
      .from(scenarioArtifacts)
      .where(eq(scenarioArtifacts.runId, durable.run.id));
    expect(provider).toHaveBeenCalledTimes(1);
    expect(artifacts).toHaveLength(1);
  });
});
