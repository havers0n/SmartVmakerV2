import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { scenariosSchema } from "@scrimspec/shared-types";
import { db } from "@/shared/lib/db";
import {
  approvedScenarioRevisions,
  currentApprovedScenarioRevisions,
  scenarioArtifacts,
} from "@/shared/lib/schema";
import { GenerationFoundationError } from "./generation-runs";

const approvalRequestSchema = z
  .object({
    scenarioArtifactId: z.string().uuid(),
    sourceCandidateIndex: z.number().int().min(0),
  })
  .strict();
const idempotencyKeySchema = z.string().trim().min(1).max(200);

export class ScenarioApprovalError extends Error {
  constructor(
    readonly code:
      | "IDEMPOTENCY_KEY_REUSED"
      | "SCENARIO_ARTIFACT_NOT_FOUND"
      | "SCENARIO_CANDIDATE_NOT_FOUND",
    readonly status: 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "ScenarioApprovalError";
  }
}

function fingerprint(runId: string, artifactId: string, index: number) {
  return createHash("sha256")
    .update(`${runId}:${artifactId}:${index}`)
    .digest("hex");
}

function publicRevision(row: typeof approvedScenarioRevisions.$inferSelect) {
  return {
    id: row.id,
    runId: row.runId,
    scenarioArtifactId: row.scenarioArtifactId,
    revisionNumber: row.revisionNumber,
    sourceCandidateIndex: row.sourceCandidateIndex,
    selectedCandidate: row.selectedCandidate,
    scenes: row.scenes,
    productionPlan: row.productionPlan,
    createdAt: row.createdAt,
  };
}

export async function approveScenarioCandidate(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
  input: unknown,
  idempotencyKeyInput: string,
) {
  const ownerId = z.string().uuid().parse(ownerIdInput);
  const projectId = z.string().uuid().parse(projectIdInput);
  const runId = z.string().uuid().parse(runIdInput);
  const request = approvalRequestSchema.parse(input);
  const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
  const requestFingerprint = fingerprint(
    runId,
    request.scenarioArtifactId,
    request.sourceCandidateIndex,
  );

  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql<{ id: string; status: string }>`
      SELECT run.id, project.status FROM generation_pipeline.generation_runs run
      JOIN generation_pipeline.video_projects project ON project.id = run.project_id
      WHERE run.id = ${runId} AND run.project_id = ${projectId} AND project.owner_id = ${ownerId}
      FOR UPDATE OF run
    `);
    const run = locked.rows[0];
    if (!run)
      throw new GenerationFoundationError(404, "Generation run not found");
    if (run.status === "archived")
      throw new GenerationFoundationError(
        409,
        "Archived video projects cannot approve scenarios",
      );

    const [existing] = await tx
      .select()
      .from(approvedScenarioRevisions)
      .where(
        and(
          eq(approvedScenarioRevisions.runId, runId),
          eq(approvedScenarioRevisions.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint)
        throw new ScenarioApprovalError(
          "IDEMPOTENCY_KEY_REUSED",
          409,
          "Idempotency key was already used for a different scenario approval",
        );
      return { revision: publicRevision(existing), idempotentReplay: true };
    }

    const [artifact] = await tx
      .select()
      .from(scenarioArtifacts)
      .where(
        and(
          eq(scenarioArtifacts.id, request.scenarioArtifactId),
          eq(scenarioArtifacts.runId, runId),
        ),
      )
      .limit(1);
    if (!artifact)
      throw new ScenarioApprovalError(
        "SCENARIO_ARTIFACT_NOT_FOUND",
        404,
        "Scenario artifact not found for this Run",
      );
    const parsed = scenariosSchema.safeParse(artifact.payload);
    if (!parsed.success)
      throw new GenerationFoundationError(
        409,
        "Stored scenario artifact failed validation",
      );
    const candidate = parsed.data[request.sourceCandidateIndex];
    if (!candidate)
      throw new ScenarioApprovalError(
        "SCENARIO_CANDIDATE_NOT_FOUND",
        404,
        "Scenario candidate not found in artifact",
      );

    const [last] = await tx
      .select({
        revisionNumber: sql<number>`coalesce(max(${approvedScenarioRevisions.revisionNumber}), 0)`,
      })
      .from(approvedScenarioRevisions)
      .where(eq(approvedScenarioRevisions.runId, runId));
    const [revision] = await tx
      .insert(approvedScenarioRevisions)
      .values({
        runId,
        scenarioArtifactId: artifact.id,
        revisionNumber: Number(last.revisionNumber) + 1,
        sourceCandidateIndex: request.sourceCandidateIndex,
        selectedCandidate: candidate,
        scenes: candidate.scenes,
        productionPlan: candidate.productionPlan ?? null,
        idempotencyKey,
        requestFingerprint,
      })
      .returning();
    await tx
      .insert(currentApprovedScenarioRevisions)
      .values({
        runId,
        revisionId: revision.id,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: currentApprovedScenarioRevisions.runId,
        set: { revisionId: revision.id, updatedAt: new Date().toISOString() },
      });
    return { revision: publicRevision(revision), idempotentReplay: false };
  });
}

export async function getCurrentApprovedScenarioRevision(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
) {
  const ownerId = z.string().uuid().parse(ownerIdInput);
  const projectId = z.string().uuid().parse(projectIdInput);
  const runId = z.string().uuid().parse(runIdInput);
  const rows = await db.execute(sql<
    typeof approvedScenarioRevisions.$inferSelect
  >`
    SELECT revision.* FROM generation_pipeline.current_approved_scenario_revisions current
    JOIN generation_pipeline.approved_scenario_revisions revision ON revision.id = current.revision_id AND revision.run_id = current.run_id
    JOIN generation_pipeline.generation_runs run ON run.id = current.run_id
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE current.run_id = ${runId} AND run.project_id = ${projectId} AND project.owner_id = ${ownerId}
  `);
  if (!rows.rows[0])
    throw new GenerationFoundationError(
      404,
      "Current approved scenario revision not found",
    );
  return publicRevision(
    rows.rows[0] as typeof approvedScenarioRevisions.$inferSelect,
  );
}
