import { NextResponse } from 'next/server';
import { getDrizzleClient, desc, eq } from '@scrimspec/db';
import { analysisJobQueue, youtubeVideos } from '@scrimspec/db';
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
        const queue = await db
            .select({
                id: analysisJobQueue.id,
                status: analysisJobQueue.status,
                createdAt: analysisJobQueue.createdAt,
                title: youtubeVideos.title,
                thumbnail: youtubeVideos.thumbnails,
                duration: youtubeVideos.durationSeconds,
                analyzer: analysisJobQueue.analyzer
            })
            .from(analysisJobQueue)
            .leftJoin(youtubeVideos, eq(analysisJobQueue.videoId, youtubeVideos.id))
            .orderBy(desc(analysisJobQueue.createdAt))
            .limit(20);

        return NextResponse.json(queue);
    } catch (error) {
        console.error('Error fetching analysis queue:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
