import { z } from "zod";

export const formatInputValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
]);

export const formatInputsSchema = z.record(formatInputValueSchema);
export type FormatInputs = z.infer<typeof formatInputsSchema>;

const formatInputFieldBaseSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2_000).optional(),
  default: formatInputValueSchema.optional(),
});

export const formatInputFieldSchema = z.discriminatedUnion("type", [
  formatInputFieldBaseSchema
    .extend({
      type: z.literal("string"),
      format: z.literal("multiline").optional(),
      enum: z.array(z.string()).min(1).max(100).optional(),
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().positive().optional(),
    })
    .strict(),
  formatInputFieldBaseSchema
    .extend({
      type: z.literal("number"),
      minimum: z.number().finite().optional(),
      maximum: z.number().finite().optional(),
    })
    .strict(),
  formatInputFieldBaseSchema
    .extend({
      type: z.literal("integer"),
      minimum: z.number().int().optional(),
      maximum: z.number().int().optional(),
    })
    .strict(),
  formatInputFieldBaseSchema.extend({ type: z.literal("boolean") }).strict(),
]);

export const contentFormatInputSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(formatInputFieldSchema),
    required: z.array(z.string()).max(100).default([]),
    additionalProperties: z.literal(false).default(false),
  })
  .strict()
  .superRefine((schema, ctx) => {
    if (Object.keys(schema.properties).length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties"],
        message: "At most 100 format input fields are supported",
      });
    }
    if (new Set(schema.required).size !== schema.required.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["required"],
        message: "Required fields must be unique",
      });
    }
    for (const name of schema.required) {
      if (!schema.properties[name]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["required"],
          message: `Required field ${name} is not declared in properties`,
        });
      }
    }
    for (const [name, field] of Object.entries(schema.properties)) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["properties", name],
          message: "Field names must be stable identifiers of 1-64 characters",
        });
      }
      if (
        "minimum" in field &&
        field.minimum != null &&
        field.maximum != null &&
        field.minimum > field.maximum
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["properties", name, "minimum"],
          message: "Minimum cannot exceed maximum",
        });
      }
      if (
        field.type === "string" &&
        field.minLength != null &&
        field.maxLength != null &&
        field.minLength > field.maxLength
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["properties", name, "minLength"],
          message: "Minimum length cannot exceed maximum length",
        });
      }
      if (field.default !== undefined) {
        const error = validateFieldValue(field, field.default);
        if (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["properties", name, "default"],
            message: `Invalid default: ${error}`,
          });
        }
      }
    }
  });

export type ContentFormatInputSchema = z.infer<typeof contentFormatInputSchema>;

export const contentFormatProductionDefaultsSchema = z
  .object({
    ratio: z.enum(["16:9", "9:16", "4:3", "3:4", "1:1"]).optional(),
    language: z.string().trim().min(1).max(32).optional(),
    targetDurationSeconds: z.number().int().min(1).max(3600).optional(),
    platform: z
      .enum(["youtube", "youtube_shorts", "tiktok", "instagram_reels", "other"])
      .optional(),
    audioMode: z
      .enum(["none", "music", "voiceover", "music_and_voiceover"])
      .optional(),
  })
  .strict();

const positiveSeconds = z.number().finite().positive().max(3_600);

