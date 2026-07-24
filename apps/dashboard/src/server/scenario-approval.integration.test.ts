import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  approvedScenarioRevisions,
  currentApprovedScenarioRevisions,
  scenarioArtifacts,
  scenarioGenerationAttempts,
  videoProjects,
} from "@/shared/lib/schema";
import { createGenerationRun, createVideoProject } from "./generation-runs";
import { approveScenarioCandidate } from "./scenario-approval";

const owner = randomUUID();
const otherOwner = randomUUID();
const projects: string[] = [];
const candidates = [
  {
    title: "Candidate one",
    description: "A durable candidate",
    aesScore: 80,
    hookStrength: 70,
    emotionalCurve: ["tension"],
    scenes: [{ phase: "HOOK", duration: 8, description: "Start" }],
    productionPlan: {
      sceneCount: 1,
      sceneDurations: [8],
      cameraMovement: "static",
      framingChanges: false,
      cuts: false,
      slowMotion: false,
      previousFrameContinuity: true,
      persistentWreckage: false,
      vehicleEntryDirection: "top",
      obstaclePosition: "lower-middle",
    },
  },
  {
    title: "Candidate two",
    description: "Another candidate",
    aesScore: 81,
    hookStrength: 71,
    emotionalCurve: ["tension"],
    scenes: [{ phase: "HOOK", duration: 8, description: "Second" }],
    productionPlan: {
      sceneCount: 1,
      sceneDurations: [8],
      cameraMovement: "static",
      framingChanges: false,
      cuts: false,
      slowMotion: false,
      previousFrameContinuity: true,
      persistentWreckage: false,
      vehicleEntryDirection: "top",
      obstaclePosition: "lower-middle",
    },
  },
];
async function fixture() {
  const project = await createVideoProject(owner, {
    title: `Approval ${randomUUID()}`,
    idea: "Approval test",
  });
  projects.push(project.id);
  const run = await createGenerationRun(owner, project.id, {});
  const [attempt] = await db
    .insert(scenarioGenerationAttempts)
    .values({
      runId: run.id,
      attemptNumber: 1,
      status: "running",
      provider: "minimax",
      modelId: "minimax-m2",
      correlationId: randomUUID(),
      idempotencyKey: `attempt:${randomUUID()}`,
      startedAt: new Date().toISOString(),
    })
    .returning();
  const [artifact] = await db
    .insert(scenarioArtifacts)
    .values({
      runId: run.id,
      attemptId: attempt.id,
      payload: candidates,
      validationMetadata: {},
    })
    .returning();
  return { project, run, artifact };
}
afterEach(async () => {
  for (const id of projects.splice(0))
    await db.delete(videoProjects).where(eq(videoProjects.id, id));
});
afterAll(async () => {
  await getPgClient().end();
});
describe.sequential("scenario approval", () => {
  it("snapshots the requested artifact candidate, replays same request, and advances the current pointer", async () => {
    const { project, run, artifact } = await fixture();
    const first = await approveScenarioCandidate(
      owner,
      project.id,
      run.id,
      { scenarioArtifactId: artifact.id, sourceCandidateIndex: 0 },
      "approval:key-1",
    );
    const replay = await approveScenarioCandidate(
      owner,
      project.id,
      run.id,
      { scenarioArtifactId: artifact.id, sourceCandidateIndex: 0 },
      "approval:key-1",
    );
    const second = await approveScenarioCandidate(
      owner,
      project.id,
      run.id,
      { scenarioArtifactId: artifact.id, sourceCandidateIndex: 1 },
      "approval:key-2",
    );
    expect(first.revision).toMatchObject({
      revisionNumber: 1,
      selectedCandidate: candidates[0],
      scenes: candidates[0].scenes,
    });
    expect(replay).toMatchObject({
      idempotentReplay: true,
      revision: { id: first.revision.id },
    });
    expect(second.revision.revisionNumber).toBe(2);
    const [pointer] = await db
      .select()
      .from(currentApprovedScenarioRevisions)
      .where(eq(currentApprovedScenarioRevisions.runId, run.id));
    expect(pointer.revisionId).toBe(second.revision.id);
    await expect(
      approveScenarioCandidate(
        owner,
        project.id,
        run.id,
        { scenarioArtifactId: artifact.id, sourceCandidateIndex: 1 },
        "approval:key-1",
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", status: 409 });
  });
  it("enforces ownership, archived protection, immutable history, and cascade deletion", async () => {
    const { project, run, artifact } = await fixture();
    await expect(
      approveScenarioCandidate(
        otherOwner,
        project.id,
        run.id,
        { scenarioArtifactId: artifact.id, sourceCandidateIndex: 0 },
        "other",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await db
      .update(videoProjects)
      .set({ status: "archived" })
      .where(eq(videoProjects.id, project.id));
    await expect(
      approveScenarioCandidate(
        owner,
        project.id,
        run.id,
        { scenarioArtifactId: artifact.id, sourceCandidateIndex: 0 },
        "archived",
      ),
    ).rejects.toMatchObject({ status: 409 });
    await db
      .update(videoProjects)
      .set({ status: "active" })
      .where(eq(videoProjects.id, project.id));
    const approved = await approveScenarioCandidate(
      owner,
      project.id,
      run.id,
      { scenarioArtifactId: artifact.id, sourceCandidateIndex: 0 },
      "mutable",
    );
    await expect(
      db
        .update(approvedScenarioRevisions)
        .set({ revisionNumber: 9 })
        .where(eq(approvedScenarioRevisions.id, approved.revision.id)),
    ).rejects.toBeTruthy();
    await db.delete(videoProjects).where(eq(videoProjects.id, project.id));
    projects.splice(projects.indexOf(project.id), 1);
    expect(
      await db
        .select()
        .from(approvedScenarioRevisions)
        .where(eq(approvedScenarioRevisions.runId, run.id)),
    ).toHaveLength(0);
  });
  it("serializes concurrent approvals into revisions and one pointer", async () => {
    const { project, run, artifact } = await fixture();
    const results = await Promise.all(
      [0, 1].map((sourceCandidateIndex) =>
        approveScenarioCandidate(
          owner,
          project.id,
          run.id,
          { scenarioArtifactId: artifact.id, sourceCandidateIndex },
          `race:${sourceCandidateIndex}`,
        ),
      ),
    );
    expect(
      results.map((result) => result.revision.revisionNumber).sort(),
    ).toEqual([1, 2]);
    const pointer = await db
      .select()
      .from(currentApprovedScenarioRevisions)
      .where(eq(currentApprovedScenarioRevisions.runId, run.id));
    expect(pointer).toHaveLength(1);
  });
  it("coalesces concurrent retries with the same key and payload", async () => {
    const { project, run, artifact } = await fixture();
    const input = { scenarioArtifactId: artifact.id, sourceCandidateIndex: 0 };
    const [first, replay] = await Promise.all([
      approveScenarioCandidate(owner, project.id, run.id, input, "same-race"),
      approveScenarioCandidate(owner, project.id, run.id, input, "same-race"),
    ]);
    expect(first.revision.id).toBe(replay.revision.id);
    expect(
      await db
        .select()
        .from(approvedScenarioRevisions)
        .where(eq(approvedScenarioRevisions.runId, run.id)),
    ).toHaveLength(1);
  });
});
