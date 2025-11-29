// packages/hwar-core/src/jobs/processor.ts

import { JobRecord } from './types';
import { JobRepository } from './repository';

export type JobHandler<J extends JobRecord> = (job: J) => Promise<void>;

/**
 * Generic tick function to process a batch of jobs.
 * Fetches pending jobs, runs the handler, and updates status.
 */
export async function runJobTick<J extends JobRecord>(
    repo: JobRepository<J>,
    handler: JobHandler<J>,
    batchSize: number = 1
): Promise<void> {
    const jobs = await repo.fetchNextPending(batchSize);

    if (jobs.length === 0) {
        return;
    }

    await Promise.all(jobs.map(async (job) => {
        try {
            await handler(job);
            // Only mark completed if the handler didn't already mark it (e.g. as failed or another stage)
            // But usually the handler just does work and throws if failed.
            // We should check if the job is still in 'processing' state or if we should auto-complete.
            // For now, simple auto-complete:
            await repo.markCompleted(job.id);
        } catch (error: any) {
            console.error(`Job ${job.id} failed:`, error);
            await repo.markFailed(job.id, error.message || String(error));
        }
    }));
}
