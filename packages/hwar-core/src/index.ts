// packages/hwar-core/src/index.ts

import {
  analysisJobQueue,
  analysisResults,
  keyframeJobQueue,
} from "@scrimspec/db";
import { DrizzleJobAdapter } from "./jobs/drizzle-adapter";
import { runJobTick } from "./jobs/processor";
import { createAnalysisHandler, AnalysisJob } from "./analysis/handler";
import { createKeyframeHandler } from "./keyframes/handler";
import { KeyframeJob } from "./keyframes/types";
import { eq, desc } from "drizzle-orm";

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
  logger?: Logger;
  aiRouter: any; // позже можно сузить до AiRouter
  storage: StorageClient;
};

export type HwarCoreConfig = {
  enableIngest?: boolean;
  enableGeneration?: boolean;
  enableAnimation?: boolean;
  enableAssets?: boolean;
  enableAnalysis?: boolean;
  enableKeyframes?: boolean;
};

const defaultConfig: Required<HwarCoreConfig> = {
  enableIngest: false,
  enableGeneration: false,
  enableAnimation: false,
  enableAssets: false,
  enableAnalysis: true,
  enableKeyframes: true,
};

const parseEnvBool = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined;
  return value === "1" || value.toLowerCase() === "true";
};

export function createHwarCoreConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): HwarCoreConfig {
  return {
    enableIngest: parseEnvBool(env.HWAR_ENABLE_INGEST),
    enableGeneration: parseEnvBool(env.HWAR_ENABLE_GENERATION),
    enableAnimation: parseEnvBool(env.HWAR_ENABLE_ANIMATION),
    enableAssets: parseEnvBool(env.HWAR_ENABLE_ASSETS),
    enableAnalysis: parseEnvBool(env.HWAR_ENABLE_ANALYSIS),
    enableKeyframes: parseEnvBool(env.HWAR_ENABLE_KEYFRAMES),
  };
}

type DisabledStatus = { status: "disabled" };
type DisabledTickResult = { status: "disabled"; processed: 0 };

const getLogger = (logger?: Logger) => logger ?? console;

function createDisabledAnalysis(deps: HwarDeps) {
  const logger = getLogger(deps.logger);
  return {
    enqueueForVideos: async (): Promise<DisabledStatus> => {
      logger?.warn?.(
        "[analysis.enqueueForVideos] disabled – subsystem disabled by config",
      );
      return { status: "disabled" };
    },
    runTick: async (): Promise<DisabledTickResult> => {
      logger?.debug?.(
        "[analysis.runTick] no-op – subsystem disabled by config",
      );
      return { status: "disabled", processed: 0 };
    },
    getJobStatus: async (): Promise<DisabledStatus> => {
      return { status: "disabled" };
    },
    getLatestResultForVideo: async (): Promise<DisabledStatus> => {
      return { status: "disabled" };
    },
  };
}

function createDisabledKeyframes(deps: HwarDeps) {
  const logger = getLogger(deps.logger);
  return {
    enqueueForProject: async (): Promise<DisabledStatus> => {
      logger?.warn?.(
        "[keyframes.enqueueForProject] disabled – subsystem disabled by config",
      );
      return { status: "disabled" };
    },
    runTick: async (): Promise<DisabledTickResult> => {
      logger?.debug?.(
        "[keyframes.runTick] no-op – subsystem disabled by config",
      );
      return { status: "disabled", processed: 0 };
    },
    getJobStatus: async (): Promise<DisabledStatus> => {
      return { status: "disabled" };
    },
  };
}

function createDisabledIngest(deps: HwarDeps) {
  const logger = getLogger(deps.logger);
  return {
    enqueueJob: async (): Promise<DisabledStatus> => {
      logger?.warn?.("[ingest.enqueueJob] disabled – subsystem NYI");
      return { status: "disabled" };
    },
    runTick: async (): Promise<DisabledTickResult> => {
      logger?.debug?.("[ingest.runTick] no-op – subsystem disabled");
      return { status: "disabled", processed: 0 };
    },
    getJobStatus: async (): Promise<DisabledStatus> => {
      return { status: "disabled" };
    },
  };
}

function createDisabledGeneration(deps: HwarDeps) {
  const logger = getLogger(deps.logger);
  return {
    createProjectFromAnalysis: async (): Promise<DisabledStatus> => {
      logger?.warn?.(
        "[generation.createProjectFromAnalysis] disabled – subsystem NYI",
      );
      return { status: "disabled" };
    },
    runTick: async (): Promise<DisabledTickResult> => {
      logger?.debug?.("[generation.runTick] no-op – subsystem disabled");
      return { status: "disabled", processed: 0 };
    },
    getProjectStatus: async (): Promise<DisabledStatus> => {
      return { status: "disabled" };
    },
  };
}

