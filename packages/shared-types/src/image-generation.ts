import { z } from "zod";

export const frameRoleSchema = z.enum(["first", "last"]);
export const imageAttemptStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const imageGenerationTargetSchema = z
  .object({
    sceneIndex: z.number().int().min(0),
    frameRole: frameRoleSchema,
  })
  .strict();

export const enqueueImageGenerationInputSchema = z
  .object({
    approvedRevisionId: z.string().uuid(),
    targets: z.array(imageGenerationTargetSchema).min(1).max(1000).optional(),
  })
  .strict();

export const publicScenePlanSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  revisionId: z.string().uuid(),
  scenes: z.array(z.any()),
  productionPlan: z.any().nullable(),
  requiredFrames: z.array(frameRoleSchema),
  createdAt: z.string(),
});

export const publicImageGenerationRequestSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  scenePlanId: z.string().uuid(),
  targets: z.array(imageGenerationTargetSchema),
  provider: z.string(),
  modelId: z.string(),
  modelCatalogRevision: z.string().nullable(),
  settings: z.record(z.any()),
  createdAt: z.string(),
});

export const publicImageAttemptSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  requestId: z.string().uuid(),
  scenePlanId: z.string().uuid(),
  sceneIndex: z.number().int().min(0),
  frameRole: frameRoleSchema,
  attemptNumber: z.number().int().positive(),
  status: imageAttemptStatusSchema,
  prompt: z.string(),
  provider: z.string(),
  modelId: z.string(),
  failureCode: z.string().nullable(),
  failureSummary: z.string().nullable(),
  queuedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const publicImageArtifactSchema = z.object({
  id: z.string().uuid(),
  attemptId: z.string().uuid(),
  storageKey: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  checksum: z.string(),
  createdAt: z.string(),
});

export const imageGenerationStatusResponseSchema = z.object({
  requests: z.array(publicImageGenerationRequestSchema),
  attempts: z.array(
    publicImageAttemptSchema.extend({
      artifact: publicImageArtifactSchema.nullable(),
    }),
  ),
  artifacts: z.array(publicImageArtifactSchema),
});

export const enqueueImageGenerationResponseSchema = z.object({
  request: publicImageGenerationRequestSchema,
  attempts: z.array(
    publicImageAttemptSchema.extend({
      artifact: publicImageArtifactSchema.nullable(),
    }),
  ),
  idempotentReplay: z.boolean(),
});

export const retryImageAttemptResponseSchema = z.object({
  request: publicImageGenerationRequestSchema,
  attempt: publicImageAttemptSchema.extend({
    artifact: publicImageArtifactSchema.nullable(),
  }),
});

export type FrameRole = z.infer<typeof frameRoleSchema>;
export type ImageAttemptStatus = z.infer<typeof imageAttemptStatusSchema>;
export type ImageGenerationTarget = z.infer<typeof imageGenerationTargetSchema>;
export type EnqueueImageGenerationInput = z.infer<
  typeof enqueueImageGenerationInputSchema
>;
export type PublicScenePlan = z.infer<typeof publicScenePlanSchema>;
export type PublicImageGenerationRequest = z.infer<
  typeof publicImageGenerationRequestSchema
>;
export type PublicImageAttempt = z.infer<typeof publicImageAttemptSchema>;
export type PublicImageArtifact = z.infer<typeof publicImageArtifactSchema>;
export type ImageGenerationStatusResponse = z.infer<
  typeof imageGenerationStatusResponseSchema
>;
export type EnqueueImageGenerationResponse = z.infer<
  typeof enqueueImageGenerationResponseSchema
>;
export type RetryImageAttemptResponse = z.infer<
  typeof retryImageAttemptResponseSchema
>;
