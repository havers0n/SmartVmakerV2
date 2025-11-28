import { NextResponse } from 'next/server';
import { getDrizzleClient, eq, gte, count, sum } from '@scrimspec/db';
import {
    ingestJobQueue,
    analysisJobQueue,
    keyframeJobQueue,
    animationJobQueue,
    generationProjects
} from '@scrimspec/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const db = getDrizzleClient();

    try {
        // activeHarvests: Count of ingest_job_queue where status = 'processing'
        const [activeHarvestsResult] = await db
            .select({ count: count() })
            .from(ingestJobQueue)
            .where(eq(ingestJobQueue.status, 'processing'));
        const activeHarvests = activeHarvestsResult?.count || 0;

        // analysisQueue: Count of analysis_job_queue where status = 'pending'
        const [analysisQueueResult] = await db
            .select({ count: count() })
            .from(analysisJobQueue)
            .where(eq(analysisJobQueue.status, 'pending'));
        const analysisQueue = analysisQueueResult?.count || 0;

        // pendingJobs: Sum of pending jobs in all queues
        const [ingestPending] = await db.select({ count: count() }).from(ingestJobQueue).where(eq(ingestJobQueue.status, 'pending'));
        const [analysisPending] = await db.select({ count: count() }).from(analysisJobQueue).where(eq(analysisJobQueue.status, 'pending'));
        const [keyframePending] = await db.select({ count: count() }).from(keyframeJobQueue).where(eq(keyframeJobQueue.status, 'pending'));
        const [animationPending] = await db.select({ count: count() }).from(animationJobQueue).where(eq(animationJobQueue.status, 'pending'));

        const pendingJobs = (ingestPending?.count || 0) + (analysisPending?.count || 0) + (keyframePending?.count || 0) + (animationPending?.count || 0);

        // activeWorkers: Hardcoded to 5
        const activeWorkers = 5;

        // dailyCost: Sum api_cost_usd from generation_projects where created_at > 24h ago
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [dailyCostResult] = await db
            .select({ cost: sum(generationProjects.apiCostUsd) })
            .from(generationProjects)
            .where(gte(generationProjects.createdAt, oneDayAgo.toISOString()));

        const dailyCost = Number(dailyCostResult?.cost || 0);

        return NextResponse.json({
            activeHarvests,
            analysisQueue,
            pendingJobs,
            activeWorkers,
            dailyCost
        });
    } catch (error) {
        console.error('Error fetching factory stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