/** The immutable, provider-enforceable format contract used by new runs. */
export const contentFormatProductionRulesV1Schema = z
  .object({
    version: z.literal(1),
    instructions: z
      .array(z.string().trim().min(1).max(1_000))
      .max(100)
      .default([]),
    timing: z
      .object({
        exactSceneCount: z.number().int().positive().max(100).optional(),
        sceneDurationSeconds: positiveSeconds.optional(),
        totalDurationSeconds: positiveSeconds.optional(),
      })
      .strict()
      .default({}),
    camera: z
      .object({
        movement: z.enum(["static", "dynamic", "unspecified"]).optional(),
        angleDegrees: z
          .object({ min: z.number().finite(), max: z.number().finite() })
          .strict()
          .optional(),
        framingLocked: z.boolean().optional(),
        noZoom: z.boolean().optional(),
        noPan: z.boolean().optional(),
        noTilt: z.boolean().optional(),
        noShake: z.boolean().optional(),
        noCuts: z.boolean().optional(),
      })
      .strict()
      .default({}),
    continuity: z
      .object({
        sameSceneAcrossClips: z.boolean().optional(),
        usePreviousFinalFrame: z.boolean().optional(),
        persistentWreckage: z.boolean().optional(),
        vehicleEntryDirection: z.string().trim().min(1).max(100).optional(),
        obstaclePosition: z.string().trim().min(1).max(100).optional(),
      })
      .strict()
      .default({}),
    forbidden: z
      .object({
        slowMotion: z.boolean().optional(),
        fireExplosions: z.boolean().optional(),
        humans: z.boolean().optional(),
        gore: z.boolean().optional(),
        hud: z.boolean().optional(),
        watermarks: z.boolean().optional(),
        textOverlays: z.boolean().optional(),
      })
      .strict()
      .default({}),
    requiredConcepts: z
      .array(z.string().trim().min(1).max(200))
      .max(100)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const timing = value.timing;
    if (
      timing.exactSceneCount &&
      timing.sceneDurationSeconds &&
      timing.totalDurationSeconds &&
      Math.abs(
        timing.exactSceneCount * timing.sceneDurationSeconds -
          timing.totalDurationSeconds,
      ) > 0.001
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timing"],
        message: "Scene count × scene duration must equal total duration",
      });
    if (
      value.camera.angleDegrees &&
      value.camera.angleDegrees.min > value.camera.angleDegrees.max
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["camera", "angleDegrees", "min"],
        message: "Minimum camera angle cannot exceed maximum",
      });
    if (value.camera.movement === "dynamic" && value.camera.framingLocked)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["camera"],
        message: "Dynamic movement conflicts with locked framing",
      });
  });

export type ContentFormatProductionRulesV1 = z.infer<
  typeof contentFormatProductionRulesV1Schema
>;

/** Legacy string arrays stay readable; new configuration writes the versioned object. */
export const contentFormatProductionRulesSchema = z.union([
  contentFormatProductionRulesV1Schema,
  z.array(z.string().trim().min(1).max(1_000)).max(100),
]);

export function resolveContentFormatProductionRules(
  value: unknown,
): ContentFormatProductionRulesV1 {
  if (Array.isArray(value))
    return contentFormatProductionRulesV1Schema.parse({
      version: 1,
      instructions: value,
    });
  if (value == null)
    return contentFormatProductionRulesV1Schema.parse({ version: 1 });
  return contentFormatProductionRulesV1Schema.parse(value);
}

function validateFieldValue(
  field: z.infer<typeof formatInputFieldSchema>,
  value: z.infer<typeof formatInputValueSchema>,
): string | null {
  if (field.type === "string") {
    if (typeof value !== "string") return "Enter text.";
    if (field.enum && !field.enum.includes(value))
      return "Choose an available option.";
    if (field.minLength != null && value.length < field.minLength)
      return `Enter at least ${field.minLength} characters.`;
    if (field.maxLength != null && value.length > field.maxLength)
      return `Enter no more than ${field.maxLength} characters.`;
    return null;
  }
  if (field.type === "boolean")
    return typeof value === "boolean" ? null : "Choose yes or no.";
  if (typeof value !== "number" || !Number.isFinite(value))
    return "Enter a number.";
  if (field.type === "integer" && !Number.isInteger(value))
    return "Enter a whole number.";
  if (field.minimum != null && value < field.minimum)
    return `Value must be at least ${field.minimum}.`;
  if (field.maximum != null && value > field.maximum)
    return `Value must be no more than ${field.maximum}.`;
  return null;
}

export function validateFormatInputs(
  schemaInput: unknown,
  valuesInput: unknown,
):
  | { success: true; data: FormatInputs }
  | { success: false; errors: Record<string, string> } {
  const schemaResult = contentFormatInputSchema.safeParse(schemaInput);
  if (!schemaResult.success) {
    return {
      success: false,
      errors: { root: "This Content Format uses an unsupported input schema." },
    };
  }
  const valuesResult = formatInputsSchema.safeParse(valuesInput);
  if (!valuesResult.success) {
    return { success: false, errors: { root: "Format inputs are invalid." } };
  }
  const values = valuesResult.data;
  const errors: Record<string, string> = {};
  for (const name of Object.keys(values)) {
    if (!schemaResult.data.properties[name])
      errors[name] = "This field is not declared by the Content Format.";
  }
  for (const name of schemaResult.data.required) {
    const value = values[name];
    if (value === undefined || value === "")
      errors[name] = "This field is required.";
  }
  for (const [name, field] of Object.entries(schemaResult.data.properties)) {
    const value = values[name];
    if (value === undefined || value === "") continue;
    const error = validateFieldValue(field, value);
    if (error) errors[name] = error;
  }
  return Object.keys(errors).length
    ? { success: false, errors }
    : { success: true, data: values };
}
