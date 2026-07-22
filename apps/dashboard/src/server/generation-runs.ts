import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  contentFormatInputSchema,
  contentFormatProductionDefaultsSchema,
  formatInputsSchema,
  validateFormatInputs,
} from "@scrimspec/shared-types";
import { db } from "@/shared/lib/db";
import {
  aiModels,
  beats,
  contentFormats,
  generationRuns,
  storyTemplates,
  videoProjects,
} from "@/shared/lib/schema";

export const GENERATION_RUN_SCHEMA_VERSION = 1 as const;

export const projectStatusSchema = z.enum(["draft", "active", "archived"]);
export const generationRunStatusSchema = z.enum([
  "draft",
  "active",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const generationRunStageSchema = z.enum([
  "scenario",
  "keyframes",
  "clips",
  "composition",
]);
export const ratioSchema = z.enum(["16:9", "9:16", "4:3", "3:4", "1:1"]);
export const platformSchema = z.enum([
  "youtube",
  "youtube_shorts",
  "tiktok",
  "instagram_reels",
  "other",
]);
export const audioModeSchema = z.enum([
  "none",
  "music",
  "voiceover",
  "music_and_voiceover",
]);

export const modelReferenceSchema = z
  .object({
    provider: z.string().trim().min(1).max(100),
    modelId: z.string().trim().min(1).max(200),
  })
  .strict();

const productionDefaultsSchema = z
  .object({
    ratio: ratioSchema.optional(),
    language: z.string().trim().min(1).max(32).optional(),
    targetDurationSeconds: z.number().int().min(1).max(3600).optional(),
    platform: platformSchema.optional(),
    audioMode: audioModeSchema.optional(),
  })
  .strict();

const modelDefaultsSchema = z
  .object({
    text: modelReferenceSchema.optional(),
    image: modelReferenceSchema.optional(),
    video: modelReferenceSchema.optional(),
  })
  .strict();

const projectDefaultsInputSchema = z
  .object({
    schemaVersion: z.literal(GENERATION_RUN_SCHEMA_VERSION).optional(),
    production: productionDefaultsSchema.optional(),
    models: modelDefaultsSchema.optional(),
    formatInputs: formatInputsSchema.optional(),
  })
  .strict();

export const projectDefaultsSchema = projectDefaultsInputSchema.transform(
  (value) => ({
    schemaVersion: GENERATION_RUN_SCHEMA_VERSION,
    production: value.production ?? {},
    models: value.models ?? {},
    formatInputs: value.formatInputs ?? {},
  }),
);

export const generationRunOverridesSchema = z
  .object({
    production: productionDefaultsSchema.optional(),
    models: modelDefaultsSchema.optional(),
  })
  .strict();

export const sourceSnapshotSchema = z
  .object({
    schemaVersion: z
      .literal(GENERATION_RUN_SCHEMA_VERSION)
      .default(GENERATION_RUN_SCHEMA_VERSION),
    references: z
      .array(
        z
          .object({
            kind: z.enum([
              "content_format_evidence",
              "youtube_video",
              "youtube_channel",
              "discovery_run",
              "external",
            ]),
            id: z.string().trim().min(1).max(500).optional(),
            uri: z.string().url().max(2000).optional(),
            label: z.string().trim().min(1).max(500).optional(),
          })
          .strict()
          .refine((reference) => reference.id || reference.uri, {
            message: "A source reference needs an id or uri",
          }),
      )
      .max(100),
  })
  .strict();

export const createVideoProjectSchema = z
  .object({
    clientSubmissionId: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(200),
    idea: z.string().trim().min(1).max(10_000),
    contentFormatId: z.string().uuid().nullable().optional(),
    storyTemplateId: z.string().uuid().nullable().optional(),
    defaults: projectDefaultsInputSchema.optional(),
  })
  .strict();

export const updateVideoProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    idea: z.string().trim().min(1).max(10_000).optional(),
    status: projectStatusSchema.optional(),
    contentFormatId: z.string().uuid().nullable().optional(),
    storyTemplateId: z.string().uuid().nullable().optional(),
    defaults: projectDefaultsInputSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable project field is required",
  });

