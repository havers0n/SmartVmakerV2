// packages/hwar-core/src/jobs/drizzle-adapter.ts

import { JobRecord, JobStage } from './types';
import { JobRepository } from './repository';
import { eq, inArray, and, or, isNull, lte, lt, sql } from 'drizzle-orm';
import { DbClient } from '../index';

export class DrizzleJobAdapter<T extends JobRecord> implements JobRepository<T> {
    constructor(
        private db: DbClient,
        private table: any
    ) { }

    async fetchNextPending(batchSize: number, now: Date, maxAttempts: number): Promise<T[]> {
        // Fetch pending or retryable failed jobs, respecting nextRetryAt and skipping locked
        const subquery = this.db.select({ id: this.table.id })
            .from(this.table)
            .where(
                and(
                    lt(this.table.attempts, maxAttempts),
                    or(
                        eq(this.table.status, 'pending'),
                        and(
                            eq(this.table.status, 'failed'),
                            or(isNull(this.table.nextRetryAt), lte(this.table.nextRetryAt, now))
                        ),
                    ),
                )
            )
            .orderBy(this.table.createdAt)
            .limit(batchSize)
            .for('update', { skipLocked: true });

        const jobs = await this.db.update(this.table)
            .set({
                status: 'processing',
                updatedAt: new Date(),
            })
            .where(inArray(this.table.id, subquery))
            .returning();

        return jobs as T[];
    }

    async markLocked(id: string, lockedAt: Date): Promise<void> {
        await this.db.update(this.table)
            .set({
                lockedAt,
                status: 'processing',
                updatedAt: new Date(),
            })
            .where(eq(this.table.id, id));
    }

    async incrementAttempts(id: string): Promise<void> {
        await this.db.update(this.table)
            .set({
                attempts: sql`${this.table.attempts} + 1`,
                updatedAt: new Date(),
            })
            .where(eq(this.table.id, id));
    }

    async markProcessing(id: string, stage: JobStage): Promise<void> {
        await this.db.update(this.table)
            .set({
                stage,
                updatedAt: new Date()
            })
            .where(eq(this.table.id, id));
    }

    async markCompleted(id: string, stage?: JobStage): Promise<void> {
        const update: any = {
            status: 'completed',
            updatedAt: new Date()
        };
        if (stage) update.stage = stage;

        await this.db.update(this.table)
            .set(update)
            .where(eq(this.table.id, id));
    }

    async markFailed(id: string, error: string, stage?: JobStage, nextRetryAt?: Date): Promise<void> {
        const update: any = {
            status: 'failed',
            lastError: error,
            error: error,
            errorMessage: error,
            updatedAt: new Date()
        };
        if (stage) update.stage = stage;
        if (nextRetryAt) update.nextRetryAt = nextRetryAt;

        await this.db.update(this.table)
            .set(update)
            .where(eq(this.table.id, id));
    }

    async markFailedPermanently(id: string, error: string, stage: JobStage = 'failed_permanently'): Promise<void> {
        const update: any = {
            status: 'failed',
            stage,
            lastError: error,
            error: error,
            errorMessage: error,
            nextRetryAt: null,
            updatedAt: new Date()
        };

        await this.db.update(this.table)
            .set(update)
            .where(eq(this.table.id, id));
    }

    async updateStage(id: string, stage: JobStage): Promise<void> {
        await this.db.update(this.table)
            .set({
                stage,
                updatedAt: new Date()
            })
            .where(eq(this.table.id, id));
    }

    async getById(id: string): Promise<T | null> {
        const [job] = await this.db.select()
            .from(this.table)
            .where(eq(this.table.id, id))
            .limit(1);

        return (job as T) ?? null;
    }
}
