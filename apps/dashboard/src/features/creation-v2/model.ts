import { z } from "zod";
import {
  contentFormatInputSchema,
  formatInputsSchema,
  scenariosSchema,
  validateFormatInputs,
  type ContentFormatInputSchema,
  type Scenario,
} from "@scrimspec/shared-types";
import type { Format } from "@/features/content-formats/api";
import type { ModelWithProvider } from "@/shared/api/actions";

export const wizardProductionSchema = z.object({
  ratio: z.enum(["16:9", "9:16", "4:3", "3:4", "1:1"]),
  targetDurationSeconds: z.number().int().min(1).max(3600),
  language: z.string().trim().min(1).max(32),
  platform: z.enum([
    "youtube",
    "youtube_shorts",
    "tiktok",
    "instagram_reels",
    "other",
  ]),
  audioMode: z.enum(["none", "music", "voiceover", "music_and_voiceover"]),
});

export const modelChoiceSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
});

export const creationWizardSchema = z.object({
  contentFormatId: z.string().uuid("Choose an active Content Format."),
  title: z.string().trim().min(1, "Project title is required.").max(200),
  idea: z
    .string()
    .trim()
    .min(10, "Describe a concrete video idea.")
    .max(10_000),
  storyTemplateId: z.string().uuid().nullable(),
  formatInputs: formatInputsSchema,
  production: wizardProductionSchema,
  models: z.object({
    text: modelChoiceSchema,
    image: modelChoiceSchema,
    video: modelChoiceSchema,
  }),
});

export type CreationWizardValue = z.infer<typeof creationWizardSchema>;

export type WizardDraft = Partial<CreationWizardValue> & {
  step: number;
  submissionId?: string;
  durableProjectId?: string;
  durableRunId?: string;
};

export const emptyInputSchema: ContentFormatInputSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

export function parseFormatInputSchema(value: unknown) {
  return contentFormatInputSchema.safeParse(value ?? emptyInputSchema);
}

export function defaultsForInputSchema(schema: ContentFormatInputSchema) {
  return Object.fromEntries(
    Object.entries(schema.properties)
      .filter(([, field]) => field.default !== undefined)
      .map(([name, field]) => [name, field.default!]),
  );
}

export function resolveDuration(input: {
  requested: number;
  format: Pick<Format, "targetDurationMinSeconds" | "targetDurationMaxSeconds">;
  templateDuration?: number | null;
}) {
  const min = input.format.targetDurationMinSeconds ?? undefined;
  const max = input.format.targetDurationMaxSeconds ?? undefined;
  if (min != null && input.requested < min)
    return {
      valid: false as const,
      message: `Duration must be at least ${min} seconds for this Content Format.`,
    };
  if (max != null && input.requested > max)
    return {
      valid: false as const,
      message: `Duration must be no more than ${max} seconds for this Content Format.`,
    };
  if (
    input.templateDuration != null &&
    input.requested !== input.templateDuration
  )
    return {
      valid: false as const,
      message: `The selected Story Template targets ${input.templateDuration} seconds. Choose that duration or remove the template.`,
    };
  return { valid: true as const, duration: input.requested };
}

export function scenarioTextModels(models: ModelWithProvider[]) {
  return models.filter(
    (model) =>
      model.isEnabled &&
      model.type === "text-to-text" &&
      model.providerId === "minimax" &&
      model.capabilities?.includes("function_calling"),
  );
}

export function modelReference(model: ModelWithProvider | undefined) {
  return model ? { provider: model.providerId, modelId: model.id } : undefined;
}

export function validateWizard(
  value: unknown,
  format: Format | null,
  templateDuration?: number | null,
) {
  const base = creationWizardSchema.safeParse(value);
  if (!base.success) return base;
  if (!format || format.status !== "active")
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          path: ["contentFormatId"],
          message: "Choose an active Content Format.",
        },
      ]),
    };
  const schema = parseFormatInputSchema(format.inputSchema);
  if (!schema.success)
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          path: ["formatInputs"],
          message: "This Content Format uses an unsupported input field type.",
        },
      ]),
    };
  const inputs = validateFormatInputs(schema.data, base.data.formatInputs);
  if (!inputs.success)
    return {
      success: false as const,
      error: new z.ZodError(
        Object.entries(inputs.errors).map(([name, message]) => ({
          code: "custom",
          path: ["formatInputs", name],
          message,
        })),
      ),
    };
  const duration = resolveDuration({
    requested: base.data.production.targetDurationSeconds,
    format,
    templateDuration,
  });
  if (!duration.valid)
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          path: ["production", "targetDurationSeconds"],
          message: duration.message,
        },
      ]),
    };
  return { success: true as const, data: base.data };
}

export function buildProjectRequest(
  value: CreationWizardValue,
  submissionId: string,
) {
  return {
    clientSubmissionId: submissionId,
    title: value.title,
    idea: value.idea,
    contentFormatId: value.contentFormatId,
    storyTemplateId: value.storyTemplateId,
    defaults: {
      production: value.production,
      models: value.models,
      formatInputs: value.formatInputs,
    },
  };
}

export function buildRunRequest(
  value: CreationWizardValue,
  submissionId?: string,
) {
  return {
    clientSubmissionId: submissionId,
    overrides: { production: value.production, models: value.models },
  };
}

export function newIdempotencyKey(prefix: "submit" | "retry") {
  return `${prefix}:${crypto.randomUUID()}`;
}

export function scenarioPollInterval(
  status: string | undefined,
  hidden: boolean,
) {
  return !hidden && (status === "queued" || status === "running")
    ? 2500
    : false;
}

export const scenarioArtifactResponseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  attemptId: z.string().uuid(),
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  scenarios: scenariosSchema,
});

export type ScenarioArtifactResponse = z.infer<
  typeof scenarioArtifactResponseSchema
>;
export type ScenarioCandidate = Scenario;

const errorMessages: Record<string, string> = {
  SCENARIO_GENERATION_TRUNCATED:
    "The model response was incomplete. Retry with the same settings.",
  SCENARIO_GENERATION_JSON_PARSE_FAILED:
    "The model returned malformed scenario data. Retry with the same settings.",
  SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED:
    "The generated scenarios did not pass validation. Retry with the same settings.",
  SCENARIO_GENERATION_EMPTY: "The model returned no scenario candidates.",
  SCENARIO_ARTIFACT_CORRUPTED:
    "The stored scenario artifact failed validation. Contact support with the request ID.",
  WORKER_UNAVAILABLE:
    "The scenario worker is currently unavailable. The queued attempt is preserved.",
};

export function userMessageForError(input: {
  code?: string | null;
  message?: string | null;
  correlationId?: string | null;
}) {
  const message =
    (input.code && errorMessages[input.code]) ||
    input.message ||
    "The request could not be completed.";
  return input.correlationId
    ? `${message} Request ID: ${input.correlationId}`
    : message;
}
