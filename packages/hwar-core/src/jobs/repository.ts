// packages/hwar-core/src/jobs/repository.ts

import { JobRecord, JobStage } from './types';

export interface JobRepository<J extends JobRecord> {
    /**
     * Fetches the next batch of pending jobs, locking them for processing.
     * Should use SKIP LOCKED semantics.
     */
    fetchNextPending(batchSize: number): Promise<J[]>;

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
    markFailed(id: string, error: string, stage?: JobStage): Promise<void>;

    /**
     * Updates the stage of a job without changing its status.
     */
    updateStage(id: string, stage: JobStage): Promise<void>;
}
