import { HwarDeps } from '../index';
import { KeyframeJob } from './types';
import { JobHandler } from '../jobs/processor';
import { schema } from '@scrimspec/db';
import { eq, and } from 'drizzle-orm';
import { Readable } from 'stream';
import { uploadLargeStream } from '@aec/storage-client';

const KEYFRAME_NEGATIVE_PROMPT = 'no text, no captions, no subtitles, no watermarks, no titles, no interface elements, no logos, no numbers on the image, no graphic overlays';

export function createKeyframeHandler(deps: HwarDeps): JobHandler<KeyframeJob> {
    return async (job: KeyframeJob) => {
        const { db, logger, aiRouter } = deps;

        logger.info({ jobId: job.id, scene: `${job.projectId}:${job.sceneIndex}:${job.frameType}` }, 'Processing keyframe job');

        // 1. Idempotency Check & Setup
        // (Already handled partly by the job machine locking, but we need to ensure idempotency key)
        // The job passed here is already locked and "processing".

        // 2. Check for existing external ID (Recovery)
        if (job.externalId) {
            logger.warn({ jobId: job.id, externalId: job.externalId }, 'RECOVERY MODE: Job already has external ID. Skipping submission.');
            // For now, we treat this as "waiting_external" and stop.
            // In a full system, we'd poll or check status.
            // But for keyframes (mostly sync), this is an edge case or error state.
            throw new Error('Job has external_id but is in pending/processing state - inconsistent state detected');
        }

        // 3. Load Asset / Config
        const [asset] = await db
            .select()
            .from(schema.assets)
            .where(eq(schema.assets.id, job.assetId))
            .limit(1);

        if (!asset) {
            throw new Error(`Asset not found: ${job.assetId}`);
        }

        const assetMeta = asset.meta as any;
        const aspectRatio = assetMeta?.aspectRatio || '16:9';

        // Determine model
        let modelId = job.modelId;
        if (!modelId) {
            const [defaultModel] = await db
                .select()
                .from(schema.aiModels)
                .where(
                    and(
                        eq(schema.aiModels.type, 'text-to-image'),
                        eq(schema.aiModels.isDefault, true),
                        eq(schema.aiModels.isEnabled, true)
                    )
                )
                .limit(1);

            if (defaultModel) {
                modelId = defaultModel.id;
            } else {
                throw new Error('No default text-to-image model found');
            }
        }

        // 4. Submit to AI Router
        // Update stage
        await db.update(schema.keyframeJobQueue)
            .set({ stage: 'submitting', updatedAt: new Date() })
            .where(eq(schema.keyframeJobQueue.id, job.id));

        const result = await aiRouter.generateKeyframe({
            prompt: job.prompt,
            negativePrompt: KEYFRAME_NEGATIVE_PROMPT,
            aspectRatio,
            modelId,
            projectId: job.projectId,
            sceneIndex: job.sceneIndex
        });

        // 5. Handle Result
        if (result.externalId) {
            // Async provider
            await db.update(schema.keyframeJobQueue).set({
                externalId: result.externalId,
                stage: 'waiting_external',
                updatedAt: new Date()
            }).where(eq(schema.keyframeJobQueue.id, job.id));

            // We stop here for async. The job stays "processing" but stage is "waiting_external".
            // The worker loop will pick it up again? 
            // Wait, if we return successfully, the job machine marks it as "completed" or we need to signal "wait"?
            // The current simple job machine assumes return = success = completed.
            // If we want to keep it in "processing", we might need to throw a specific "Suspend" error or change return type.
            // BUT, looking at keyframe-worker.ts:
            // "If the provider returned an external ID, save it immediately... else... upload"
            // It seems keyframe-worker treats async submission as "done" for THIS tick, 
            // but then it needs to poll? 
            // Actually, keyframe-worker.ts logic for async:
            // "If externalId... Task submitted & ID saved." -> returns job.id
            // Then "Update job status to 'completed'" happens ONLY if synchronous?
            // NO. In keyframe-worker.ts:
            // If externalId -> update to waiting_external.
            // Then it falls through to "PHASE 6: UPLOAD RESULT".
            // Wait, if externalId is set, imageBuffer might be empty.
            // If imageBuffer is empty, upload will fail.
            // The current worker logic seems slightly flawed for async if it falls through.
            // Let's look at keyframe-worker.ts again.
            // It returns job.id at the end.
            // If externalId is present, it logs "Task submitted".
            // Then it calls uploadImageToR2(imageBuffer...).
            // If imageBuffer is empty, that will fail.
            // So the current worker probably assumes synchronous only for now, OR `generateImageWithModel` handles polling?
            // `generateImageWithModel` returns `{ imageBuffer, externalId }`.
            // If async, it returns externalId and NO imageBuffer (or empty).
            // So the current worker WOULD fail for async providers.
            // I will assume synchronous for now as per "Keyframe handler must... Upload returned buffer".

            // For now, if we get externalId and NO buffer, we should probably throw "Async not supported yet" 
            // or handle it properly. 
            if (result.imageBuffer.length === 0) {
                throw new Error("Async keyframe generation not fully supported in this migration yet (no polling logic)");
            }
        }

        // 6. Upload
        await db.update(schema.keyframeJobQueue)
            .set({ stage: 'uploading', updatedAt: new Date() })
            .where(eq(schema.keyframeJobQueue.id, job.id));

        const key = `keyframes/${job.projectId}/scene-${job.sceneIndex}-${job.frameType}-${Date.now()}.png`;
        const stream = Readable.from(result.imageBuffer);
        await uploadLargeStream(key, stream, 'image/png');

        // 7. Update Asset
        await db.update(schema.assets)
            .set({
                storageUrl: key,
                status: 'completed',
                updatedAt: new Date(),
            })
            .where(eq(schema.assets.id, job.assetId));

        // Job machine will mark as completed.
        // We don't need to return anything as JobHandler returns Promise<void>
    };
}