export const createGenerationRunSchema = z
  .object({
    clientSubmissionId: z.string().trim().min(1).max(200).optional(),
    overrides: generationRunOverridesSchema.optional(),
    sourceSnapshot: sourceSnapshotSchema.nullable().optional(),
  })
  .strict();

export const operationalTransitionSchema = z
  .object({
    status: generationRunStatusSchema,
    stage: generationRunStageSchema.optional(),
    errorCode: z.string().trim().min(1).max(200).optional(),
    errorMessage: z.string().trim().min(1).max(10_000).optional(),
  })
  .strict();

export type ProjectDefaults = z.output<typeof projectDefaultsSchema>;
export type GenerationRunOverrides = z.infer<
  typeof generationRunOverridesSchema
>;
export type ModelReference = z.infer<typeof modelReferenceSchema>;
export type GenerationRunStatus = z.infer<typeof generationRunStatusSchema>;
export type GenerationRunStage = z.infer<typeof generationRunStageSchema>;

export const SYSTEM_GENERATION_DEFAULTS = Object.freeze({
  production: Object.freeze({
    ratio: "9:16" as const,
    language: "none",
    targetDurationSeconds: 32,
    platform: "youtube_shorts" as const,
    audioMode: "none" as const,
  }),
  models: Object.freeze({
    text: Object.freeze({ provider: "minimax", modelId: "minimax-m2" }),
    image: Object.freeze({
      provider: "google_gemini",
      modelId: "gemini-2.5-flash-image",
    }),
    video: Object.freeze({
      provider: "minimax",
      modelId: "minimax-halu-video",
    }),
  }),
});

type ContentFormatForSnapshot = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  formatType: string;
  hookPattern: string | null;
  structurePattern: string | null;
  visualPattern: string | null;
  pacingPattern: string | null;
  targetDurationMinSeconds: number | null;
  targetDurationMaxSeconds: number | null;
  exampleOutput?: string | null;
  inputSchema?: unknown;
  productionDefaults?: unknown;
  productionRules?: unknown;
};

type StoryTemplateForSnapshot = {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  targetDurationSeconds: number;
  beats: Array<{
    order: number;
    phase: string;
    durationSeconds: string;
    description: string;
    actionPrompt: string | null;
    emotion: string;
    contrast: string | null;
    intendedImpact: string | null;
  }>;
};

type ProjectForSnapshot = {
  id: string;
  title: string;
  idea: string;
  status: "draft" | "active" | "archived";
  contentFormatId: string | null;
  storyTemplateId: string | null;
  projectDefaults: unknown;
};

function formatDuration(
  format: ContentFormatForSnapshot | null,
): number | undefined {
  if (!format) return undefined;
  const min = format.targetDurationMinSeconds;
  const max = format.targetDurationMaxSeconds;
  if (min != null && max != null) return Math.round((min + max) / 2);
  return min ?? max ?? undefined;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      deepFreeze(nested);
  }
  return value;
}

