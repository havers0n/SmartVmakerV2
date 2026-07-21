// packages/hwar-core/src/jobs/processor.ts

import { JobRecord } from './types';
import { JobRepository } from './repository';

export type JobHandler<J extends JobRecord> = (job: J) => Promise<void>;

type LoggerLike = {
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
};

export type RunJobOptions = {
    batchSize?: number;
    concurrency?: number;
    logger?: LoggerLike;
    retryDelayMs?: (attempts: number) => number;
    maxAttempts?: number;
};

const defaultRetryDelay = (attempts: number) => {
    // exponential backoff with cap at 5 minutes
    const delay = Math.pow(2, Math.max(attempts - 1, 0)) * 1000;
    return Math.min(delay, 5 * 60 * 1000);
};

const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Generic tick function to process a batch of jobs with idempotent locking,
 * attempt tracking and bounded concurrency.
 */
export async function runJobTick<J extends JobRecord>(
    repo: JobRepository<J>,
    handler: JobHandler<J>,
    options: RunJobOptions = {}
): Promise<void> {
    const batchSize = options.batchSize ?? 1;
    const concurrency = Math.max(1, options.concurrency ?? batchSize);
    const logger = options.logger ?? console;
    const retryDelayMs = options.retryDelayMs ?? defaultRetryDelay;
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

    const now = new Date();
    const jobs = await repo.fetchNextPending(batchSize, now, maxAttempts);
    if (jobs.length === 0) return;

    const processJob = async (job: J) => {
        const lockedAt = new Date();
        await repo.markLocked(job.id, lockedAt);
        await repo.incrementAttempts(job.id);

        try {
            await handler(job);

            const latest = await repo.getById(job.id);
            if (latest && latest.status === 'processing') {
                await repo.markCompleted(job.id, latest.stage);
            }
        } catch (error: any) {
            const latest = await repo.getById(job.id);
            const stage = latest?.stage ?? job.stage;

            // Check if it's a SuspendJobError (using name check for cross-package/module compatibility)
            if (error?.name === 'SuspendJobError' || error.constructor?.name === 'SuspendJobError') {
                const retryAt = error.retryAt || new Date(Date.now() + 60000);
                if (logger?.warn) {
                    logger.warn({ jobId: job.id, retryAt, reason: error.message }, 'Job suspended, will retry later');
                }
                // We don't decrement attempts here, but we mark it as failed (which resets status to 'failed' or similar)
                // and sets the nextRetryAt.
                await repo.markFailed(job.id, error.message, stage, retryAt);
                return;
            }

            const message = error?.message ?? String(error);
            if (logger?.error) {
                logger.error({ jobId: job.id, error }, 'Job handler failed');
            }

            const attempts = latest?.attempts ?? (job.attempts + 1);

            if (attempts >= maxAttempts) {
                await repo.markFailedPermanently(job.id, message, 'failed_permanently');
            } else {
                const nextRetryAt = new Date(Date.now() + retryDelayMs(attempts));
                await repo.markFailed(job.id, message, stage, nextRetryAt);
            }
        }
    };

    for (let i = 0; i < jobs.length; i += concurrency) {
        const chunk = jobs.slice(i, i + concurrency);
        await Promise.all(chunk.map((job) => processJob(job)));
    }
}
