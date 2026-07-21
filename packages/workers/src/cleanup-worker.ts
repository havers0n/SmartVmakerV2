import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// === ANTI-CRASH SHIELD ===
process.on('uncaughtException', (err) => {
    const msg = String(err);
    if (msg.includes('ECONNRESET') || msg.includes('Connection terminated') || msg.includes('57P01')) {
        console.warn('[System] DB Connection glitch intercepted. Staying alive.');
        return;
    }
    console.error('[System] CRITICAL UNCAUGHT ERROR:', err);
    process.exit(1);
});

import { createLogger } from '@aec/logger';
import { getDrizzleClient, schema } from '@scrimspec/db';
import { lt, and, eq } from 'drizzle-orm';

const logger = createLogger({ name: 'cleanup-worker' });
const STUCK_TIMEOUT_MINUTES = 15;

async function resurrectStuckJobs(queueName: string, tableObj: any) {
    const db = getDrizzleClient();
    const thresholdDate = new Date(Date.now() - STUCK_TIMEOUT_MINUTES * 60 * 1000);
    const thresholdIso = thresholdDate.toISOString();

    try {
        const stuckJobs = await db.select()
            .from(tableObj)
            .where(and(
                eq(tableObj.status, 'processing'),
                lt(tableObj.updatedAt, thresholdIso)
            ))
            .limit(50);

        if (stuckJobs.length === 0) return 0;

        logger.warn({ queue: queueName, count: stuckJobs.length }, 'Found stuck zombie jobs');

        for (const job of stuckJobs) {
            const currentRetries = job.retryCount || 0;

            // === KILL SWITCH ===
            if (currentRetries >= 3) {
                logger.error({ jobId: job.id, queue: queueName, retries: currentRetries }, 'Killing zombie job (Max retries exceeded)');

                await db.update(tableObj)
                    .set({
                        status: 'failed',
                        error: 'Max retries exceeded (Zombie detected multiple times)',
                        updatedAt: new Date().toISOString()
                    })
                    .where(eq(tableObj.id, job.id));

            } else {
                // === RESURRECT ===
                logger.info({ jobId: job.id, queue: queueName, stage: job.stage }, 'Resurrecting zombie job...');

                await db.update(tableObj)
                    .set({
                        status: 'pending',
                        retryCount: currentRetries + 1,
                        updatedAt: new Date().toISOString(),
                        error: `Resurrected by Cleanup Worker. Previous stage: ${job.stage}`,
                    })
                    .where(eq(tableObj.id, job.id));
            }
        }
        return stuckJobs.length;
    } catch (error) {
        logger.error({ err: error, queue: queueName }, 'Failed to process queue cleanup');
        return 0;
    }
}

async function main() {
    logger.info('Starting Necromancer (Cleanup Worker) with Kill Switch...');

    while (true) {
        try {
            let totalProcessed = 0;
            totalProcessed += await resurrectStuckJobs('animation_job_queue', schema.animationJobQueue);
            totalProcessed += await resurrectStuckJobs('keyframe_job_queue', schema.keyframeJobQueue);
            totalProcessed += await resurrectStuckJobs('analysis_job_queue', schema.analysisJobQueue);
            totalProcessed += await resurrectStuckJobs('ingest_job_queue', schema.ingestJobQueue);

            if (totalProcessed > 0) {
                logger.info({ count: totalProcessed }, 'Cleanup cycle complete.');
            }

            // Sleep 5 minutes
            await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        } catch (error) {
            logger.error({ err: error }, 'Cleanup worker crashed loop (restarting in 60s)');
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
}

main().catch(e => {
    logger.fatal({ err: e }, 'Fatal startup error');
    process.exit(1);
});