/** Pure precedence resolver: run overrides > project defaults > format defaults > system defaults. */
export function resolveGenerationRunSnapshot(input: {
  project: ProjectForSnapshot;
  contentFormat: ContentFormatForSnapshot | null;
  storyTemplate: StoryTemplateForSnapshot | null;
  overrides?: GenerationRunOverrides;
  sourceSnapshot?: z.input<typeof sourceSnapshotSchema> | null;
  systemDefaults?: typeof SYSTEM_GENERATION_DEFAULTS;
}) {
  const projectDefaults = projectDefaultsSchema.parse(
    input.project.projectDefaults,
  );
  const overrides = generationRunOverridesSchema.parse(input.overrides ?? {});
  const systemDefaults = input.systemDefaults ?? SYSTEM_GENERATION_DEFAULTS;
  const formatDefaults = input.contentFormat
    ? contentFormatProductionDefaultsSchema.parse(
        input.contentFormat.productionDefaults ?? {},
      )
    : {};
  const models = {
    text:
      overrides.models?.text ??
      projectDefaults.models.text ??
      systemDefaults.models.text,
    image:
      overrides.models?.image ??
      projectDefaults.models.image ??
      systemDefaults.models.image,
    video:
      overrides.models?.video ??
      projectDefaults.models.video ??
      systemDefaults.models.video,
  };
  const production = {
    ratio:
      overrides.production?.ratio ??
      projectDefaults.production.ratio ??
      formatDefaults.ratio ??
      systemDefaults.production.ratio,
    language:
      overrides.production?.language ??
      projectDefaults.production.language ??
      formatDefaults.language ??
      systemDefaults.production.language,
    targetDurationSeconds:
      overrides.production?.targetDurationSeconds ??
      projectDefaults.production.targetDurationSeconds ??
      formatDefaults.targetDurationSeconds ??
      formatDuration(input.contentFormat) ??
      input.storyTemplate?.targetDurationSeconds ??
      systemDefaults.production.targetDurationSeconds,
    platform:
      overrides.production?.platform ??
      projectDefaults.production.platform ??
      formatDefaults.platform ??
      systemDefaults.production.platform,
    audioMode:
      overrides.production?.audioMode ??
      projectDefaults.production.audioMode ??
      formatDefaults.audioMode ??
      systemDefaults.production.audioMode,
  };
  const modelSnapshot = {
    schemaVersion: GENERATION_RUN_SCHEMA_VERSION,
    ...models,
  };
  const snapshots = {
    inputSnapshot: {
      schemaVersion: GENERATION_RUN_SCHEMA_VERSION,
      models,
      production,
      formatInputs: projectDefaults.formatInputs,
    },
    projectSnapshot: {
      schemaVersion: GENERATION_RUN_SCHEMA_VERSION,
      id: input.project.id,
      title: input.project.title,
      idea: input.project.idea,
      status: input.project.status,
      contentFormatId: input.project.contentFormatId,
      storyTemplateId: input.project.storyTemplateId,
      defaults: projectDefaults,
    },
    contentFormatSnapshot: input.contentFormat
      ? {
          schemaVersion: GENERATION_RUN_SCHEMA_VERSION,
          ...input.contentFormat,
        }
      : null,
    storyTemplateSnapshot: input.storyTemplate
      ? {
          schemaVersion: GENERATION_RUN_SCHEMA_VERSION,
          ...input.storyTemplate,
        }
      : null,
    modelSnapshot,
    promptSnapshot: {
      schemaVersion: GENERATION_RUN_SCHEMA_VERSION,
      scenario: {
        compilerVersion: "scenario-prompt-compiler:v1",
        templateVersion: "scenario:v1",
      },
      keyframes: {
        compilerVersion: "keyframe-prompt-compiler:v1",
        templateVersion: "keyframe:v1",
      },
      clips: {
        compilerVersion: "clip-prompt-compiler:v1",
        templateVersion: "clip:v1",
      },
    },
    sourceSnapshot:
      input.sourceSnapshot == null
        ? null
        : sourceSnapshotSchema.parse(input.sourceSnapshot),
    schemaVersion: GENERATION_RUN_SCHEMA_VERSION,
  };
  return deepFreeze(snapshots);
}

export class GenerationFoundationError extends Error {
  constructor(
    public readonly status: 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "GenerationFoundationError";
  }
}

const ownerIdSchema = z.string().uuid();
const idSchema = z.string().uuid();

async function validateReferences(input: {
  contentFormatId?: string | null;
  storyTemplateId?: string | null;
}) {
  if (input.contentFormatId) {
    const [format] = await db
      .select({ id: contentFormats.id, status: contentFormats.status })
      .from(contentFormats)
      .where(eq(contentFormats.id, input.contentFormatId))
      .limit(1);
    if (!format)
      throw new GenerationFoundationError(404, "Content format not found");
    if (format.status !== "active")
      throw new GenerationFoundationError(
        409,
        "Only active content formats can be used for a video project",
      );
  }
  if (input.storyTemplateId) {
    const [template] = await db
      .select({ id: storyTemplates.id })
      .from(storyTemplates)
      .where(eq(storyTemplates.id, input.storyTemplateId))
      .limit(1);
    if (!template)
      throw new GenerationFoundationError(404, "Story template not found");
  }
}

