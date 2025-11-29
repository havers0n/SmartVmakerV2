import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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

async function getAnalysis(id: string): Promise<VideoAnalysisResponse | null> {
    // In a real production app, we might call the DB directly here since it's a server component,
    // but to stick to the plan and separation of concerns, we'll fetch from the API.
    // However, fetching from localhost in server components can be tricky with absolute URLs.
    // A better pattern for Server Components is to call the logic directly.
    // BUT, the user explicitly asked for "fetch('/api/videos/${id}/analysis') or wrapper".
    // Let's try to fetch from the API using the relative URL if possible, or fall back to DB logic if needed.
    // Actually, Next.js Server Components usually require absolute URLs for fetch.
    // To avoid "localhost" issues, I will duplicate the DB logic here or import it?
    // The user said: "Use App Router, server component with fetch('/api/videos/${id}/analysis') or wrapper through getVideoAnalysis(videoId)."
    // Let's assume we can fetch. If not, I'll refactor to direct DB call.
    // Wait, I can just use the DB logic directly to avoid network overhead and URL issues.
    // But the user specifically asked for the API route.
    // Let's try to use the API route pattern if I can get the base URL.
    // Actually, for simplicity and robustness in this context, I will use a direct DB call helper
    // to avoid the "absolute URL" requirement for server-side fetch.
    // Wait, the user said "Create API route... AND Create page... with fetch".
    // I should probably respect that.
    // I'll use `process.env.NEXT_PUBLIC_APP_URL` or similar if available, or just assume localhost:3000 for now?
    // No, that's risky.
    // Let's implement a helper function that shares logic, or just call the DB directly.
    // "Use Drizzle to innerJoin..." was for the API route.
    // For the page, "fetch('/api/videos/${id}/analysis')".
    // I will try to use the `headers()` to construct the URL or just use a relative path if Next.js supports it (it doesn't for server fetch).
    // Let's use the DB directly for the page data fetching to be safe and efficient, 
    // effectively treating the "API route" as an external interface and the page as an internal consumer.
    // User said: "fetch('/api/videos/${id}/analysis') OR wrapper through getVideoAnalysis(videoId)".
    // I will implement `getVideoAnalysis` helper in this file to keep it simple and robust.

    const { db } = await import('@/shared/lib/db');
    const { analysisResults, youtubeVideos } = await import('@/shared/lib/schema');
    const { eq, desc } = await import('drizzle-orm');

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

    if (result.length === 0) return null;

    const row = result[0];
    return {
        video: row.video,
        analysis: {
            ...row.analysis,
            aesBreakdown: row.analysis.aesBreakdown as AesBreakdown | null,
            emotionalTags: row.analysis.emotionalTags as string[] | null,
        },
    };
}

function formatSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default async function AnalysisDetailsPage({
    params,
}: {
    params: { id: string };
}) {
    const { id } = params;
    const data = await getAnalysis(id);

    if (!data) {
        return notFound();
    }

    const { video, analysis } = data;
    const aes = analysis?.aesBreakdown;

    return (
        <div className="container py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link
                    href="/analysis"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Analysis List
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{video.title}</h1>
                        <p className="text-muted-foreground mt-1">
                            Analyzed on {new Date(analysis?.createdAt || '').toLocaleDateString()}
                        </p>
                    </div>
                    {video.url && (
                        <Button variant="outline" asChild>
                            <a href={video.url} target="_blank" rel="noopener noreferrer">
                                Open on YouTube <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                    )}
                </div>
            </div>

            {/* AES Breakdown Cards */}
            {aes ? (
                <div className="grid gap-6 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Hook</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{aes.hook_text}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Moral</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{aes.moral}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Payoff</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{aes.payoff}</p>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="p-6 border rounded-lg bg-muted/10 text-center">
                    <p className="text-muted-foreground">No AES breakdown data available.</p>
                </div>
            )}

            {/* Timeline & Tags */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Timeline - Takes up 2 columns */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Beats Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {aes?.beats && aes.beats.length > 0 ? (
                            <div className="space-y-4">
                                {aes.beats.map((beat, index) => (
                                    <div key={index} className="flex gap-4 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                                        <div className="flex-none w-16 pt-1">
                                            <Badge variant="outline" className="font-mono">
                                                {formatSeconds(beat.time_s)}
                                            </Badge>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">{beat.emotion}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{beat.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No beats data available.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Emotion Tags - Takes up 1 column */}
                <Card>
                    <CardHeader>
                        <CardTitle>Emotion Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {(aes?.emotion_tags || analysis?.emotionalTags || []).map((tag, i) => (
                                <Badge key={i} variant="secondary">
                                    {tag}
                                </Badge>
                            ))}
                            {!(aes?.emotion_tags || analysis?.emotionalTags)?.length && (
                                <p className="text-sm text-muted-foreground">No emotion tags.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
