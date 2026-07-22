import dotenv from "dotenv";
import path from "path";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createLogger } from "@aec/logger";
import {
  getDrizzleClient,
  getPgClient,
  scenarioArtifacts,
  scenarioGenerationAttempts,
  scenarioGenerationJobQueue,
} from "@scrimspec/db";
import {
  createTextClient,
  generateScenariosWithTools,
  type TextGenerationResponse,
} from "@scrimspec/halu-client";
import {
  normalizeAndValidateScenarios,
  ScenarioGenerationError,
  type Scenario,
} from "@scrimspec/shared-types";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
const logger = createLogger({ name: "scenario-worker" });
const LEASE_TIMEOUT_MINUTES = 5;
const DIAGNOSTIC_FRAGMENT_LIMIT = 4_000;
export const SCENARIO_WORKER_ID = randomUUID();

type ClaimedScenarioJob = {
  jobId: string;
  attemptId: string;
  runId: string;
  provider: string;
  modelId: string;
  correlationId: string;
  inputSnapshot: unknown;
  projectSnapshot: unknown;
  contentFormatSnapshot: unknown;
  storyTemplateSnapshot: unknown;
  sourceSnapshot: unknown;
};

export type ScenarioProviderSuccess = {
  scenarios: Scenario[];
  providerRequestId: string | null;
  finishReason: string | null;
  usage: unknown;
  diagnostic: Record<string, unknown>;
};

class ProviderResultError extends Error {
  constructor(
    readonly causeError: unknown,
    readonly providerRequestId: string | null,
    readonly finishReason: string | null,
    readonly usage: unknown,
    readonly diagnostic: Record<string, unknown>,
  ) {
    super(
      causeError instanceof Error ? causeError.message : String(causeError),
    );
    this.name = "ProviderResultError";
  }
}

