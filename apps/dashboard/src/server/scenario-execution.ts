import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { scenariosSchema } from "@scrimspec/shared-types";
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
  | "failed"
  | "cancelled";

type AttemptState = { status: string; attemptNumber: number } | undefined;

export function deriveScenarioStageStatus(input: {
  hasArtifact: boolean;
  latestAttempt?: AttemptState;
}): ScenarioStageStatus {
  if (input.hasArtifact) return "ready";
  if (!input.latestAttempt) return "not_started";
  if (input.latestAttempt.status === "queued") return "queued";
  if (input.latestAttempt.status === "running") return "running";
  if (input.latestAttempt.status === "cancelled") return "cancelled";
  return "failed";
}

function publicAttempt<
  T extends {
    diagnosticPayload?: unknown;
    idempotencyKey?: unknown;
    validationResult?: unknown;
    usage?: unknown;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
>(attempt: T) {
  const {
    diagnosticPayload: _diagnostic,
    idempotencyKey: _idempotencyKey,
    validationResult: _validationResult,
    usage: _usage,
    errorCode,
    errorMessage: _internalErrorMessage,
    ...safe
  } = attempt;
  const publicMessages: Record<string, string> = {
    SCENARIO_GENERATION_TRUNCATED: "The model response was incomplete.",
    SCENARIO_GENERATION_JSON_PARSE_FAILED:
      "The model returned malformed scenario data.",
    SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED:
      "The generated scenarios did not pass validation.",
    SCENARIO_GENERATION_EMPTY: "The model returned no scenario candidates.",
    SCENARIO_PROVIDER_NOT_CONFIGURED:
      "The scenario provider is not configured.",
    SCENARIO_PROVIDER_CALL_FAILED: "The scenario provider request failed.",
    SCENARIO_FORMAT_ADHERENCE_FAILED:
      "The generated scenarios did not follow the Content Format rules.",
  };
  const details =
    _validationResult && typeof _validationResult === "object"
      ? (_validationResult as Record<string, unknown>).details
      : undefined;
  const rawIssues =
    details && typeof details === "object"
      ? (details as Record<string, unknown>).issues
      : undefined;
  const issues = Array.isArray(rawIssues)
    ? rawIssues
        .map((issue: unknown) => {
          const value =
            issue && typeof issue === "object"
              ? (issue as Record<string, unknown>)
              : {};
          return {
            code: typeof value.code === "string" ? value.code : "UNKNOWN",
            candidateIndex:
              typeof value.candidateIndex === "number"
                ? value.candidateIndex
                : undefined,
            sceneIndex:
              typeof value.sceneIndex === "number"
                ? value.sceneIndex
                : undefined,
          };
        })
        .slice(0, 50)
    : [];
  return {
    ...safe,
    errorCode,
    errorMessage: errorCode
      ? (publicMessages[errorCode] ?? "Scenario generation failed.")
      : null,
    formatIssues: issues,
  };
}

export class ScenarioArtifactReadError extends Error {
  readonly status: 422 | 404;
  constructor(
    readonly code:
      | "SCENARIO_ARTIFACT_NOT_FOUND"
      | "SCENARIO_ARTIFACT_CORRUPTED",
    message: string,
  ) {
    super(message);
    this.name = "ScenarioArtifactReadError";
    this.status = code === "SCENARIO_ARTIFACT_NOT_FOUND" ? 404 : 422;
  }
}

export async function getValidatedScenarioArtifact(
  ownerId: string,
  projectId: string,
  runId: string,
) {
  const run = await getGenerationRun(ownerId, projectId, runId);
  const [artifact] = await db
    .select({
      id: scenarioArtifacts.id,
      runId: scenarioArtifacts.runId,
      attemptId: scenarioArtifacts.attemptId,
      schemaVersion: scenarioArtifacts.schemaVersion,
      payload: scenarioArtifacts.payload,
      createdAt: scenarioArtifacts.createdAt,
    })
    .from(scenarioArtifacts)
    .where(eq(scenarioArtifacts.runId, run.id))
    .limit(1);
  if (!artifact) {
    throw new ScenarioArtifactReadError(
      "SCENARIO_ARTIFACT_NOT_FOUND",
      "Scenario artifact is not available yet",
    );
  }
  const parsed = scenariosSchema.safeParse(artifact.payload);
  if (!parsed.success) {
    throw new ScenarioArtifactReadError(
      "SCENARIO_ARTIFACT_CORRUPTED",
      "Stored scenario artifact failed validation",
    );
  }
  return {
    id: artifact.id,
    runId: artifact.runId,
    attemptId: artifact.attemptId,
    schemaVersion: artifact.schemaVersion,
    createdAt: artifact.createdAt,
    scenarios: parsed.data,
  };
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
    artifact: artifact
      ? {
          id: artifact.id,
          attemptId: artifact.attemptId,
          schemaVersion: artifact.schemaVersion,
          createdAt: artifact.createdAt,
        }
      : null,
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
