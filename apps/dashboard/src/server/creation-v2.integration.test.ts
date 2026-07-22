import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { ScenarioGenerationError } from "@scrimspec/shared-types";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  contentFormats,
  generationProjects,
  generationRuns,
  scenarioArtifacts,
  scenarioGenerationAttempts,
  scenarioGenerationJobQueue,
  videoProjects,
} from "@/shared/lib/schema";
import {
  createContentFormat,
  createContentFormatSchema,
} from "./content-formats";
import {
  createGenerationRun,
  createVideoProject,
  getGenerationRun,
  updateVideoProject,
} from "./generation-runs";
import {
  getScenarioExecution,
  getValidatedScenarioArtifact,
} from "./scenario-execution";
import { processScenarioJob } from "../../../../packages/workers/src/scenario-worker";
import { POST as postProject } from "@/app/api/generation/video-projects/route";
import { POST as postRun } from "@/app/api/generation/video-projects/[project_id]/runs/route";
import { POST as postAttempt } from "@/app/api/generation/video-projects/[project_id]/runs/[run_id]/scenario-attempts/route";
import { GET as getRunRoute } from "@/app/api/generation/video-projects/[project_id]/runs/[run_id]/route";
import { GET as getArtifactRoute } from "@/app/api/generation/video-projects/[project_id]/runs/[run_id]/scenario-artifact/route";

const ownerA = randomUUID();
const ownerB = randomUUID();
const projectIds: string[] = [];
const formatIds: string[] = [];
const headers = (ownerId = ownerA) => ({
  "content-type": "application/json",
  "x-scrimspec-user-id": ownerId,
});
const request = (url: string, ownerId = ownerA, body?: unknown) =>
  new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: headers(ownerId),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const validScenario = {
  title: "Bridge escape",
  description: "A school bus escapes a collapsing suspension bridge.",
  aesScore: 91,
  hookStrength: 94,
  emotionalCurve: ["shock", "tension", "relief"],
  scenes: [
    {
      phase: "HOOK",
      duration: 4,
      description: "Reveal the bridge beginning to fail.",
    },
  ],
};

function projectPayload(formatId: string, submissionId: string) {
  return {
    clientSubmissionId: submissionId,
    title: "Creation Wizard V2 integration",
    idea: "A school bus crosses a collapsing suspension bridge.",
    contentFormatId: formatId,
    defaults: {
      formatInputs: {
        environment: "suspension bridge",
        vehicleCount: 8,
        intensity: "high",
      },
      production: {
        ratio: "9:16",
        targetDurationSeconds: 30,
        language: "en",
        platform: "youtube_shorts",
        audioMode: "music_and_voiceover",
      },
      models: {
        text: { provider: "minimax", modelId: "minimax-m2" },
        image: {
          provider: "google_gemini",
          modelId: "gemini-2.5-flash-image",
        },
        video: { provider: "minimax", modelId: "minimax-halu-video" },
      },
    },
  };
}

async function createActiveFormat() {
  const created = await createContentFormat({
    name: `AI crash simulation ${randomUUID()}`,
    description: "Vehicle escape simulations with escalating structural risk.",
    formatType: "short_form",
    exampleOutput: "A bus escapes seconds before the bridge collapses.",
    targetDurationMinSeconds: 20,
    targetDurationMaxSeconds: 40,
    inputSchema: {
      type: "object",
      properties: {
        environment: {
          type: "string",
          minLength: 3,
          default: "suspension bridge",
        },
        vehicleCount: { type: "integer", minimum: 1, maximum: 20, default: 8 },
        intensity: {
          type: "string",
          enum: ["low", "medium", "high"],
          default: "high",
        },
      },
      required: ["environment", "vehicleCount", "intensity"],
      additionalProperties: false,
    },
    productionDefaults: {
      ratio: "9:16",
      targetDurationSeconds: 30,
      language: "en",
      platform: "youtube_shorts",
      audioMode: "music_and_voiceover",
    },
    productionRules: ["Show the incident inside the first five seconds."],
  });
  formatIds.push(created.id);
  const [storedDraft] = await db
    .select()
    .from(contentFormats)
    .where(eq(contentFormats.id, created.id));
  expect(storedDraft).toMatchObject({
    status: "draft",
    inputSchema: expect.objectContaining({ type: "object" }),
    productionDefaults: expect.objectContaining({ ratio: "9:16" }),
    productionRules: ["Show the incident inside the first five seconds."],
  });
  await expect(
    createVideoProject(ownerA, projectPayload(created.id, "draft-format")),
  ).rejects.toMatchObject({ status: 409 });
  await db
    .update(contentFormats)
    .set({ status: "active" })
    .where(eq(contentFormats.id, created.id));
  return created.id;
}

