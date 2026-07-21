import { NextResponse } from 'next/server';
import { getDrizzleClient, desc } from '@scrimspec/db';
import { ingestJobQueue } from '@scrimspec/db';
import {
    forbiddenResponse,
    getTrustedUserId,
    isAdminUser,
    unauthorizedResponse,
} from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const userId = getTrustedUserId(request);
    if (!userId) return unauthorizedResponse();
    if (!isAdminUser(userId)) return forbiddenResponse('Admin access required');

    const db = getDrizzleClient();

    try {
        const harvests = await db
            .select({
                id: ingestJobQueue.id,
                query: ingestJobQueue.query,
                status: ingestJobQueue.status,
                createdAt: ingestJobQueue.createdAt,
                // items_found: not available in schema yet
            })
            .from(ingestJobQueue)
            .orderBy(desc(ingestJobQueue.createdAt))
            .limit(50);

        return NextResponse.json(harvests);
    } catch (error) {
        console.error('Error fetching harvests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