function createDisabledAnimation(deps: HwarDeps) {
  const logger = getLogger(deps.logger);
  return {
    enqueueForProject: async (): Promise<DisabledStatus> => {
      logger?.warn?.("[animation.enqueueForProject] disabled – subsystem NYI");
      return { status: "disabled" };
    },
    runTick: async (): Promise<DisabledTickResult> => {
      logger?.debug?.("[animation.runTick] no-op – subsystem disabled");
      return { status: "disabled", processed: 0 };
    },
    getJobStatus: async (): Promise<DisabledStatus> => {
      return { status: "disabled" };
    },
  };
}

function createDisabledAssets(deps: HwarDeps) {
  const logger = getLogger(deps.logger);
  return {
    listForProject: async (): Promise<DisabledStatus> => {
      logger?.warn?.("[assets.listForProject] disabled – subsystem NYI");
      return { status: "disabled" };
    },
    getById: async (): Promise<DisabledStatus> => {
      logger?.warn?.("[assets.getById] disabled – subsystem NYI");
      return { status: "disabled" };
    },
  };
}

// ПУБЛИЧНЫЙ ФАСАД HWAR
export function createHwarCore(
  deps: HwarDeps,
  cfg: HwarCoreConfig = defaultConfig,
) {
  const config: Required<HwarCoreConfig> = {
    ...defaultConfig,
    ...cfg,
  };

  const ingest = config.enableIngest
    ? createDisabledIngest(deps) // реальной имплементации пока нет, оставляем безопасный stub
    : createDisabledIngest(deps);
  const generation = config.enableGeneration
    ? createDisabledGeneration(deps) // нет реализации
    : createDisabledGeneration(deps);
  const animation = config.enableAnimation
    ? createDisabledAnimation(deps) // нет реализации
    : createDisabledAnimation(deps);
  const assets = config.enableAssets
    ? createDisabledAssets(deps) // нет реализации
    : createDisabledAssets(deps);

  const analysis = config.enableAnalysis
    ? {
        enqueueForVideos: async (
          videoIds: string[],
          analyzer: string = "gemini-pro",
        ) => {
          if (videoIds.length === 0) return;

          await deps.db
            .insert(analysisJobQueue)
            .values(
              videoIds.map((id) => ({
                videoId: id,
                analyzer,
                status: "pending",
                stage: "init",
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
          await runJobTick(repo, handler, {
            batchSize: 1,
            concurrency: 1,
            logger: deps.logger,
          });
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
            .orderBy(desc(analysisResults.createdAt))
            .limit(1);
          return result;
        },
      }
    : createDisabledAnalysis(deps);

  const keyframes = config.enableKeyframes
    ? {
        enqueueForProject: async (
          projectId: string,
          sceneIndex: number,
          frameType: "first" | "last",
          prompt: string,
          assetId: string,
          modelId?: string,
        ) => {
          await deps.db
            .insert(keyframeJobQueue)
            .values({
              projectId,
              sceneIndex,
              frameType,
              prompt,
              assetId,
              modelId,
              status: "pending",
              stage: "init",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoNothing();
        },
        runTick: async () => {
          const repo = new DrizzleJobAdapter<KeyframeJob>(
            deps.db,
            keyframeJobQueue,
          );
          const handler = createKeyframeHandler(deps);
          await runJobTick(repo, handler, {
            batchSize: 1,
            concurrency: 1,
            logger: deps.logger,
          });
        },
        getJobStatus: async (jobId: string) => {
          const [job] = await deps.db
            .select()
            .from(keyframeJobQueue)
            .where(eq(keyframeJobQueue.id, jobId));
          return job;
        },
      }
    : createDisabledKeyframes(deps);

  return {
    config,
    ingestEnabled: config.enableIngest,
    generationEnabled: config.enableGeneration,
    animationEnabled: config.enableAnimation,
    assetsEnabled: config.enableAssets,
    analysisEnabled: config.enableAnalysis,
    keyframesEnabled: config.enableKeyframes,
    ingest,
    analysis,
    generation,
    keyframes,
    animation,
    assets,
  };
}

// Явно экспортируем только то, что реально нужно наружу:

export { DefaultAiRouter } from "./ai/default-router";
export type { AiRouter } from "./ai/router";
// Если хочешь – можешь дополнительно вывести наружу I/O-типы анализа:
export type {
  AnalyzeVideoInput,
  AnalyzeVideoOutput,
  AnimationJobStatus,
  AnimationKeyframe,
  GenerateAnimationInput,
  GenerateAnimationOutput,
} from "./ai/types";
export * from "./types/generation";
export * from "./image-generation/index";
