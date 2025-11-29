// packages/hwar-core/src/index.ts

import {
    analysisJobQueue,
    analysisResults,
} from '@scrimspec/db';
import { DrizzleJobAdapter } from './jobs/drizzle-adapter';
import { runJobTick } from './jobs/processor';
import { createAnalysisHandler, AnalysisJob } from './analysis/handler';
import { eq } from 'drizzle-orm';

// --- ВАЖНО: убираем "export *" наружу ---
// export * from './jobs';
// export * from './ai';
// export * from './analysis/handler';

// Оставляем технические типы, они нужны drizzle-adapter'у
export type DbClient = any;
export type Logger = any;
export type StorageClient = any;

export type HwarDeps = {
    db: DbClient;
    logger: Logger;
    aiRouter: any; // позже можно сузить до AiRouter
    storage: StorageClient;
};

// ПУБЛИЧНЫЙ ФАСАД HWAR
export function createHwarCore(deps: HwarDeps) {
    return {
        ingest: {
            enqueueJob: async () => {
                throw new Error('NYI');
            },
            runTick: async () => {
                throw new Error('NYI');
            },
            getJobStatus: async () => {
                throw new Error('NYI');
            },
        },

        analysis: {
            enqueueForVideos: async (
                videoIds: string[],
                analyzer: string = 'gemini-pro',
            ) => {
                if (videoIds.length === 0) return;

                await deps.db
                    .insert(analysisJobQueue)
                    .values(
                        videoIds.map((id) => ({
                            videoId: id,
                            analyzer,
                            status: 'pending',
                            stage: 'init',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        })),
                    )
                    .onConflictDoNothing();
            },

            runTick: async () => {
                const repo = new DrizzleJobAdapter<AnalysisJob>(
                    deps.db,
                    analysisJobQueue,
                );
                const handler = createAnalysisHandler(deps);
                await runJobTick(repo, handler, 1);
            },

            getJobStatus: async (jobId: string) => {
                const [job] = await deps.db
                    .select()
                    .from(analysisJobQueue)
                    .where(eq(analysisJobQueue.id, jobId));
                return job;
            },

            getLatestResultForVideo: async (videoId: string) => {
                const [result] = await deps.db
                    .select()
                    .from(analysisResults)
                    .where(eq(analysisResults.videoId, videoId))
                    .orderBy(analysisResults.createdAt) // TODO: desc?
                    .limit(1);
                return result;
            },
        },

        generation: {
            createProjectFromAnalysis: async () => {
                throw new Error('NYI');
            },
            runTick: async () => {
                throw new Error('NYI');
            },
            getProjectStatus: async () => {
                throw new Error('NYI');
            },
        },

        keyframes: {
            enqueueForProject: async () => {
                throw new Error('NYI');
            },
            runTick: async () => {
                throw new Error('NYI');
            },
            getJobStatus: async () => {
                throw new Error('NYI');
            },
        },

        animation: {
            enqueueForProject: async () => {
                throw new Error('NYI');
            },
            runTick: async () => {
                throw new Error('NYI');
            },
            getJobStatus: async () => {
                throw new Error('NYI');
            },
        },

        assets: {
            listForProject: async () => {
                throw new Error('NYI');
            },
            getById: async () => {
                throw new Error('NYI');
            },
        },
    };
}

// Явно экспортируем только то, что реально нужно наружу:

export { DefaultAiRouter } from './ai/default-router';
export type { AiRouter } from './ai/router';
// Если хочешь – можешь дополнительно вывести наружу I/O-типы анализа:
export type {
    AnalyzeVideoInput,
    AnalyzeVideoOutput,
} from './ai/types';
