import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { enqueueImageGenerationInputSchema } from "@scrimspec/shared-types";
import { compileKeyframePrompt } from "@scrimspec/hwar-core";
import { db } from "@/shared/lib/db";
import {
  approvedScenarioRevisions,
  currentApprovedScenarioRevisions,
  imageAttempts,
  imageArtifacts,
  imageGenerationJobQueue,
  imageGenerationRequests,
  scenePlans,
} from "@/shared/lib/schema";
import { GenerationFoundationError } from "./generation-runs";

const idempotencyKeySchema = z.string().trim().min(1).max(200);

const PROMPT_COMPILER_VERSION = "keyframe-prompt-compiler:v1";
const SETTINGS_VERSION = "1";

const SUPPORTED_IMAGE_PROVIDERS = [
  "gemini",
  "google_gemini",
  "minimax",
] as const;

export class ImageGenerationError extends Error {
  constructor(
    readonly code:
      | "IDEMPOTENCY_KEY_REUSED"
      | "APPROVED_REVISION_NOT_FOUND"
      | "APPROVED_REVISION_NOT_CURRENT"
      | "TARGET_SCENE_INDEX_OUT_OF_RANGE"
      | "TARGET_FRAME_ROLE_NOT_ALLOWED"
      | "ATTEMPT_NOT_FAILED"
      | "NO_FAILED_ATTEMPTS"
      | "IMAGE_PROVIDER_MISSING"
      | "IMAGE_MODEL_MISSING"
      | "IMAGE_PROVIDER_UNSUPPORTED",
    readonly status: 404 | 409 | 400,
    message: string,
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

function computeFingerprint(input: {
  runId: string;
  approvedRevisionId: string;
  scenePlanId: string;
  targets: Array<{ sceneIndex: number; frameRole: "first" | "last" }>;
  provider: string;
  modelId: string;
  modelCatalogRevision: string | null;
  settings: Record<string, unknown>;
  promptCompilerVersion: string;
}): string {
  const canonical = JSON.stringify({
    runId: input.runId,
    approvedRevisionId: input.approvedRevisionId,
    scenePlanId: input.scenePlanId,
    targets: input.targets,
    provider: input.provider,
    modelId: input.modelId,
    modelCatalogRevision: input.modelCatalogRevision,
    settings: input.settings,
    promptCompilerVersion: input.promptCompilerVersion,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function publicRequest(row: typeof imageGenerationRequests.$inferSelect) {
  return {
    id: row.id,
    runId: row.runId,
    scenePlanId: row.scenePlanId,
    targets: row.targets as Array<{
      sceneIndex: number;
      frameRole: "first" | "last";
    }>,
    provider: row.provider,
    modelId: row.modelId,
    modelCatalogRevision: row.modelCatalogRevision,
    settings: row.settings as Record<string, unknown>,
    createdAt: row.createdAt,
  };
}

function publicAttempt(row: typeof imageAttempts.$inferSelect) {
  return {
    id: row.id,
    runId: row.runId,
    requestId: row.requestId,
    scenePlanId: row.scenePlanId,
    sceneIndex: row.sceneIndex,
    frameRole: row.frameRole as "first" | "last",
    attemptNumber: row.attemptNumber,
    status: row.status as "queued" | "running" | "succeeded" | "failed",
    prompt: row.prompt,
    provider: row.provider,
    modelId: row.modelId,
    failureCode: row.failureCode,
    failureSummary: row.failureSummary,
    queuedAt: row.queuedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

async function getOrCreateScenePlan(
  tx: any,
  runId: string,
  revisionId: string,
  scenes: unknown,
  productionPlan: unknown,
) {
  const [existing] = await tx
    .select()
    .from(scenePlans)
    .where(
      and(eq(scenePlans.runId, runId), eq(scenePlans.revisionId, revisionId)),
    )
    .limit(1);
  if (existing) return existing;

  const [plan] = await tx
    .insert(scenePlans)
    .values({
      runId,
      revisionId,
      scenes,
      productionPlan: productionPlan ?? null,
      requiredFrames: ["first", "last"],
      createdAt: new Date().toISOString(),
    })
    .returning();
  return plan;
}

export async function enqueueImageGeneration(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
  input: unknown,
  idempotencyKeyInput: string,
) {
  const ownerId = z.string().uuid().parse(ownerIdInput);
  const projectId = z.string().uuid().parse(projectIdInput);
  const runId = z.string().uuid().parse(runIdInput);
  const body = enqueueImageGenerationInputSchema.parse(input);
  const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);

  const result = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql<{
      id: string;
      status: string;
      input_snapshot: any;
    }>`
      SELECT run.id, run.input_snapshot, project.status
      FROM generation_pipeline.generation_runs run
      JOIN generation_pipeline.video_projects project ON project.id = run.project_id
      WHERE run.id = ${runId} AND run.project_id = ${projectId} AND project.owner_id = ${ownerId}
      FOR UPDATE OF run
    `);
    const runRow = locked.rows[0];
    if (!runRow)
      throw new GenerationFoundationError(404, "Generation run not found");
    if (runRow.status === "archived")
      throw new GenerationFoundationError(
        409,
        "Archived video projects cannot generate images",
      );

    const [current] = await tx
      .select()
      .from(currentApprovedScenarioRevisions)
      .where(eq(currentApprovedScenarioRevisions.runId, runId))
      .limit(1);
    if (!current)
      throw new ImageGenerationError(
        "APPROVED_REVISION_NOT_FOUND",
        404,
        "No approved scenario revision exists for this Run",
      );

    const [revision] = await tx
      .select()
      .from(approvedScenarioRevisions)
      .where(
        and(
          eq(approvedScenarioRevisions.id, body.approvedRevisionId),
          eq(approvedScenarioRevisions.runId, runId),
        ),
      )
      .limit(1);
    if (!revision)
      throw new ImageGenerationError(
        "APPROVED_REVISION_NOT_FOUND",
        404,
        "Approved revision not found for this Run",
      );

    if (revision.id !== current.revisionId) {
      throw new ImageGenerationError(
        "APPROVED_REVISION_NOT_CURRENT",
        409,
        "The approved revision is no longer the current revision for this Run",
      );
    }

    const scenes = revision.scenes as any[];
    const productionPlan = revision.productionPlan as any;

    const plan = await getOrCreateScenePlan(
      tx,
      runId,
      revision.id,
      scenes,
      productionPlan,
    );

    const allRequired = plan.requiredFrames as string[];
    const targets = body.targets
      ? normalizeTargets(body.targets, scenes.length, allRequired)
      : defaultTargets(scenes.length, allRequired);

    const modelSnapshot = (runRow.input_snapshot as any)?.models;
    const provider = modelSnapshot?.image?.provider;
    const modelId = modelSnapshot?.image?.modelId;
    const modelCatalogRevision = null;

    if (!provider) {
      throw new ImageGenerationError(
        "IMAGE_PROVIDER_MISSING",
        400,
        "Image provider is not configured for this Run",
      );
    }
    if (!modelId) {
      throw new ImageGenerationError(
        "IMAGE_MODEL_MISSING",
        400,
        "Image modelId is not configured for this Run",
      );
    }
    if (provider === "unknown") {
      throw new ImageGenerationError(
        "IMAGE_PROVIDER_MISSING",
        400,
        "Image provider has not been selected for this Run",
      );
    }
    if (modelId === "unknown") {
      throw new ImageGenerationError(
        "IMAGE_MODEL_MISSING",
        400,
        "Image modelId has not been selected for this Run",
      );
    }
    if (!(SUPPORTED_IMAGE_PROVIDERS as readonly string[]).includes(provider)) {
      throw new ImageGenerationError(
        "IMAGE_PROVIDER_UNSUPPORTED",
        400,
        `Image provider "${provider}" is not supported for production generation`,
      );
    }

    const inputSnapshot = runRow.input_snapshot as any;
    const production = inputSnapshot?.production ?? {};
    const aspectRatio = production?.ratio ?? "16:9";

    const settings = {
      schemaVersion: SETTINGS_VERSION,
      aspectRatio,
      negativePrompt:
        "no text, no captions, no subtitles, no watermarks, no titles, no interface elements, no logos, no numbers on the image, no graphic overlays",
      style:
        "Ultra realistic, cinematic still frame, 8k, shallow depth of field, natural lighting.",
      promptCompilerVersion: PROMPT_COMPILER_VERSION,
    };

    const fingerprint = computeFingerprint({
      runId,
      approvedRevisionId: revision.id,
      scenePlanId: plan.id,
      targets,
      provider,
      modelId,
      modelCatalogRevision,
      settings,
      promptCompilerVersion: PROMPT_COMPILER_VERSION,
    });

    const [existingFp] = await tx
      .select()
      .from(imageGenerationRequests)
      .where(
        and(
          eq(imageGenerationRequests.runId, runId),
          eq(imageGenerationRequests.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existingFp) {
      if (existingFp.requestFingerprint !== fingerprint) {
        throw new ImageGenerationError(
          "IDEMPOTENCY_KEY_REUSED",
          409,
          "Idempotency key was already used for a different image generation request",
        );
      }
      const existingAttempts = await tx
        .select()
        .from(imageAttempts)
        .where(eq(imageAttempts.requestId, existingFp.id));

      return {
        request: publicRequest(existingFp),
        attempts: existingAttempts.map((a: any) => ({
          ...publicAttempt(a),
          artifact: null as any,
        })),
        idempotentReplay: true,
      };
    }

    const [request] = await tx
      .insert(imageGenerationRequests)
      .values({
        runId,
        scenePlanId: plan.id,
        idempotencyKey,
        requestFingerprint: fingerprint,
        targets,
        provider,
        modelId,
        modelCatalogRevision,
        settings,
        createdAt: new Date().toISOString(),
      })
      .returning();

    const insertedAttempts: any[] = [];

    for (const target of targets) {
      const [maxRow] = await tx
        .select({
          maxNum: sql<number>`COALESCE(MAX(${imageAttempts.attemptNumber}), 0)`,
        })
        .from(imageAttempts)
        .where(
          and(
            eq(imageAttempts.scenePlanId, plan.id),
            eq(imageAttempts.sceneIndex, target.sceneIndex),
            eq(imageAttempts.frameRole, target.frameRole),
          ),
        );

      const nextNumber = Number(maxRow.maxNum) + 1;
      const scene = scenes[target.sceneIndex] as any;

      const prompt = compileKeyframePrompt({
        scene: {
          phase: scene.phase ?? "",
          description: scene.description ?? "",
          cameraCommands: scene.cameraCommands,
        },
        frameRole: target.frameRole,
        productionPlan,
        settings,
        compilerVersion: PROMPT_COMPILER_VERSION,
      });

      const [attempt] = await tx
        .insert(imageAttempts)
        .values({
          runId,
          requestId: request.id,
          scenePlanId: plan.id,
          sceneIndex: target.sceneIndex,
          frameRole: target.frameRole,
          attemptNumber: nextNumber,
          status: "queued",
          prompt,
          provider,
          modelId,
          settings,
          queuedAt: new Date().toISOString(),
        })
        .returning();

      await tx.insert(imageGenerationJobQueue).values({
        attemptId: attempt.id,
        status: "queued",
        availableAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      insertedAttempts.push(attempt);
    }

    return {
      request: publicRequest(request),
      attempts: insertedAttempts.map((a: any) => ({
        ...publicAttempt(a),
        artifact: null as any,
      })),
      idempotentReplay: false,
    };
  });

  return result as {
    request: any;
    attempts: any[];
    idempotentReplay: boolean;
  };
}

function normalizeTargets(
  targets: Array<{ sceneIndex: number; frameRole: "first" | "last" }>,
  sceneCount: number,
  allowedFrames: string[],
): Array<{ sceneIndex: number; frameRole: "first" | "last" }> {
  const seen = new Set<string>();
  const result: Array<{ sceneIndex: number; frameRole: "first" | "last" }> = [];

  for (const t of targets) {
    if (t.sceneIndex >= sceneCount) {
      throw new ImageGenerationError(
        "TARGET_SCENE_INDEX_OUT_OF_RANGE",
        400,
        `Scene index ${t.sceneIndex} exceeds scene plan count ${sceneCount}`,
      );
    }
    if (!allowedFrames.includes(t.frameRole)) {
      throw new ImageGenerationError(
        "TARGET_FRAME_ROLE_NOT_ALLOWED",
        400,
        `Frame role "${t.frameRole}" is not allowed by scene plan`,
      );
    }
    const key = `${t.sceneIndex}:${t.frameRole}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }

  result.sort((a, b) => {
    if (a.sceneIndex !== b.sceneIndex) return a.sceneIndex - b.sceneIndex;
    if (a.frameRole === "first" && b.frameRole === "last") return -1;
    return 1;
  });

  return result;
}

function defaultTargets(
  sceneCount: number,
  allowedFrames: string[],
): Array<{ sceneIndex: number; frameRole: "first" | "last" }> {
  const targets: Array<{ sceneIndex: number; frameRole: "first" | "last" }> =
    [];
  for (let i = 0; i < sceneCount; i++) {
    if (allowedFrames.includes("first"))
      targets.push({ sceneIndex: i, frameRole: "first" });
    if (allowedFrames.includes("last"))
      targets.push({ sceneIndex: i, frameRole: "last" });
  }
  return targets;
}

export async function getImageGenerationStatus(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
) {
  const ownerId = z.string().uuid().parse(ownerIdInput);
  const projectId = z.string().uuid().parse(projectIdInput);
  const runId = z.string().uuid().parse(runIdInput);

  const runCheck = await db.execute(sql<{ id: string }>`
    SELECT run.id FROM generation_pipeline.generation_runs run
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE run.id = ${runId} AND run.project_id = ${projectId} AND project.owner_id = ${ownerId}
  `);
  if (!runCheck.rows[0])
    throw new GenerationFoundationError(404, "Generation run not found");

  const plans = await db
    .select()
    .from(scenePlans)
    .where(eq(scenePlans.runId, runId))
    .orderBy(scenePlans.createdAt);

  const requests = await db
    .select()
    .from(imageGenerationRequests)
    .where(eq(imageGenerationRequests.runId, runId))
    .orderBy(imageGenerationRequests.createdAt);

  const allAttempts = await db
    .select()
    .from(imageAttempts)
    .where(eq(imageAttempts.runId, runId))
    .orderBy(
      imageAttempts.sceneIndex,
      imageAttempts.frameRole,
      imageAttempts.attemptNumber,
    );

  const allArtifacts = await db
    .select()
    .from(imageArtifacts)
    .where(
      sql`attempt_id IN (SELECT id FROM generation_pipeline.image_attempts WHERE run_id = ${runId})`,
    );

  const artifactByAttempt = new Map(
    allArtifacts.map((a: any) => [a.attemptId, a]),
  );

  return {
    plans: plans.map((p: any) => ({
      id: p.id,
      runId: p.runId,
      revisionId: p.revisionId,
      requiredFrames: p.requiredFrames,
      createdAt: p.createdAt,
    })),
    requests: requests.map(publicRequest),
    attempts: allAttempts.map((a: any) => ({
      ...publicAttempt(a),
      artifact: artifactByAttempt.has(a.id)
        ? publicArtifact(artifactByAttempt.get(a.id))
        : null,
    })),
  };
}

function publicArtifact(row: any) {
  return {
    id: row.id,
    attemptId: row.attemptId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    checksum: row.checksum,
    createdAt: row.createdAt,
  };
}

export async function retryImageAttempt(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
  attemptIdInput: string,
  idempotencyKeyInput: string,
) {
  const ownerId = z.string().uuid().parse(ownerIdInput);
  const projectId = z.string().uuid().parse(projectIdInput);
  const runId = z.string().uuid().parse(runIdInput);
  const attemptId = z.string().uuid().parse(attemptIdInput);
  const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);

  const result = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql<{ id: string; status: string }>`
      SELECT run.id, project.status FROM generation_pipeline.generation_runs run
      JOIN generation_pipeline.video_projects project ON project.id = run.project_id
      WHERE run.id = ${runId} AND run.project_id = ${projectId} AND project.owner_id = ${ownerId}
      FOR UPDATE OF run
    `);
    const runRow = locked.rows[0];
    if (!runRow)
      throw new GenerationFoundationError(404, "Generation run not found");
    if (runRow.status === "archived")
      throw new GenerationFoundationError(
        409,
        "Archived video projects cannot retry image generation",
      );

    const [oldAttempt] = await tx
      .select()
      .from(imageAttempts)
      .where(
        and(eq(imageAttempts.id, attemptId), eq(imageAttempts.runId, runId)),
      )
      .limit(1);

    if (!oldAttempt)
      throw new GenerationFoundationError(404, "Image attempt not found");
    if (oldAttempt.status !== "failed") {
      throw new ImageGenerationError(
        "ATTEMPT_NOT_FAILED",
        400,
        "Only failed attempts can be retried",
      );
    }

    const planId = oldAttempt.scenePlanId;

    const [plan] = await tx
      .select()
      .from(scenePlans)
      .where(and(eq(scenePlans.id, planId), eq(scenePlans.runId, runId)))
      .limit(1);
    if (!plan) throw new GenerationFoundationError(404, "Scene plan not found");

    const provider = oldAttempt.provider;
    const modelId = oldAttempt.modelId;
    const settings =
      typeof oldAttempt.settings === "string"
        ? JSON.parse(oldAttempt.settings)
        : oldAttempt.settings;

    const fingerprint = computeFingerprint({
      runId,
      approvedRevisionId: plan.revisionId,
      scenePlanId: planId,
      targets: [
        {
          sceneIndex: oldAttempt.sceneIndex,
          frameRole: oldAttempt.frameRole as "first" | "last",
        },
      ],
      provider,
      modelId,
      modelCatalogRevision: null,
      settings,
      promptCompilerVersion: PROMPT_COMPILER_VERSION,
    });

    const [existingReq] = await tx
      .select()
      .from(imageGenerationRequests)
      .where(
        and(
          eq(imageGenerationRequests.runId, runId),
          eq(imageGenerationRequests.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existingReq && existingReq.requestFingerprint !== fingerprint) {
      throw new ImageGenerationError(
        "IDEMPOTENCY_KEY_REUSED",
        409,
        "Idempotency key was already used for a different retry request",
      );
    }
    if (existingReq) {
      const [retryAttempt] = await tx
        .select()
        .from(imageAttempts)
        .where(eq(imageAttempts.requestId, existingReq.id))
        .limit(1);
      if (retryAttempt) {
        return {
          request: publicRequest(existingReq),
          attempt: {
            ...publicAttempt(retryAttempt),
            artifact: null as any,
          },
        };
      }
    }

    const [maxRow] = await tx
      .select({
        maxNum: sql<number>`COALESCE(MAX(${imageAttempts.attemptNumber}), 0)`,
      })
      .from(imageAttempts)
      .where(
        and(
          eq(imageAttempts.scenePlanId, planId),
          eq(imageAttempts.sceneIndex, oldAttempt.sceneIndex),
          eq(imageAttempts.frameRole, oldAttempt.frameRole),
        ),
      );

    const nextNumber = Number(maxRow.maxNum) + 1;

    const [request] = await tx
      .insert(imageGenerationRequests)
      .values({
        runId,
        scenePlanId: planId,
        idempotencyKey,
        requestFingerprint: fingerprint,
        targets: [
          {
            sceneIndex: oldAttempt.sceneIndex,
            frameRole: oldAttempt.frameRole,
          },
        ],
        provider,
        modelId,
        modelCatalogRevision: null,
        settings,
        createdAt: new Date().toISOString(),
      })
      .returning();

    const [newAttempt] = await tx
      .insert(imageAttempts)
      .values({
        runId,
        requestId: request.id,
        scenePlanId: planId,
        sceneIndex: oldAttempt.sceneIndex,
        frameRole: oldAttempt.frameRole,
        attemptNumber: nextNumber,
        status: "queued",
        prompt: oldAttempt.prompt,
        provider,
        modelId,
        settings,
        queuedAt: new Date().toISOString(),
      })
      .returning();

    await tx.insert(imageGenerationJobQueue).values({
      attemptId: newAttempt.id,
      status: "queued",
      availableAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    return {
      request: publicRequest(request),
      attempt: {
        ...publicAttempt(newAttempt),
        artifact: null as any,
      },
    };
  });

  return result as { request: any; attempt: any };
}