const scenarioTool: Parameters<typeof generateScenariosWithTools>[2][number] = {
  type: "function",
  function: {
    name: "generate_video_scenarios",
    description: "Generate validated short-form video scenario candidates",
    parameters: {
      type: "object",
      properties: {
        scenarios: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              aesScore: { type: "number" },
              hookStrength: { type: "number" },
              emotionalCurve: { type: "array", items: { type: "string" } },
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    phase: { type: "string" },
                    duration: { type: "number" },
                    description: { type: "string" },
                    cameraCommands: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["phase", "duration", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "title",
              "description",
              "aesScore",
              "hookStrength",
              "emotionalCurve",
              "scenes",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["scenarios"],
      additionalProperties: false,
    },
  },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function compileScenarioPrompt(
  job: Pick<
    ClaimedScenarioJob,
    | "inputSnapshot"
    | "projectSnapshot"
    | "contentFormatSnapshot"
    | "storyTemplateSnapshot"
    | "sourceSnapshot"
  >,
) {
  const input = record(job.inputSnapshot);
  const production = record(input.production);
  const formatInputs = record(input.formatInputs);
  const project = record(job.projectSnapshot);
  const format = record(job.contentFormatSnapshot);
  const template = record(job.storyTemplateSnapshot);
  const ratio =
    typeof production.ratio === "string" ? production.ratio : "9:16";
  const language =
    typeof production.language === "string" ? production.language : "none";
  const duration =
    typeof production.targetDurationSeconds === "number"
      ? production.targetDurationSeconds
      : 32;
  const systemMessage = [
    "You are an expert short-form video scriptwriter using the AES (Attention-Emotion-Solution) framework.",
    "Return only the generate_video_scenarios tool call.",
    "Every scene must be visual, specific, timed, and use no unknown fields.",
  ].join(" ");
  const prompt = [
    `Create 3-5 scenario candidates for a ${ratio} video with target duration ${duration} seconds.`,
    language !== "none"
      ? `Language: ${language}.`
      : "Use no spoken-language requirement.",
    `Project title: ${String(project.title ?? "Untitled")}`,
    `Creative brief: ${String(project.idea ?? "")}`,
    Object.keys(format).length
      ? `Content format snapshot: ${JSON.stringify(format)}`
      : "",
    Object.keys(formatInputs).length
      ? `Resolved format inputs: ${JSON.stringify(formatInputs)}`
      : "",
    Object.keys(template).length
      ? `Story template snapshot: ${JSON.stringify(template)}`
      : "",
    job.sourceSnapshot
      ? `Source snapshot: ${JSON.stringify(job.sourceSnapshot)}`
      : "",
    "Use HOOK, BUILD, PAYOFF, and RESOLUTION phases; include AES score, hook strength, emotional curve, and camera commands.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { systemMessage, prompt };
}

export function resolveScenarioProviderModelId(
  provider: string,
  catalogModelId: string,
) {
  if (provider === "minimax" && catalogModelId === "minimax-m2") {
    return "MiniMax-M2";
  }
  return catalogModelId;
}

function responseDiagnostic(
  response: TextGenerationResponse,
  rawArguments?: string,
) {
  return {
    format: "provider_tool_arguments_utf8_fragment",
    payloadType: rawArguments === undefined ? "missing" : "string",
    payloadLength: rawArguments?.length ?? 0,
    fragment: rawArguments?.slice(0, DIAGNOSTIC_FRAGMENT_LIMIT),
    fragmentTruncated: (rawArguments?.length ?? 0) > DIAGNOSTIC_FRAGMENT_LIMIT,
    toolCallCount: response.toolCalls?.length ?? 0,
  };
}

export async function callScenarioProvider(
  job: ClaimedScenarioJob,
): Promise<ScenarioProviderSuccess> {
  if (job.provider !== "minimax")
    throw new Error(`Unsupported scenario provider: ${job.provider}`);
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("MINIMAX_API_KEY is not configured");
  const client = createTextClient({
    apiKey,
    baseUrl: process.env.MINIMAX_API_BASE_URL,
  });
  const compiled = compileScenarioPrompt(job);
  const response = await generateScenariosWithTools(
    client,
    compiled.prompt,
    [scenarioTool],
    {
      model: resolveScenarioProviderModelId(job.provider, job.modelId),
      systemMessage: compiled.systemMessage,
      maxTokens: 4096,
      temperature: 0.85,
      toolChoice: {
        type: "function",
        function: { name: "generate_video_scenarios" },
      },
    },
  );
  const toolCall = response.toolCalls?.find(
    (call) => call.function.name === "generate_video_scenarios",
  );
  const diagnostic = responseDiagnostic(response, toolCall?.function.arguments);
  try {
    if (!toolCall?.function.argumentsParsed) {
      throw new ScenarioGenerationError(
        "SCENARIO_GENERATION_JSON_PARSE_FAILED",
        { rawPayloadLength: toolCall?.function.arguments.length ?? 0 },
      );
    }
    const rawValue = (
      toolCall.function.argumentsParsed as Record<string, unknown>
    ).scenarios;
    return {
      scenarios: normalizeAndValidateScenarios(rawValue, response.finishReason),
      providerRequestId: response.providerRequestId,
      finishReason: response.finishReason,
      usage: response.usage ?? null,
      diagnostic,
    };
  } catch (error) {
    throw new ProviderResultError(
      error,
      response.providerRequestId,
      response.finishReason,
      response.usage ?? null,
      diagnostic,
    );
  }
}

async function claimScenarioJob(): Promise<ClaimedScenarioJob | null> {
  const db = getDrizzleClient();
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql<Record<string, unknown>>`
      SELECT job.id AS job_id, attempt.id AS attempt_id, attempt.run_id,
             attempt.provider, attempt.model_id, attempt.correlation_id,
             run.input_snapshot, run.project_snapshot, run.content_format_snapshot,
             run.story_template_snapshot, run.source_snapshot
      FROM jobs.scenario_generation_job_queue job
      JOIN generation_pipeline.scenario_generation_attempts attempt ON attempt.id = job.attempt_id
      JOIN generation_pipeline.generation_runs run ON run.id = attempt.run_id
      WHERE job.status = 'queued' AND job.available_at <= now() AND attempt.status = 'queued'
      ORDER BY job.created_at LIMIT 1 FOR UPDATE OF job, attempt SKIP LOCKED
    `);
    const row = result.rows[0];
    if (!row) return null;
    const now = new Date().toISOString();
    await tx
      .update(scenarioGenerationJobQueue)
      .set({
        status: "processing",
        lockedAt: now,
        lockedBy: SCENARIO_WORKER_ID,
      })
      .where(eq(scenarioGenerationJobQueue.id, String(row.job_id)));
    await tx
      .update(scenarioGenerationAttempts)
      .set({ status: "running", startedAt: now })
      .where(eq(scenarioGenerationAttempts.id, String(row.attempt_id)));
    return {
      jobId: String(row.job_id),
      attemptId: String(row.attempt_id),
      runId: String(row.run_id),
      provider: String(row.provider),
      modelId: String(row.model_id),
      correlationId: String(row.correlation_id),
      inputSnapshot: row.input_snapshot,
      projectSnapshot: row.project_snapshot,
      contentFormatSnapshot: row.content_format_snapshot,
      storyTemplateSnapshot: row.story_template_snapshot,
      sourceSnapshot: row.source_snapshot,
    };
  });
}

function failureDetails(error: unknown) {
  const wrapped = error instanceof ProviderResultError ? error : null;
  const cause = wrapped?.causeError ?? error;
  const scenarioError = cause instanceof ScenarioGenerationError ? cause : null;
  const message = cause instanceof Error ? cause.message : String(cause);
  return {
    errorCode:
      scenarioError?.code ??
      (message.includes("MINIMAX_API_KEY")
        ? "SCENARIO_PROVIDER_NOT_CONFIGURED"
        : "SCENARIO_PROVIDER_CALL_FAILED"),
    errorMessage: message.slice(0, 10_000),
    providerRequestId: wrapped?.providerRequestId ?? null,
    finishReason: wrapped?.finishReason ?? null,
    usage: wrapped?.usage ?? null,
    validationResult: scenarioError
      ? {
          valid: false,
          issueCategories: scenarioError.issueCategories ?? [],
          details: scenarioError.details,
        }
      : null,
    diagnosticPayload: {
      ...(wrapped?.diagnostic ?? {
        format: "none",
        payloadType: "unavailable",
        payloadLength: 0,
      }),
      validationIssueCategories: scenarioError?.issueCategories ?? [],
    },
  };
}

export async function processScenarioJob(
  provider: (
    job: ClaimedScenarioJob,
  ) => Promise<ScenarioProviderSuccess> = callScenarioProvider,
) {
  const job = await claimScenarioJob();
  if (!job) return false;
  const db = getDrizzleClient();
  try {
    const result = await provider(job);
    const scenarios = normalizeAndValidateScenarios(
      result.scenarios,
      result.finishReason,
    );
    await db.transaction(async (tx) => {
      await tx.insert(scenarioArtifacts).values({
        runId: job.runId,
        attemptId: job.attemptId,
        artifactType: "scenario_candidates",
        schemaVersion: 1,
        payload: scenarios,
        validationMetadata: {
          valid: true,
          validator: "scenario-zod:v1",
          candidateCount: scenarios.length,
        },
      });
      const now = new Date().toISOString();
      await tx
        .update(scenarioGenerationAttempts)
        .set({
          status: "succeeded",
          providerRequestId: result.providerRequestId,
          finishReason: result.finishReason,
          usage: result.usage,
          validationResult: {
            valid: true,
            validator: "scenario-zod:v1",
            candidateCount: scenarios.length,
          },
          completedAt: now,
        })
        .where(eq(scenarioGenerationAttempts.id, job.attemptId));
      await tx
        .update(scenarioGenerationJobQueue)
        .set({ status: "completed", completedAt: now })
        .where(eq(scenarioGenerationJobQueue.id, job.jobId));
    });
    logger.info(
      {
        runId: job.runId,
        attemptId: job.attemptId,
        correlationId: job.correlationId,
        workerId: SCENARIO_WORKER_ID,
      },
      "Scenario artifact persisted",
    );
  } catch (error) {
    const failure = failureDetails(error);
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx
        .update(scenarioGenerationAttempts)
        .set({
          status: "failed",
          providerRequestId: failure.providerRequestId,
          finishReason: failure.finishReason,
          usage: failure.usage,
          validationResult: failure.validationResult,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          diagnosticPayload: failure.diagnosticPayload,
          completedAt: now,
        })
        .where(eq(scenarioGenerationAttempts.id, job.attemptId));
      await tx
        .update(scenarioGenerationJobQueue)
        .set({
          status: "failed",
          completedAt: now,
          lastError: failure.errorMessage,
        })
        .where(eq(scenarioGenerationJobQueue.id, job.jobId));
    });
    logger.error(
      {
        runId: job.runId,
        attemptId: job.attemptId,
        errorCode: failure.errorCode,
        workerId: SCENARIO_WORKER_ID,
      },
      "Scenario attempt failed",
    );
  }
  return true;
}

