import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processAnalysisJob } from '../analysis-worker';
import { getDrizzleClient, schema } from '@scrimspec/db';
import { eq } from 'drizzle-orm';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('@aec/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
    }),
}));

// Mock loadModelConfig (to satisfy requirements, though currently unused in worker logic)
vi.mock('../lib/model-config', () => ({
    loadModelConfig: vi.fn().mockResolvedValue({
        apiKeyEnvVarName: 'GEMINI_API_KEY',
        apiBaseUrl: 'https://generativelanguage.googleapis.com',
    }),
}));

describe('Analysis Worker Integration', () => {
    const db = getDrizzleClient();
    let videoId: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Set env vars required by the worker
        process.env.GEMINI_API_KEY = 'test-api-key';
        process.env.GEMINI_MODEL = 'gemini-pro';

        // Create a test video
        const [video] = await db.insert(schema.youtubeVideos).values({
            url: 'https://www.youtube.com/watch?v=testvideo_' + Date.now(),
            title: 'Test Video',
            youtubeId: 'testvideo_' + Date.now(),
        }).returning();
        videoId = video.id;
    });

    afterEach(async () => {
        if (videoId) {
            await db.delete(schema.youtubeVideos).where(eq(schema.youtubeVideos.id, videoId));
        }
    });

    it('Happy Path: should call LLM, parse result, save to DB, and complete job', async () => {
        // 1. Setup Job
        const [job] = await db.insert(schema.analysisJobQueue).values({
            videoId: videoId,
            analyzer: 'gemini-pro',
            status: 'pending',
        }).returning();

        // 2. Mock LLM Response
        const mockAnalysisResult = {
            hook_text: "This is a hook",
            emotion_tags: ["happy", "exciting"],
            beats: [
                { time_s: 0, desc: "Intro", emotion: "neutral" },
                { time_s: 10, desc: "Climax", emotion: "excitement" }
            ],
            payoff: "The end",
            moral: "Be good"
        };

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify(mockAnalysisResult)
                        }]
                    }
                }]
            })
        });

        // 3. Run Worker
        await processAnalysisJob();

        // 4. Assertions
        // Check Job Status
        const [updatedJob] = await db.select().from(schema.analysisJobQueue).where(eq(schema.analysisJobQueue.id, job.id));
        expect(updatedJob.status).toBe('completed');
        expect(updatedJob.stage).toBe('completed');
        expect(updatedJob.externalId).toBeDefined();

        // Check Analysis Result
        const [result] = await db.select().from(schema.analysisResults).where(eq(schema.analysisResults.videoId, videoId));
        expect(result).toBeDefined();
        expect(result.aesBreakdown).toEqual(mockAnalysisResult);

        // Check Fetch Call
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const callArgs = mockFetch.mock.calls[0];
        expect(callArgs[0]).toContain('generativelanguage.googleapis.com');
    });

    it('Billing Protection: should recover existing job without calling LLM if result exists', async () => {
        // 1. Setup Job with existing external_id
        const externalId = 'existing-request-id';
        const [job] = await db.insert(schema.analysisJobQueue).values({
            videoId: videoId,
            analyzer: 'gemini-pro',
            status: 'pending',
            externalId: externalId
        }).returning();

        // 2. Setup existing result
        await db.insert(schema.analysisResults).values({
            videoId: videoId,
            analyzer: 'gemini-pro',
            analysisUrl: 'https://www.youtube.com/watch?v=testvideo',
            aesBreakdown: { existing: true },
            emotionalTags: ['existing'],
        });

        // 3. Run Worker
        await processAnalysisJob();

        // 4. Assertions
        expect(mockFetch).not.toHaveBeenCalled();

        const [updatedJob] = await db.select().from(schema.analysisJobQueue).where(eq(schema.analysisJobQueue.id, job.id));
        expect(updatedJob.status).toBe('completed');
    });

    it('Parsing Resilience: should fail gracefully on non-JSON response', async () => {
        // 1. Setup Job
        const [job] = await db.insert(schema.analysisJobQueue).values({
            videoId: videoId,
            analyzer: 'gemini-pro',
            status: 'pending',
        }).returning();

        // 2. Mock Invalid Response
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                candidates: [{
                    content: {
                        parts: [{
                            text: "I cannot answer this request."
                        }]
                    }
                }]
            })
        });

        // 3. Run Worker
        await processAnalysisJob();

        // 4. Assertions
        const [updatedJob] = await db.select().from(schema.analysisJobQueue).where(eq(schema.analysisJobQueue.id, job.id));
        expect(updatedJob.status).toBe('failed');
        expect(updatedJob.error).toContain('Failed to parse Gemini response as JSON'); // Or whatever error message is thrown
    });
});
