import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import type { Scenario } from "@scrimspec/shared-types";
import { db } from "@/shared/lib/db";
import {
  generationRuns,
  scenarioArtifacts,
  scenarioGenerationAttempts,
  scenarioGenerationJobQueue,
  videoProjects,
} from "@/shared/lib/schema";
import { createVideoProject } from "./generation-runs";
import {
  enqueueScenarioGenerationAttempt,
  getScenarioAttempt,
  getScenarioExecution,
} from "./scenario-execution";
import { processScenarioJob } from "../../../../packages/workers/src/scenario-worker";

const contractA = {
  version: 1,
  timing: {
    exactSceneCount: 4,
    sceneDurationSeconds: 8,
    totalDurationSeconds: 32,
  },
  camera: {
    movement: "static",
    angleDegrees: { min: 20, max: 25 },
    framingLocked: true,
    noCuts: true,
  },
  continuity: {
    usePreviousFinalFrame: true,
    persistentWreckage: true,
    vehicleEntryDirection: "top",
    obstaclePosition: "lower-middle",
  },
  forbidden: {
    slowMotion: true,
    fireExplosions: true,
    humans: true,
    gore: true,
    hud: true,
    watermarks: true,
    textOverlays: true,
  },
};
const candidate = (invalid = false): Scenario => ({
  title: "Top-entry obstacle collision",
  description: invalid
    ? "45 degrees above road, pull back slightly, then slow motion."
    : "Static 22 degree camera. Vehicles enter from the top into the lower-middle obstacle; previous final frame continues directly and wreckage remains.",
  aesScore: 88,
  hookStrength: 92,
  emotionalCurve: ["tension"],
  scenes: ["HOOK", "BUILD", "PAYOFF", "RESOLUTION"].map((phase) => ({
    phase,
    duration: 8,
    description: invalid
      ? "45 degrees; pull back slightly in slow motion."
      : "Static 22 degree view; previous final frame continues directly and wreckage remains.",
  })),
  productionPlan: {
    sceneCount: 4,
    sceneDurations: [8, 8, 8, 8],
    cameraMovement: "static" as const,
    cameraAngleDegrees: invalid ? 45 : 22,
    framingChanges: invalid,
    cuts: false,
    slowMotion: invalid,
    previousFrameContinuity: true,
    persistentWreckage: true,
    vehicleEntryDirection: "top",
    obstaclePosition: "lower-middle",
  },
});
const fakeResult = (scenarios: Scenario[]) => ({
  scenarios,
  providerRequestId: "fake-provider",
  finishReason: "stop",
  usage: { total_tokens: 1 },
  diagnostic: { rawProviderBody: "SENTINEL_PROVIDER_RAW_BODY" },
});

const ownerId = randomUUID();
const projectIds: string[] = [];

