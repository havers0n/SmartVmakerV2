import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { analysisResults, youtubeVideos } from '@/shared/lib/schema';
import { eq, desc } from 'drizzle-orm';
import {
    forbiddenResponse,
    getTrustedUserId,
    isAdminUser,
    unauthorizedResponse,
} from '@/shared/lib/auth';

export const runtime = 'nodejs';

type AesBeat = {
    desc: string;
    time_s: number;
    emotion: string;
};

type AesBreakdown = {
    beats: AesBeat[];
    moral: string;
    payoff: string;
    hook_text: string;
    emotion_tags: string[];
};

type VideoAnalysisResponse = {
    video: {
        id: string;
        title: string;
        youtubeId: string | null;
        url: string | null;
        createdAt: string;
    };
    analysis: {
        id: string;
        analyzer: string;
        createdAt: string;
        updatedAt: string;
        aesBreakdown: AesBreakdown | null;
        overallScore: string | null;
        emotionalTags: string[] | null;
        analyzerName: string | null;
        version: number;
        analysisUrl: string | null;
    } | null;
};

export async function GET(
    request: Request,
    context: { params: { id: string } }
) {
    try {
        const userId = getTrustedUserId(request);
        if (!userId) return unauthorizedResponse();
        if (!isAdminUser(userId)) return forbiddenResponse('Admin access required');

        const { id } = context.params;

        const result = await db
            .select({
                video: {
                    id: youtubeVideos.id,
                    title: youtubeVideos.title,
                    youtubeId: youtubeVideos.youtubeId,
                    url: youtubeVideos.url,
                    createdAt: youtubeVideos.createdAt,
                },
                analysis: {
                    id: analysisResults.id,
                    analyzer: analysisResults.analyzer,
                    createdAt: analysisResults.createdAt,
                    updatedAt: analysisResults.updatedAt,
                    aesBreakdown: analysisResults.aesBreakdown,
                    overallScore: analysisResults.overallScore,
                    emotionalTags: analysisResults.emotionalTags,
                    analyzerName: analysisResults.analyzerName,
                    version: analysisResults.version,
                    analysisUrl: analysisResults.analysisUrl,
                },
            })
            .from(analysisResults)
            .innerJoin(youtubeVideos, eq(analysisResults.videoId, youtubeVideos.id))
            .where(eq(youtubeVideos.id, id))
            .orderBy(desc(analysisResults.createdAt))
            .limit(1);

        if (result.length === 0) {
            return NextResponse.json({ message: 'Not found' }, { status: 404 });
        }

        const row = result[0];

        const response: VideoAnalysisResponse = {
            video: row.video,
            analysis: {
                ...row.analysis,
                aesBreakdown: row.analysis.aesBreakdown as AesBreakdown | null,
                emotionalTags: row.analysis.emotionalTags as string[] | null,
            },
        };

        return NextResponse.json<VideoAnalysisResponse>(response);
    } catch (error) {
        console.error('Error fetching analysis:', error);
        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