export async function createVideoProject(ownerIdInput: string, input: unknown) {
  const ownerId = ownerIdSchema.parse(ownerIdInput);
  const values = createVideoProjectSchema.parse(input);
  await validateReferences(values);
  const defaults = projectDefaultsSchema.parse(values.defaults ?? {});
  const [project] = await db
    .insert(videoProjects)
    .values({
      ownerId,
      clientSubmissionId: values.clientSubmissionId,
      title: values.title,
      idea: values.idea,
      status: "draft",
      contentFormatId: values.contentFormatId ?? null,
      storyTemplateId: values.storyTemplateId ?? null,
      projectDefaults: defaults,
    })
    .onConflictDoNothing({
      target: [videoProjects.ownerId, videoProjects.clientSubmissionId],
    })
    .returning();
  if (project) return project;
  if (values.clientSubmissionId) {
    const [existing] = await db
      .select()
      .from(videoProjects)
      .where(
        and(
          eq(videoProjects.ownerId, ownerId),
          eq(videoProjects.clientSubmissionId, values.clientSubmissionId),
        ),
      )
      .limit(1);
    if (existing) return existing;
  }
  throw new Error("Video project could not be created");
}

export async function listVideoProjects(ownerIdInput: string) {
  const ownerId = ownerIdSchema.parse(ownerIdInput);
  return db
    .select()
    .from(videoProjects)
    .where(eq(videoProjects.ownerId, ownerId))
    .orderBy(desc(videoProjects.updatedAt));
}

export async function getVideoProject(
  ownerIdInput: string,
  projectIdInput: string,
) {
  const ownerId = ownerIdSchema.parse(ownerIdInput);
  const projectId = idSchema.parse(projectIdInput);
  const [project] = await db
    .select()
    .from(videoProjects)
    .where(
      and(eq(videoProjects.id, projectId), eq(videoProjects.ownerId, ownerId)),
    )
    .limit(1);
  if (!project)
    throw new GenerationFoundationError(404, "Video project not found");
  return project;
}

