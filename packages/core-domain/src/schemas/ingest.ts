import { z } from 'zod';

/**
 * Schema for ingest.startSearch action payload
 * Validates the input data for starting a YouTube search job
 */
export const startSearchPayloadSchema = z.object({
  query: z.string().min(3, "Query must be at least 3 characters long"),
  // В будущем можно добавить фильтры: maxResults, publishedAfter и т.д.
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
