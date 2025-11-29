// packages/hwar-core/src/jobs/drizzle-adapter.ts

import { JobRecord, JobStage } from './types';
import { JobRepository } from './repository';
import { eq, inArray } from 'drizzle-orm';
import { DbClient } from '../index';

export class DrizzleJobAdapter<T extends JobRecord> implements JobRepository<T> {
    constructor(
        private db: DbClient,
        private table: any
    ) { }

    async fetchNextPending(batchSize: number): Promise<T[]> {
        // Use a subquery with FOR UPDATE SKIP LOCKED to find pending jobs safely
        const subquery = this.db.select({ id: this.table.id })
            .from(this.table)
            .where(eq(this.table.status, 'pending'))
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

    async markFailed(id: string, error: string, stage?: JobStage): Promise<void> {
        const update: any = {
            status: 'failed',
            error: error,
            errorMessage: error,
            updatedAt: new Date()
        };
        if (stage) update.stage = stage;

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
}