async function postAttemptFor(projectId: string, runId: string, key: string) {
  return postAttempt(
    new Request(
      `http://local/api/generation/video-projects/${projectId}/runs/${runId}/scenario-attempts`,
      { method: "POST", headers: { ...headers(), "idempotency-key": key } },
    ),
    { params: { project_id: projectId, run_id: runId } },
  );
}

afterAll(async () => {
  for (const projectId of projectIds.reverse())
    await db.delete(videoProjects).where(eq(videoProjects.id, projectId));
  for (const formatId of formatIds.reverse())
    await db.delete(contentFormats).where(eq(contentFormats.id, formatId));
  await getPgClient().end();
});

const describeIntegration =
  process.env.CREATION_V2_INTEGRATION === "1"
    ? describe.sequential
    : describe.skip;

describeIntegration("Creation Wizard V2 PostgreSQL lifecycle", () => {
  it("rejects uncontrolled schemas, invalid defaults and undeclared inputs", async () => {
    expect(() =>
      createContentFormatSchema.parse({
        name: "Unsupported",
        inputSchema: {
          type: "object",
          properties: { payload: { type: "object" } },
          additionalProperties: false,
        },
      }),
    ).toThrow();
    expect(() =>
      createContentFormatSchema.parse({
        name: "Bad default",
        inputSchema: {
          type: "object",
          properties: {
            count: { type: "integer", minimum: 1, default: "many" },
          },
          additionalProperties: false,
        },
      }),
    ).toThrow();
    expect(() =>
      createContentFormatSchema.parse({
        name: "Unknown schema field",
        inputSchema: {
          type: "object",
          properties: { label: { type: "string", secretObject: {} } },
          additionalProperties: false,
        },
      }),
    ).toThrow();

    const formatId = await createActiveFormat();
    const invalidProject = await createVideoProject(ownerA, {
      ...projectPayload(formatId, `invalid-inputs:${randomUUID()}`),
      defaults: {
        ...projectPayload(formatId, "unused").defaults,
        formatInputs: {
          environment: "bridge",
          vehicleCount: 8,
          intensity: "high",
          undeclaredObject: "blocked",
        },
      },
    });
    projectIds.push(invalidProject.id);
    await expect(
      createGenerationRun(ownerA, invalidProject.id, {
        clientSubmissionId: "blocked-run",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("runs Project to Artifact, retries failures, restores through APIs and preserves Run 1", async () => {
    const formatId = await createActiveFormat();
    const legacyBefore = await db
      .select({ count: sql<number>`count(*)` })
      .from(generationProjects);
    const submissionId = `wizard:${randomUUID()}`;
    const payload = projectPayload(formatId, submissionId);
    const firstProjectResponse = await postProject(
      request("http://local/api/generation/video-projects", ownerA, payload),
    );
    const replayProjectResponse = await postProject(
      request("http://local/api/generation/video-projects", ownerA, payload),
    );
    const project = await firstProjectResponse.json();
    const projectReplay = await replayProjectResponse.json();
    projectIds.push(project.id);
    expect(projectReplay.id).toBe(project.id);
    expect(
      await db
        .select()
        .from(videoProjects)
        .where(eq(videoProjects.clientSubmissionId, submissionId)),
    ).toHaveLength(1);

    const runBody = { clientSubmissionId: submissionId, overrides: {} };
    const runResponse = await postRun(
      request(
        `http://local/api/generation/video-projects/${project.id}/runs`,
        ownerA,
        runBody,
      ),
      { params: { project_id: project.id } },
    );
    const runReplayResponse = await postRun(
      request(
        `http://local/api/generation/video-projects/${project.id}/runs`,
        ownerA,
        runBody,
      ),
      { params: { project_id: project.id } },
    );
    const run1 = await runResponse.json();
    expect((await runReplayResponse.json()).id).toBe(run1.id);
    expect(
      await db
        .select()
        .from(generationRuns)
        .where(eq(generationRuns.projectId, project.id)),
    ).toHaveLength(1);

    const attemptKey = `attempt:${submissionId}`;
    const attemptResponse = await postAttemptFor(
      project.id,
      run1.id,
      attemptKey,
    );
    const attemptReplayResponse = await postAttemptFor(
      project.id,
      run1.id,
      attemptKey,
    );
    expect(attemptResponse.status).toBe(202);
    expect(attemptReplayResponse.status).toBe(200);
    const attempt1 = (await attemptResponse.json()).attempt;
    expect((await attemptReplayResponse.json()).attempt.id).toBe(attempt1.id);

    await processScenarioJob(async () => ({
      scenarios: [validScenario],
      providerRequestId: "fake-success-1",
      finishReason: "stop",
      usage: { total_tokens: 100 },
      diagnostic: { payloadType: "string", payloadLength: 100 },
    }));
    const durableRunResponse = await getRunRoute(
      request(
        `http://local/api/generation/video-projects/${project.id}/runs/${run1.id}`,
      ),
      { params: { project_id: project.id, run_id: run1.id } },
    );
    const durableRun = await durableRunResponse.json();
    expect(durableRun.scenarioExecution.status).toBe("ready");
    const artifactResponse = await getArtifactRoute(
      request(
        `http://local/api/generation/video-projects/${project.id}/runs/${run1.id}/scenario-artifact`,
      ),
      { params: { project_id: project.id, run_id: run1.id } },
    );
    expect(artifactResponse.status).toBe(200);
    expect((await artifactResponse.json()).scenarios).toEqual([validScenario]);

    const frozenRun1 = await getGenerationRun(ownerA, project.id, run1.id);
    await updateVideoProject(ownerA, project.id, {
      idea: "A fire engine now crosses the bridge during the collapse.",
      defaults: {
        ...payload.defaults,
        production: {
          ...payload.defaults.production,
          targetDurationSeconds: 36,
        },
      },
    });
    const run2 = await createGenerationRun(ownerA, project.id, {
      clientSubmissionId: `new-settings:${randomUUID()}`,
    });
    expect(run2.runNumber).toBe(2);
    const storedRun1 = await getGenerationRun(ownerA, project.id, run1.id);
    expect(storedRun1.projectSnapshot).toEqual(frozenRun1.projectSnapshot);
    expect(storedRun1.inputSnapshot).toEqual(frozenRun1.inputSnapshot);
    expect((run2.inputSnapshot as any).production.targetDurationSeconds).toBe(
      36,
    );

    const failureRun = await createGenerationRun(ownerA, project.id, {
      clientSubmissionId: `failure:${randomUUID()}`,
    });
    const failedResponse = await postAttemptFor(
      project.id,
      failureRun.id,
      `failure-attempt:${randomUUID()}`,
    );
    expect(failedResponse.status).toBe(202);
    await processScenarioJob(async () => {
      throw new ScenarioGenerationError("SCENARIO_GENERATION_TRUNCATED", {
        finishReason: "length",
      });
    });
    let failedExecution = await getScenarioExecution(
      ownerA,
      project.id,
      failureRun.id,
    );
    expect(failedExecution.status).toBe("failed");
    const retryResponse = await postAttemptFor(
      project.id,
      failureRun.id,
      `retry:${randomUUID()}`,
    );
    expect((await retryResponse.json()).attempt.attemptNumber).toBe(2);
    await processScenarioJob(async () => ({
      scenarios: [validScenario],
      providerRequestId: "fake-success-2",
      finishReason: "stop",
      usage: { total_tokens: 100 },
      diagnostic: { payloadType: "string", payloadLength: 100 },
    }));
    failedExecution = await getScenarioExecution(
      ownerA,
      project.id,
      failureRun.id,
    );
    expect(failedExecution.status).toBe("ready");
    expect(
      (await getValidatedScenarioArtifact(ownerA, project.id, failureRun.id))
        .scenarios,
    ).toEqual([validScenario]);

    const corruptRun = await createGenerationRun(ownerA, project.id, {
      clientSubmissionId: `corrupt:${randomUUID()}`,
    });
    const corruptAttemptResponse = await postAttemptFor(
      project.id,
      corruptRun.id,
      `corrupt-attempt:${randomUUID()}`,
    );
    const corruptAttempt = (await corruptAttemptResponse.json()).attempt;
    const corruptNow = new Date().toISOString();
    await db
      .update(scenarioGenerationAttempts)
      .set({ status: "running", startedAt: corruptNow })
      .where(eq(scenarioGenerationAttempts.id, corruptAttempt.id));
    await db
      .update(scenarioGenerationJobQueue)
      .set({
        status: "processing",
        lockedAt: corruptNow,
        lockedBy: randomUUID(),
      })
      .where(eq(scenarioGenerationJobQueue.attemptId, corruptAttempt.id));
    await db.insert(scenarioArtifacts).values({
      runId: corruptRun.id,
      attemptId: corruptAttempt.id,
      artifactType: "scenario_candidates",
      schemaVersion: 1,
      payload: [{ title: "DB-valid array but invalid shared scenario" }],
      validationMetadata: { valid: true },
    });
    await db
      .update(scenarioGenerationAttempts)
      .set({ status: "succeeded", completedAt: corruptNow })
      .where(eq(scenarioGenerationAttempts.id, corruptAttempt.id));
    await db
      .update(scenarioGenerationJobQueue)
      .set({ status: "completed", completedAt: corruptNow })
      .where(eq(scenarioGenerationJobQueue.attemptId, corruptAttempt.id));
    const corruptResponse = await getArtifactRoute(
      request(
        `http://local/api/generation/video-projects/${project.id}/runs/${corruptRun.id}/scenario-artifact`,
      ),
      { params: { project_id: project.id, run_id: corruptRun.id } },
    );
    expect(corruptResponse.status).toBe(422);
    expect((await corruptResponse.json()).code).toBe(
      "SCENARIO_ARTIFACT_CORRUPTED",
    );

    const sameSubmissionOtherOwner = await createVideoProject(
      ownerB,
      projectPayload(formatId, submissionId),
    );
    projectIds.push(sameSubmissionOtherOwner.id);
    expect(sameSubmissionOtherOwner.id).not.toBe(project.id);
    const sameRunKeyOtherProject = await createGenerationRun(
      ownerB,
      sameSubmissionOtherOwner.id,
      { clientSubmissionId: submissionId },
    );
    expect(sameRunKeyOtherProject.id).not.toBe(run1.id);

    const constraints = await db.execute(sql`
      select conname
      from pg_constraint
      where conname in (
        'video_projects_owner_submission_unique',
        'generation_runs_project_submission_unique',
        'scenario_attempts_run_idempotency_unique'
      )
      order by conname
    `);
    expect(constraints.rows.map((row) => row.conname)).toEqual([
      "generation_runs_project_submission_unique",
      "scenario_attempts_run_idempotency_unique",
      "video_projects_owner_submission_unique",
    ]);
    const legacyAfter = await db
      .select({ count: sql<number>`count(*)` })
      .from(generationProjects);
    expect(Number(legacyAfter[0].count)).toBe(Number(legacyBefore[0].count));
  });
});