async function runWithAttemptableSnapshot(
  contentFormatSnapshot: unknown = null,
) {
  const project = await createVideoProject(ownerId, {
    title: `Scenario service ${randomUUID()}`,
    idea: "Isolated scenario attempt integration coverage.",
  });
  projectIds.push(project.id);
  const [run] = await db
    .insert(generationRuns)
    .values({
      projectId: project.id,
      runNumber: 1,
      status: "draft",
      stage: "scenario",
      inputSnapshot: {
        schemaVersion: 1,
        production: { targetDurationSeconds: 32 },
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
      promptSnapshot: { schemaVersion: 1, scenario: {} },
      contentFormatSnapshot,
    })
    .returning();
  return { project, run };
}

afterEach(async () => {
  for (const projectId of projectIds.splice(0))
    await db.delete(videoProjects).where(eq(videoProjects.id, projectId));
});
afterAll(async () => {
  await getPgClient().end();
});

describe.sequential("scenario execution service public boundary", () => {
  it("uses the retry idempotency key, leaves the failed attempt immutable, and exposes only safe diagnostics", async () => {
    const { project, run } = await runWithAttemptableSnapshot();
    const first = await enqueueScenarioGenerationAttempt(
      ownerId,
      project.id,
      run.id,
      "attempt-one",
    );
    const now = new Date().toISOString();
    await db
      .update(scenarioGenerationJobQueue)
      .set({ status: "processing", lockedAt: now, lockedBy: randomUUID() })
      .where(eq(scenarioGenerationJobQueue.attemptId, first.attempt.id));
    await db
      .update(scenarioGenerationAttempts)
      .set({ status: "running", startedAt: now })
      .where(eq(scenarioGenerationAttempts.id, first.attempt.id));
    await db
      .update(scenarioGenerationAttempts)
      .set({
        status: "failed",
        completedAt: now,
        errorCode: "SCENARIO_FORMAT_ADHERENCE_FAILED",
        errorMessage: "SENTINEL_STACK_TRACE SENTINEL_PROVIDER_RAW_BODY",
        validationResult: {
          valid: false,
          details: {
            issues: [
              {
                code: "CAMERA_ANGLE_OUT_OF_RANGE",
                candidateIndex: 0,
                sceneIndex: 2,
                rawProviderBody: "SENTINEL_PROVIDER_RAW_BODY",
                compiledPrompt: "SENTINEL_COMPILED_PROMPT",
              },
            ],
          },
        },
        diagnosticPayload: {
          rawProviderBody: "SENTINEL_PROVIDER_RAW_BODY",
          rawModelText: "SENTINEL_RAW_MODEL_TEXT",
          compiledSystemPrompt: "SENTINEL_COMPILED_PROMPT",
          apiKey: "SENTINEL_API_KEY",
          authorization: "SENTINEL_AUTHORIZATION",
          environment: "SENTINEL_ENVIRONMENT",
        },
      })
      .where(eq(scenarioGenerationAttempts.id, first.attempt.id));
    await db
      .update(scenarioGenerationJobQueue)
      .set({
        status: "failed",
        completedAt: now,
        lastError: "SENTINEL_STACK_TRACE",
      })
      .where(eq(scenarioGenerationJobQueue.attemptId, first.attempt.id));

    const publicFirst = await getScenarioAttempt(
      ownerId,
      project.id,
      run.id,
      first.attempt.id,
    );
    const serialized = JSON.stringify(publicFirst);
    expect(publicFirst).toMatchObject({
      status: "failed",
      errorCode: "SCENARIO_FORMAT_ADHERENCE_FAILED",
      errorMessage:
        "The generated scenarios did not follow the Content Format rules.",
      formatIssues: [
        { code: "CAMERA_ANGLE_OUT_OF_RANGE", candidateIndex: 0, sceneIndex: 2 },
      ],
    });
    for (const secret of [
      "SENTINEL_PROVIDER_RAW_BODY",
      "SENTINEL_RAW_MODEL_TEXT",
      "SENTINEL_COMPILED_PROMPT",
      "SENTINEL_API_KEY",
      "SENTINEL_AUTHORIZATION",
      "SENTINEL_ENVIRONMENT",
      "SENTINEL_STACK_TRACE",
    ])
      expect(serialized).not.toContain(secret);

    const runSnapshotBefore = (
      await db
        .select()
        .from(generationRuns)
        .where(eq(generationRuns.id, run.id))
    )[0];
    const retry = await enqueueScenarioGenerationAttempt(
      ownerId,
      project.id,
      run.id,
      "retry-key",
    );
    const replay = await enqueueScenarioGenerationAttempt(
      ownerId,
      project.id,
      run.id,
      "retry-key",
    );
    expect(retry).toMatchObject({
      idempotentReplay: false,
      attempt: { attemptNumber: 2 },
    });
    expect(replay).toMatchObject({
      idempotentReplay: true,
      attempt: { id: retry.attempt.id },
    });
    const attempts = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.runId, run.id));
    expect(attempts).toHaveLength(2);
    expect(
      attempts.find((attempt) => attempt.id === first.attempt.id),
    ).toMatchObject({ status: "failed" });
    const runSnapshotAfter = (
      await db
        .select()
        .from(generationRuns)
        .where(eq(generationRuns.id, run.id))
    )[0];
    expect(runSnapshotAfter).toMatchObject({
      inputSnapshot: runSnapshotBefore.inputSnapshot,
      projectSnapshot: runSnapshotBefore.projectSnapshot,
      contentFormatSnapshot: runSnapshotBefore.contentFormatSnapshot,
      modelSnapshot: runSnapshotBefore.modelSnapshot,
      promptSnapshot: runSnapshotBefore.promptSnapshot,
    });
    expect(
      await getScenarioExecution(ownerId, project.id, run.id),
    ).toMatchObject({ status: "queued" });
    expect(
      await db
        .select()
        .from(scenarioArtifacts)
        .where(eq(scenarioArtifacts.runId, run.id)),
    ).toHaveLength(0);
  });

  it("executes an invalid Attempt 1 then one idempotent compliant Retry Attempt 2", async () => {
    const { project, run } = await runWithAttemptableSnapshot({
      productionRules: contractA,
    });
    const originalSnapshot = (
      await db
        .select()
        .from(generationRuns)
        .where(eq(generationRuns.id, run.id))
    )[0].contentFormatSnapshot;
    const first = await enqueueScenarioGenerationAttempt(
      ownerId,
      project.id,
      run.id,
      "attempt-one-worker",
    );
    const calls: unknown[] = [];
    await processScenarioJob(async (job) => {
      calls.push(job);
      return fakeResult([candidate(true)]);
    });
    const [failed] = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.id, first.attempt.id));
    const attemptOneArtifacts = await db
      .select()
      .from(scenarioArtifacts)
      .where(eq(scenarioArtifacts.attemptId, first.attempt.id));
    expect(failed).toMatchObject({
      status: "failed",
      errorCode: "SCENARIO_FORMAT_ADHERENCE_FAILED",
    });
    expect(
      (failed.validationResult as any).details.issues.map(
        (issue: any) => issue.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "CAMERA_ANGLE_OUT_OF_RANGE",
        "SLOW_MOTION_FORBIDDEN",
      ]),
    );
    expect(attemptOneArtifacts).toHaveLength(0);
    expect(calls).toHaveLength(1);
    const retry = await enqueueScenarioGenerationAttempt(
      ownerId,
      project.id,
      run.id,
      "attempt-two-worker",
    );
    const replay = await enqueueScenarioGenerationAttempt(
      ownerId,
      project.id,
      run.id,
      "attempt-two-worker",
    );
    expect(replay).toMatchObject({
      idempotentReplay: true,
      attempt: { id: retry.attempt.id },
    });
    await processScenarioJob(async (job) => {
      calls.push(job);
      expect((job as any).retryFeedbackCodes).toEqual(
        expect.arrayContaining([
          "CAMERA_ANGLE_OUT_OF_RANGE",
          "SLOW_MOTION_FORBIDDEN",
        ]),
      );
      expect(JSON.stringify(job)).not.toContain("SENTINEL_PROVIDER_RAW_BODY");
      return fakeResult([candidate(false)]);
    });
    await processScenarioJob(async () => {
      throw new Error("terminal attempt must not invoke provider");
    });
    const attempts = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.runId, run.id));
    const artifacts = await db
      .select()
      .from(scenarioArtifacts)
      .where(eq(scenarioArtifacts.runId, run.id));
    const [job] = await db
      .select()
      .from(scenarioGenerationJobQueue)
      .where(eq(scenarioGenerationJobQueue.attemptId, retry.attempt.id));
    const storedRun = (
      await db
        .select()
        .from(generationRuns)
        .where(eq(generationRuns.id, run.id))
    )[0];
    expect(attempts).toHaveLength(2);
    expect(
      attempts.find((attempt) => attempt.id === first.attempt.id),
    ).toMatchObject({ status: "failed" });
    expect(
      attempts.find((attempt) => attempt.id === retry.attempt.id),
    ).toMatchObject({ status: "succeeded" });
    expect(artifacts).toHaveLength(1);
    expect(
      (artifacts[0].payload as any)[0].productionPlan.cameraAngleDegrees,
    ).toBe(22);
    expect(job.status).toBe("completed");
    expect(calls).toHaveLength(2);
    expect(storedRun.contentFormatSnapshot).toEqual(originalSnapshot);
  });
});
