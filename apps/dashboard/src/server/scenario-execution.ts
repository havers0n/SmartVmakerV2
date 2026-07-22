import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import {
  generationRuns,
  scenarioArtifacts,
  scenarioGenerationAttempts,
  scenarioGenerationJobQueue,
} from "@/shared/lib/schema";
import {
  GenerationFoundationError,
  getGenerationRun,
  modelReferenceSchema,
} from "./generation-runs";

const idempotencyKeySchema = z.string().trim().min(1).max(200);

export type ScenarioStageStatus =
  | "not_started"
  | "queued"
  | "running"
  | "ready"
  | "failed";

type AttemptState = { status: string; attemptNumber: number } | undefined;

export function deriveScenarioStageStatus(input: {
  hasArtifact: boolean;
  latestAttempt?: AttemptState;
}): ScenarioStageStatus {
  if (input.hasArtifact) return "ready";
  if (!input.latestAttempt) return "not_started";
  if (input.latestAttempt.status === "queued") return "queued";
  if (input.latestAttempt.status === "running") return "running";
  return "failed";
}

function publicAttempt<T extends { diagnosticPayload?: unknown }>(attempt: T) {
  const { diagnosticPayload: _serverOnly, ...safe } = attempt;
  return safe;
}

export async function getScenarioAttempt(
  ownerId: string,
  projectId: string,
  runId: string,
  attemptIdInput: string,
) {
  const run = await getGenerationRun(ownerId, projectId, runId);
  const attemptId = z.string().uuid().parse(attemptIdInput);
  const [attempt] = await db
    .select()
    .from(scenarioGenerationAttempts)
    .where(
      and(
        eq(scenarioGenerationAttempts.id, attemptId),
        eq(scenarioGenerationAttempts.runId, run.id),
      ),
    )
    .limit(1);
  if (!attempt) {
    throw new GenerationFoundationError(404, "Scenario attempt not found");
  }
  return publicAttempt(attempt);
}

export async function getScenarioExecution(
  ownerId: string,
  projectId: string,
  runId: string,
) {
  const run = await getGenerationRun(ownerId, projectId, runId);
  const attempts = await db
    .select()
    .from(scenarioGenerationAttempts)
    .where(eq(scenarioGenerationAttempts.runId, run.id))
    .orderBy(desc(scenarioGenerationAttempts.attemptNumber));
  const [artifact] = await db
    .select()
    .from(scenarioArtifacts)
    .where(eq(scenarioArtifacts.runId, run.id))
    .limit(1);
  return {
    stage: "scenario" as const,
    status: deriveScenarioStageStatus({
      hasArtifact: Boolean(artifact),
      latestAttempt: attempts[0],
    }),
    latestAttempt: attempts[0] ? publicAttempt(attempts[0]) : null,
    attempts: attempts.map(publicAttempt),
    artifact: artifact ?? null,
  };
}

export async function enqueueScenarioGenerationAttempt(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
  idempotencyKeyInput: string,
) {
  const ownerId = z.string().uuid().parse(ownerIdInput);
  const projectId = z.string().uuid().parse(projectIdInput);
  const runId = z.string().uuid().parse(runIdInput);
  const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);

  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql<{
      id: string;
      status: string;
      stage: string;
      model_snapshot: unknown;
      started_at: string | null;
    }>`
      SELECT run.id, run.status, run.stage, run.model_snapshot, run.started_at
      FROM generation_pipeline.generation_runs run
      JOIN generation_pipeline.video_projects project ON project.id = run.project_id
      WHERE run.id = ${runId} AND run.project_id = ${projectId} AND project.owner_id = ${ownerId}
      FOR UPDATE OF run
    `);
    const run = locked.rows[0] as
      | {
          id: string;
          status: string;
          stage: string;
          model_snapshot: unknown;
          started_at: string | null;
        }
      | undefined;
    if (!run)
      throw new GenerationFoundationError(404, "Generation run not found");

    const [existing] = await tx
      .select()
      .from(scenarioGenerationAttempts)
      .where(
        and(
          eq(scenarioGenerationAttempts.runId, runId),
          eq(scenarioGenerationAttempts.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existing)
      return { attempt: publicAttempt(existing), idempotentReplay: true };

    if (run.stage !== "scenario") {
      throw new GenerationFoundationError(
        409,
        "Run is no longer at the scenario stage",
      );
    }
    if (!["draft", "active"].includes(run.status)) {
      throw new GenerationFoundationError(
        409,
        `Run status ${run.status} cannot enqueue scenario generation`,
      );
    }

    const [artifact] = await tx
      .select({ id: scenarioArtifacts.id })
      .from(scenarioArtifacts)
      .where(eq(scenarioArtifacts.runId, runId))
      .limit(1);
    if (artifact)
      throw new GenerationFoundationError(
        409,
        "Scenario artifact already exists",
      );

    const [latest] = await tx
      .select({
        attemptNumber: scenarioGenerationAttempts.attemptNumber,
        status: scenarioGenerationAttempts.status,
      })
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.runId, runId))
      .orderBy(desc(scenarioGenerationAttempts.attemptNumber))
      .limit(1);
    if (latest && ["queued", "running"].includes(latest.status)) {
      throw new GenerationFoundationError(
        409,
        "Scenario generation is already in progress",
      );
    }
    if (latest?.status === "succeeded") {
      throw new GenerationFoundationError(
        409,
        "Scenario generation already succeeded",
      );
    }

    const modelSnapshot = z
      .object({ text: modelReferenceSchema })
      .passthrough()
      .parse(run.model_snapshot);
    if (modelSnapshot.text.provider !== "minimax") {
      throw new GenerationFoundationError(
        409,
        `Scenario provider ${modelSnapshot.text.provider} is not supported by this worker`,
      );
    }

    const [attempt] = await tx
      .insert(scenarioGenerationAttempts)
      .values({
        runId,
        attemptNumber: (latest?.attemptNumber ?? 0) + 1,
        status: "queued",
        provider: modelSnapshot.text.provider,
        modelId: modelSnapshot.text.modelId,
        correlationId: randomUUID(),
        idempotencyKey,
      })
      .returning();

    await tx.insert(scenarioGenerationJobQueue).values({
      attemptId: attempt.id,
      eventKey: `scenario-attempt:${attempt.id}`,
      status: "queued",
    });

    await tx
      .update(generationRuns)
      .set({
        status: "active",
        startedAt: run.started_at ?? new Date().toISOString(),
        completedAt: null,
        failedStage: null,
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(generationRuns.id, runId));

    return { attempt: publicAttempt(attempt), idempotentReplay: false };
  });
}