export async function updateVideoProject(
  ownerIdInput: string,
  projectIdInput: string,
  input: unknown,
) {
  const ownerId = ownerIdSchema.parse(ownerIdInput);
  const projectId = idSchema.parse(projectIdInput);
  const values = updateVideoProjectSchema.parse(input);
  await validateReferences(values);
  const [project] = await db
    .update(videoProjects)
    .set({
      title: values.title,
      idea: values.idea,
      status: values.status,
      contentFormatId: values.contentFormatId,
      storyTemplateId: values.storyTemplateId,
      projectDefaults:
        values.defaults === undefined
          ? undefined
          : projectDefaultsSchema.parse(values.defaults),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(eq(videoProjects.id, projectId), eq(videoProjects.ownerId, ownerId)),
    )
    .returning();
  if (!project)
    throw new GenerationFoundationError(404, "Video project not found");
  return project;
}

async function loadSnapshotContext(
  executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: string,
  ownerId: string,
) {
  const [project] = await executor
    .select()
    .from(videoProjects)
    .where(
      and(eq(videoProjects.id, projectId), eq(videoProjects.ownerId, ownerId)),
    )
    .limit(1);
  if (!project)
    throw new GenerationFoundationError(404, "Video project not found");
  if (project.status === "archived")
    throw new GenerationFoundationError(
      409,
      "Archived video projects cannot create runs",
    );

  const [contentFormat] = project.contentFormatId
    ? await executor
        .select()
        .from(contentFormats)
        .where(eq(contentFormats.id, project.contentFormatId))
        .limit(1)
    : [null];
  if (contentFormat && contentFormat.status !== "active") {
    throw new GenerationFoundationError(
      409,
      "Only active content formats can be used for a new run",
    );
  }

  if (contentFormat) {
    const schema = contentFormatInputSchema.safeParse(
      contentFormat.inputSchema,
    );
    if (!schema.success)
      throw new GenerationFoundationError(
        409,
        "Content format input schema is unsupported",
      );
    const defaults = projectDefaultsSchema.parse(project.projectDefaults);
    const formatInputs = validateFormatInputs(
      schema.data,
      defaults.formatInputs,
    );
    if (!formatInputs.success)
      throw new GenerationFoundationError(
        409,
        "Content format inputs are invalid",
      );
  }

  const [template] = project.storyTemplateId
    ? await executor
        .select()
        .from(storyTemplates)
        .where(eq(storyTemplates.id, project.storyTemplateId))
        .limit(1)
    : [null];
  const templateBeats = template
    ? await executor
        .select()
        .from(beats)
        .where(eq(beats.templateId, template.id))
        .orderBy(beats.order)
    : [];

  return {
    project,
    contentFormat: contentFormat ?? null,
    storyTemplate: template ? { ...template, beats: templateBeats } : null,
  };
}

async function validateResolvedModels(
  executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
  models: Record<"text" | "image" | "video", ModelReference>,
) {
  const references = Object.values(models);
  const rows = await executor
    .select({
      id: aiModels.id,
      providerId: aiModels.providerId,
      isEnabled: aiModels.isEnabled,
      type: aiModels.type,
      capabilities: aiModels.capabilities,
    })
    .from(aiModels)
    .where(
      inArray(
        aiModels.id,
        references.map((model) => model.modelId),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const reference of references) {
    const model = byId.get(reference.modelId);
    if (!model || !model.isEnabled || model.providerId !== reference.provider) {
      throw new GenerationFoundationError(
        409,
        `Model ${reference.provider}/${reference.modelId} is not available`,
      );
    }
  }
  const text = byId.get(models.text.modelId);
  if (
    !text ||
    text.type !== "text-to-text" ||
    text.providerId !== "minimax" ||
    !text.capabilities?.includes("function_calling")
  ) {
    throw new GenerationFoundationError(
      409,
      "Selected text model does not support durable scenario generation",
    );
  }
}

export async function createGenerationRun(
  ownerIdInput: string,
  projectIdInput: string,
  input: unknown,
) {
  const ownerId = ownerIdSchema.parse(ownerIdInput);
  const projectId = idSchema.parse(projectIdInput);
  const values = createGenerationRunSchema.parse(input);

  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT id FROM generation_pipeline.video_projects
      WHERE id = ${projectId} AND owner_id = ${ownerId}
      FOR UPDATE
    `);
    if (locked.rowCount === 0)
      throw new GenerationFoundationError(404, "Video project not found");

    const context = await loadSnapshotContext(tx, projectId, ownerId);
    if (values.clientSubmissionId) {
      const [existing] = await tx
        .select()
        .from(generationRuns)
        .where(
          and(
            eq(generationRuns.projectId, projectId),
            eq(generationRuns.clientSubmissionId, values.clientSubmissionId),
          ),
        )
        .limit(1);
      if (existing) return existing;
    }
    const snapshots = resolveGenerationRunSnapshot({
      ...context,
      overrides: values.overrides,
      sourceSnapshot: values.sourceSnapshot,
    });
    await validateResolvedModels(tx, snapshots.inputSnapshot.models);
    const [last] = await tx
      .select({
        runNumber: sql<number>`coalesce(max(${generationRuns.runNumber}), 0)`,
      })
      .from(generationRuns)
      .where(eq(generationRuns.projectId, projectId));
    const runNumber = Number(last.runNumber) + 1;
    const [run] = await tx
      .insert(generationRuns)
      .values({
        projectId,
        clientSubmissionId: values.clientSubmissionId,
        runNumber,
        status: "draft",
        stage: "scenario",
        inputSnapshot: snapshots.inputSnapshot,
        projectSnapshot: snapshots.projectSnapshot,
        contentFormatSnapshot: snapshots.contentFormatSnapshot,
        storyTemplateSnapshot: snapshots.storyTemplateSnapshot,
        modelSnapshot: snapshots.modelSnapshot,
        promptSnapshot: snapshots.promptSnapshot,
        sourceSnapshot: snapshots.sourceSnapshot,
        schemaVersion: snapshots.schemaVersion,
      })
      .returning();
    return run;
  });
}

export async function listGenerationRuns(
  ownerIdInput: string,
  projectIdInput: string,
) {
  const project = await getVideoProject(ownerIdInput, projectIdInput);
  return db
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.projectId, project.id))
    .orderBy(desc(generationRuns.runNumber));
}

export async function getGenerationRun(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
) {
  const ownerId = ownerIdSchema.parse(ownerIdInput);
  const projectId = idSchema.parse(projectIdInput);
  const runId = idSchema.parse(runIdInput);
  const [run] = await db
    .select({ run: generationRuns })
    .from(generationRuns)
    .innerJoin(
      videoProjects,
      and(
        eq(videoProjects.id, generationRuns.projectId),
        eq(videoProjects.ownerId, ownerId),
      ),
    )
    .where(
      and(
        eq(generationRuns.id, runId),
        eq(generationRuns.projectId, projectId),
      ),
    )
    .limit(1);
  if (!run)
    throw new GenerationFoundationError(404, "Generation run not found");
  return run.run;
}

const allowedTransitions: Record<
  GenerationRunStatus,
  readonly GenerationRunStatus[]
> = {
  draft: ["active", "queued", "cancelled"],
  active: ["succeeded", "failed", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function assertGenerationRunTransition(
  from: GenerationRunStatus,
  to: GenerationRunStatus,
) {
  if (!allowedTransitions[from].includes(to)) {
    throw new GenerationFoundationError(
      409,
      `Cannot transition a run from ${from} to ${to}`,
    );
  }
}

/** Operational-only update path. Snapshot columns are intentionally absent. */
export async function transitionGenerationRunOperationalState(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
  input: unknown,
) {
  const values = operationalTransitionSchema.parse(input);
  const current = await getGenerationRun(
    ownerIdInput,
    projectIdInput,
    runIdInput,
  );
  assertGenerationRunTransition(current.status, values.status);
  if (
    values.status === "failed" &&
    (!values.errorCode || !values.errorMessage)
  ) {
    throw new GenerationFoundationError(
      409,
      "Failed runs require errorCode and errorMessage",
    );
  }
  const now = new Date().toISOString();
  const [updated] = await db
    .update(generationRuns)
    .set({
      status: values.status,
      stage: values.stage,
      startedAt:
        values.status === "running" ? (current.startedAt ?? now) : undefined,
      completedAt: ["succeeded", "failed", "cancelled"].includes(values.status)
        ? now
        : undefined,
      failedStage:
        values.status === "failed" ? (values.stage ?? current.stage) : null,
      errorCode: values.status === "failed" ? values.errorCode : null,
      errorMessage: values.status === "failed" ? values.errorMessage : null,
    })
    .where(
      and(
        eq(generationRuns.id, current.id),
        eq(generationRuns.status, current.status),
      ),
    )
    .returning();
  if (!updated)
    throw new GenerationFoundationError(
      409,
      "Generation run state changed concurrently",
    );
  return updated;
}

export async function promoteGenerationRun(
  ownerIdInput: string,
  projectIdInput: string,
  runIdInput: string,
) {
  const run = await getGenerationRun(ownerIdInput, projectIdInput, runIdInput);
  const ownerId = ownerIdSchema.parse(ownerIdInput);
  const [project] = await db
    .update(videoProjects)
    .set({
      promotedRunId: run.id,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(videoProjects.id, run.projectId),
        eq(videoProjects.ownerId, ownerId),
      ),
    )
    .returning();
  return project;
}
