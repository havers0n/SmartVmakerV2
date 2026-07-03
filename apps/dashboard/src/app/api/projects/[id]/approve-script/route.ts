import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { generationProjects, beats, assets, keyframeJobQueue } from '@/shared/lib/schema';
import { eq, asc, and } from 'drizzle-orm';
import { getTrustedUserId, unauthorizedResponse } from '@/shared/lib/auth';

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const userId = getTrustedUserId(request);
        if (!userId) return unauthorizedResponse();

        const projectId = params.id;

        // 1. Fetch Project to get templateId
        const [project] = await db
            .select()
            .from(generationProjects)
            .where(and(eq(generationProjects.id, projectId), eq(generationProjects.ownerId, userId)))
            .limit(1);

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (!project.templateId) {
            return NextResponse.json({ error: 'Project has no template assigned' }, { status: 400 });
        }

        // 2. Fetch Beats
        const projectBeats = await db
            .select()
            .from(beats)
            .where(eq(beats.templateId, project.templateId))
            .orderBy(asc(beats.order));

        if (!projectBeats || projectBeats.length === 0) {
            return NextResponse.json({ error: 'No beats found for this project template' }, { status: 400 });
        }

        // 3. Transaction: Update Project & Create Jobs
        let jobsCreated = 0;

        await db.transaction(async (tx) => {
            // Update Project Status & Stage
            await tx
                .update(generationProjects)
                .set({
                    stage: 'script_approved',
                    status: 'processing',
                    meta: {
                        ...((project.meta as object) || {}),
                        scriptApprovedAt: new Date().toISOString(),
                    },
                })
                .where(eq(generationProjects.id, projectId));

            // Create Assets & Jobs for each beat
            for (const beat of projectBeats) {
                // Create Asset
                const [newAsset] = await tx
                    .insert(assets)
                    .values({
                        generationProjectId: projectId,
                        beatId: beat.id,
                        assetType: 'keyframe',
                        status: 'pending',
                        storageUrl: '', // Placeholder
                    })
                    .returning();

                // Create Keyframe Job
                await tx.insert(keyframeJobQueue).values({
                    projectId: projectId,
                    assetId: newAsset.id,
                    sceneIndex: beat.order,
                    frameType: 'first',
                    prompt: beat.description || beat.actionPrompt || 'Scene keyframe',
                    status: 'pending',
                    stage: 'init',
                });

                jobsCreated++;
            }
        });

        return NextResponse.json({ success: true, jobsCreated });
    } catch (error) {
        console.error('Error approving script:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
