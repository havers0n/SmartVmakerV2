import { z } from 'zod';

/**
 * Schema for ingest.startSearch action payload
 * Validates the input data for starting a YouTube search job
 */
export const startSearchPayloadSchema = z.object({
  query: z.string().min(3),
  maxResults: z.number().min(1).max(50).optional(),
  regionCode: z.string().length(2).optional(),
  relevanceLanguage: z.string().optional(),
  safeSearch: z.enum(['none', 'moderate', 'strict']).optional(),
  order: z.enum(['date', 'rating', 'relevance', 'title', 'videoCount', 'viewCount']).optional(),
  type: z.enum(['video', 'channel', 'playlist']).optional(),
  publishedAfter: z.string().datetime({ offset: true }).optional(),
  publishedBefore: z.string().datetime({ offset: true }).optional(),
  videoDuration: z.enum(['short', 'medium', 'long', 'any']).optional(),
  videoDefinition: z.enum(['any', 'high', 'standard']).optional(),
  videoCaption: z.enum(['any', 'closedCaption', 'none']).optional(),
  videoEmbeddable: z.boolean().optional(),
  videoLicense: z.enum(['youtube', 'creativeCommon']).optional(),
  eventType: z.enum(['completed', 'live', 'upcoming']).optional(),
});

export type StartSearchPayload = z.infer<typeof startSearchPayloadSchema>;

/**
 * Response schema for ingest.startSearch action
 */
export const startSearchResponseSchema = z.object({
  message: z.string(),
  jobId: z.string(),
});

export type StartSearchResponse = z.infer<typeof startSearchResponseSchema>;
