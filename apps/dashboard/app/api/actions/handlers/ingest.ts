import { db } from '@/shared/lib/db';
import { ingestJobQueue } from '@/shared/lib/schema';
import { startSearchPayloadSchema, type StartSearchPayload, type StartSearchResponse } from '@scrimspec/core-domain/schemas/ingest';

/**
 * Handler for ingest.startSearch action
 * Creates a new YouTube ingestion job in the database
 */
export async function startSearch(payload: unknown): Promise<StartSearchResponse> {
  // 1. Валидация
  const validatedPayload = startSearchPayloadSchema.parse(payload);

  // 2. Бизнес-логика (очень простая)
  const [newJob] = await db
    .insert(ingestJobQueue)
    .values({
      query: validatedPayload.query,
      status: 'pending',
      retry_count: 0,
    })
    .returning({ id: ingestJobQueue.id });

  // 3. Ответ
  return {
    message: "Ingest job started successfully",
    jobId: newJob.id,
  };
}
