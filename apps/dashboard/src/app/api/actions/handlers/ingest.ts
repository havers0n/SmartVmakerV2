import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { ingestJobQueue } from '@/shared/lib/schema';

/**
 * Validation schema for ingest.startSearch action
 * Соответствует параметрам YouTube Data API v3 Search
 */
export const startSearchPayloadSchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters'),

  // Параметры поиска YouTube API
  order: z.enum(['date', 'rating', 'relevance', 'viewCount']).optional(),
  videoDuration: z.enum(['any', 'short', 'medium', 'long']).optional(),
  maxResults: z.number().min(1).max(50).optional(),
  publishedAfter: z.string().optional(), // ISO date string
  safeSearch: z.enum(['none', 'moderate', 'strict']).optional(),
  videoDefinition: z.enum(['any', 'high', 'standard']).optional(),
  regionCode: z.string().optional(),
  relevanceLanguage: z.string().optional(),
  videoCaption: z.enum(['any', 'closedCaption', 'none']).optional(),
  videoEmbeddable: z.boolean().optional(),
  videoLicense: z.enum(['any', 'creativeCommon', 'youtube']).optional(),
  eventType: z.enum(['completed', 'live', 'upcoming']).optional(),
});

export type StartSearchPayload = z.infer<typeof startSearchPayloadSchema>;

/**
 * Handler for ingest.startSearch action
 * Creates a new job in ingest_job_queue with YouTube search parameters
 */
export async function startSearch(payload: unknown) {
  // Validate payload with Zod
  const validated = startSearchPayloadSchema.parse(payload);

  // Insert into ingestJobQueue with all YouTube API parameters
  const [job] = await db.insert(ingestJobQueue).values({
    query: validated.query,
    publishedAfter: validated.publishedAfter
      ? new Date(validated.publishedAfter).toISOString()
      : undefined,
    videoDuration: validated.videoDuration,
    maxResults: validated.maxResults ?? 25,
    orderBy: validated.order ?? 'date',
    safeSearch: validated.safeSearch ?? 'moderate',
    videoDefinition: validated.videoDefinition,
    regionCode: validated.regionCode,
    relevanceLanguage: validated.relevanceLanguage,
    videoCaption: validated.videoCaption,
    videoEmbeddable: validated.videoEmbeddable,
    videoLicense: validated.videoLicense,
    eventType: validated.eventType,
    searchType: 'video', // Always video search
    status: 'pending',
    retryCount: 0,
  }).returning();

  return {
    message: `Ingest job created: will search for "${validated.query}"`,
    jobId: job.id,
    status: job.status,
  };
}
