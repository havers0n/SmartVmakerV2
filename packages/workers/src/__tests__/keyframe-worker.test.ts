import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processKeyframeJob } from '../keyframe-worker';
import { getDrizzleClient, schema } from '@scrimspec/db';
import { eq } from 'drizzle-orm';

// --- MOCKS ---

// 1. Mock Storage Client (R2)
vi.mock('@aec/storage-client', () => ({
    uploadLargeStream: vi.fn().mockResolvedValue('keyframes/test/image.png'),
    R2_BUCKET: 'test-bucket',
}));

// 2. Mock Model Config
vi.mock('../lib/model-config', () => ({
    loadModelConfig: vi.fn().mockResolvedValue({
        apiKeyEnvVarName: 'TEST_API_KEY',
        providerId: 'test-provider',
        modelId: 'test-model',
        requestDefaults: {},
        apiBaseUrl: 'https://api.test.com',
        authenticationType: 'bearer_token',
        responseAdapter: {
            okPath: 'status',
            okValues: ['success'],
            dataPaths: {
                image_base64: 'data.image',
                task_id: 'data.id'
            }
        }
    }),
    deepGet: (obj: any, path: string) => {
        if (!path) return undefined;
        return path.split('.').reduce((o, k) => (o || {})[k], obj);
    },
    isOkValue: (val: any, okValues: any[]) => okValues.includes(val),
    mergeRequest: (a: any, b: any) => ({ ...a, ...b }),
}));

// 3. Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Keyframe Worker Integration', () => {
    const db = getDrizzleClient();
    let projectId: string;
    let assetId: string;

    // Setup before each test
    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.TEST_API_KEY = 'fake-key';

        // Create test project
        const [proj] = await db.insert(schema.generationProjects).values({}).returning();
        projectId = proj.id;

        // Create test asset (needed for aspect ratio lookup)
        const [asset] = await db.insert(schema.assets).values({
            generationProjectId: projectId,
            assetType: 'image',
            status: 'pending',
            storageUrl: 'placeholder/url', // Required field
            meta: { aspectRatio: '16:9' }
        }).returning();
        assetId = asset.id;
    });

    // Cleanup after each test
    afterEach(async () => {
        await db.delete(schema.generationProjects).where(eq(schema.generationProjects.id, projectId));
    });

    it('should SUBMIT a new job and save external_id', async () => {
        // 1. Arrange: Create a pending job
        const [job] = await db.insert(schema.keyframeJobQueue).values({
            projectId: projectId,
            sceneIndex: 1,
            frameType: 'first',
            assetId: assetId,
            prompt: 'Test prompt',
            modelId: 'test-model',
            status: 'pending'
        }).returning();

        // Mock fetch response for image generation
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                status: 'success',
                data: {
                    image: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
                    id: 'ext-key-123'
                }
            }),
            text: async () => ''
        });

        // 2. Act: Run worker
        await processKeyframeJob();

        // 3. Assert
        // A. Fetch called?
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.test.com',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer fake-key'
                })
            })
        );

        // B. Job completed?
        const [updatedJob] = await db.select().from(schema.keyframeJobQueue).where(eq(schema.keyframeJobQueue.id, job.id));
        expect(updatedJob.status).toBe('completed');
        expect(updatedJob.externalId).toBe('ext-key-123');

        // C. Asset updated?
        const [updatedAsset] = await db.select().from(schema.assets).where(eq(schema.assets.id, assetId));
        expect(updatedAsset.status).toBe('completed');
        expect(updatedAsset.storageUrl).toContain(`keyframes/${projectId}/scene-1-first-`);
    });

    it('should PROTECT BILLING by not calling API if external_id exists', async () => {
        // 1. Arrange: Create a job that looks like it crashed after submission (has external_id)
        const [job] = await db.insert(schema.keyframeJobQueue).values({
            projectId: projectId,
            sceneIndex: 2,
            frameType: 'last',
            assetId: assetId,
            prompt: 'Recovery prompt',
            modelId: 'test-model',
            status: 'pending',
            externalId: 'existing-ext-id-999' // <--- SIMULATE CRASH RECOVERY
        }).returning();

        // 2. Act: Run worker
        // Note: Current worker implementation throws an error in this case, which is expected behavior for now
        try {
            await processKeyframeJob();
        } catch (e) {
            // Expected error or handled by worker returning null
        }

        // 3. Assert
        // A. Fetch MUST NOT be called (Billing Protection)
        expect(mockFetch).not.toHaveBeenCalled();

        // B. Job should be in a state that reflects "we didn't run it again"
        // In current implementation, it throws error -> failed.
        // Or if we updated the worker to handle it, it might be waiting.
        // We just verify the billing protection part (no fetch).
        const [updatedJob] = await db.select().from(schema.keyframeJobQueue).where(eq(schema.keyframeJobQueue.id, job.id));

        // Verify it didn't lose the external ID
        expect(updatedJob.externalId).toBe('existing-ext-id-999');
    });
});