export async function expireStaleScenarioJobs() {
  const db = getDrizzleClient();
  const cutoff = new Date(
    Date.now() - LEASE_TIMEOUT_MINUTES * 60_000,
  ).toISOString();
  return db.transaction(async (tx) => {
    const rows = await tx.execute(sql<{ job_id: string; attempt_id: string }>`
      SELECT job.id AS job_id, job.attempt_id FROM jobs.scenario_generation_job_queue job
      WHERE job.status = 'processing' AND job.locked_at < ${cutoff} FOR UPDATE SKIP LOCKED
    `);
    const now = new Date().toISOString();
    for (const value of rows.rows) {
      const row = value as { job_id: string; attempt_id: string };
      await tx
        .update(scenarioGenerationAttempts)
        .set({
          status: "failed",
          errorCode: "SCENARIO_WORKER_LEASE_EXPIRED",
          errorMessage:
            "Worker lease expired; the event will not be replayed because provider submission is ambiguous.",
          diagnosticPayload: {
            format: "none",
            payloadType: "unavailable",
            payloadLength: 0,
          },
          completedAt: now,
        })
        .where(eq(scenarioGenerationAttempts.id, row.attempt_id));
      await tx
        .update(scenarioGenerationJobQueue)
        .set({
          status: "failed",
          completedAt: now,
          lastError: "Worker lease expired without replay",
        })
        .where(eq(scenarioGenerationJobQueue.id, row.job_id));
    }
    return rows.rows.length;
  });
}

let shutdownRequested = false;

function requestShutdown(signal: NodeJS.Signals) {
  shutdownRequested = true;
  logger.info(
    { signal, workerId: SCENARIO_WORKER_ID },
    "Scenario worker shutdown requested; finishing the current claim",
  );
}

async function main() {
  process.once("SIGTERM", () => requestShutdown("SIGTERM"));
  process.once("SIGINT", () => requestShutdown("SIGINT"));
  logger.info(
    { workerId: SCENARIO_WORKER_ID },
    "Starting durable Scenario Worker",
  );
  while (!shutdownRequested) {
    try {
      await expireStaleScenarioJobs();
      const processed = await processScenarioJob();
      await new Promise((resolve) =>
        setTimeout(resolve, processed ? 250 : 2_000),
      );
    } catch (error) {
      logger.error({ err: error }, "Scenario worker loop failed");
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  await getPgClient().end();
  logger.info(
    { workerId: SCENARIO_WORKER_ID },
    "Scenario worker stopped cleanly",
  );
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    logger.fatal(
      { err: error, workerId: SCENARIO_WORKER_ID },
      "Scenario worker terminated",
    );
    process.exitCode = 1;
  });
}
