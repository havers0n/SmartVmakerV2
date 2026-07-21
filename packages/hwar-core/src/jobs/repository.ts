// packages/hwar-core/src/jobs/repository.ts

import { JobRecord, JobStage } from './types';

export interface JobRepository<J extends JobRecord> {
    /**
     * Fetches the next batch of ready jobs (pending or retryable failed), locking them for processing.
     * Should use SKIP LOCKED semantics and respect nextRetryAt if present.
     */
    fetchNextPending(batchSize: number, now: Date, maxAttempts: number): Promise<J[]>;

    /**
     * Marks job as locked/processing to ensure idempotency.
     */
    markLocked(id: string, lockedAt: Date): Promise<void>;

    /**
     * Increments attempt counter.
     */
    incrementAttempts(id: string): Promise<void>;

    /**
     * Marks a job as processing and updates its stage.
     */
    markProcessing(id: string, stage: JobStage): Promise<void>;

    /**
     * Marks a job as completed.
     */
    markCompleted(id: string, stage?: JobStage): Promise<void>;

    /**
     * Marks a job as failed with an error message.
     */
    markFailed(id: string, error: string, stage?: JobStage, nextRetryAt?: Date): Promise<void>;

    /**
     * Marks a job as permanently failed (no further retries).
     */
    markFailedPermanently(id: string, error: string, stage?: JobStage): Promise<void>;

    /**
     * Updates the stage of a job without changing its status.
     */
    updateStage(id: string, stage: JobStage): Promise<void>;

    /**
     * Returns latest job snapshot.
     */
    getById(id: string): Promise<J | null>;
}
