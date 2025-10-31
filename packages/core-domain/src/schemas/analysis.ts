import { z } from 'zod';

/**
 * Payload schema for starting video analysis
 */
export const startAnalysisPayloadSchema = z.object({
  videoIds: z.array(z.string().uuid()).min(1, 'At least one video must be selected'),
});

export type StartAnalysisPayload = z.infer<typeof startAnalysisPayloadSchema>;
