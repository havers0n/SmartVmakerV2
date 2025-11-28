import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDrizzleClient } from '@scrimspec/db';
import {
    generationProjects,
    analysisJobQueue,
    keyframeJobQueue,
    animationJobQueue,
    youtubeVideos,
    analysisResults
} from '@scrimspec/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

const db = getDrizzleClient();

interface PipelineStatus {
    projectId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    currentStage: string;
    stages: {
        analysis: {
            status: 'completed' | 'processing' | 'pending';
            details: string;
        };
        scripting: {
            status: 'completed' | 'processing' | 'pending';
            text: string | null;
        };
        visuals: {
            total: number;
            completed: number;
            failed: number;
            progress: number;
        };
        rendering: {
            total: number;
            completed: number;
            current_scene: number;
            progress: number;
        };
    };
    needsApproval: boolean;
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const projectId = params.id;

        // 1. Fetch Project
        const project = await db.query.generationProjects.findFirst({
            where: eq(generationProjects.id, projectId),
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // 2. Fetch Analysis Status
        let analysisStatus: PipelineStatus['stages']['analysis'] = {
            status: 'pending',
            details: 'Waiting for video analysis...',
        };

        if (project.youtubeVideoId) {
            // Find the video record first to get the UUID
            const video = await db.query.youtubeVideos.findFirst({
                where: eq(youtubeVideos.youtubeId, project.youtubeVideoId),
            });

            if (video) {
                // Check analysis queue
                const analysisJob = await db.query.analysisJobQueue.findFirst({
                    where: eq(analysisJobQueue.videoId, video.id),
                    orderBy: [desc(analysisJobQueue.createdAt)],
                });

                if (analysisJob) {
                    if (analysisJob.status === 'completed') {
                        analysisStatus.status = 'completed';
                        // Try to fetch actual results for details
                        const result = await db.query.analysisResults.findFirst({
                            where: eq(analysisResults.videoId, video.id),
                            orderBy: [desc(analysisResults.createdAt)]
                        });

                        if (result && result.aesBreakdown) {
                            // @ts-ignore
                            const breakdown = result.aesBreakdown as any;
                            const details = [];
                            if (breakdown.hook) details.push('Hook');
                            if (breakdown.build) details.push('Build');
                            if (breakdown.payoff) details.push('Payoff');
                            analysisStatus.details = `AES extracted: ${details.join(', ') || 'Complete'}`;
                        } else {
                            analysisStatus.details = 'Analysis complete';
                        }
                    } else if (analysisJob.status === 'failed') {
                        analysisStatus.status = 'pending'; // Or failed? Prompt says pending/processing/completed. Let's stick to those.
                        analysisStatus.details = `Analysis failed: ${analysisJob.errorMessage || 'Unknown error'}`;
                    } else {
                        analysisStatus.status = 'processing';
                        analysisStatus.details = `Analyzing video... (${analysisJob.stage || 'init'})`;
                    }
                }
            }
        }

        // 3. Fetch Scripting Status (Placeholder logic based on project meta/status)
        // Assuming script is stored in meta.script or similar
        const meta = project.meta as any || {};
        let scriptingStatus: PipelineStatus['stages']['scripting'] = {
            status: 'pending',
            text: null,
        };

        if (meta.script || meta.hook) {
            scriptingStatus.status = 'completed';
            scriptingStatus.text = meta.hook || meta.script?.substring(0, 100) + '...';
        } else if (analysisStatus.status === 'completed') {
            // If analysis is done but no script, we might be processing script
            scriptingStatus.status = 'processing';
            scriptingStatus.text = 'Generating script...';
        }

        // 4. Fetch Visuals Stats (Keyframes)
        const keyframeJobs = await db
            .select({
                status: keyframeJobQueue.status,
                count: sql<number>`count(*)`,
            })
            .from(keyframeJobQueue)
            .where(eq(keyframeJobQueue.projectId, projectId))
            .groupBy(keyframeJobQueue.status);

        let visualsTotal = 0;
        let visualsCompleted = 0;
        let visualsFailed = 0;

        keyframeJobs.forEach((job) => {
            const count = Number(job.count);
            visualsTotal += count;
            if (job.status === 'completed') visualsCompleted += count;
            if (job.status === 'failed') visualsFailed += count;
        });

        const visualsProgress = visualsTotal > 0 ? Math.round((visualsCompleted / visualsTotal) * 100) : 0;

        // 5. Fetch Rendering Stats (Animation)
        const animationJobs = await db
            .select({
                status: animationJobQueue.status,
                sceneIndex: animationJobQueue.sceneIndex,
                count: sql<number>`count(*)`,
            })
            .from(animationJobQueue)
            .where(eq(animationJobQueue.projectId, projectId))
            .groupBy(animationJobQueue.status, animationJobQueue.sceneIndex);

        let renderingTotal = 0;
        let renderingCompleted = 0;
        let currentScene = 0;

        animationJobs.forEach((job) => {
            const count = Number(job.count);
            renderingTotal += count;
            if (job.status === 'completed') renderingCompleted += count;
            // Estimate current scene as the max scene index that is processing or pending
            if (job.status === 'processing' || job.status === 'pending') {
                if (job.sceneIndex > currentScene) currentScene = job.sceneIndex;
            }
        });

        // If all completed, current scene is total
        if (renderingCompleted === renderingTotal && renderingTotal > 0) {
            currentScene = renderingTotal; // Or max scene index
        }

        const renderingProgress = renderingTotal > 0 ? Math.round((renderingCompleted / renderingTotal) * 100) : 0;

        // 6. Determine Overall Status and Current Stage
        let currentStage = 'Initializing';
        if (analysisStatus.status === 'processing') currentStage = 'Analyzing Video';
        else if (scriptingStatus.status === 'processing') currentStage = 'Generating Script';
        else if (visualsProgress < 100 && visualsTotal > 0) currentStage = `Generating Visuals (${visualsCompleted}/${visualsTotal})`;
        else if (renderingProgress < 100 && renderingTotal > 0) currentStage = `Rendering Video (${renderingCompleted}/${renderingTotal})`;
        else if (renderingProgress === 100 && renderingTotal > 0) currentStage = 'Ready';
        else if (analysisStatus.status === 'completed' && !visualsTotal) currentStage = 'Script Generated';

        // Needs Approval Logic
        // Example: If script is generated but we haven't started visuals? 
        // Or if explicitly flagged in DB. For now, let's say if script is done but visuals haven't started.
        const needsApproval = scriptingStatus.status === 'completed' && visualsTotal === 0;

        const response: PipelineStatus = {
            projectId,
            status: project.status as any, // Cast to match interface
            currentStage,
            stages: {
                analysis: analysisStatus,
                scripting: scriptingStatus,
                visuals: {
                    total: visualsTotal,
                    completed: visualsCompleted,
                    failed: visualsFailed,
                    progress: visualsProgress,
                },
                rendering: {
                    total: renderingTotal,
                    completed: renderingCompleted,
                    current_scene: currentScene,
                    progress: renderingProgress,
                },
            },
            needsApproval,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching pipeline status:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
