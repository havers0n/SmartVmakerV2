import { getDrizzleClient } from "@scrimspec/db";
import * as schema from "@scrimspec/db";
import {
  claimImageGenerationJob,
  processImageGenerationAttempt,
  type ProviderAdapter,
  type StorageAdapter,
} from "@scrimspec/hwar-core";

export interface ImageWorkerDeps {
  db?: any;
  workerId: string;
  provider: ProviderAdapter;
  storage: StorageAdapter;
  logger?: any;
}

const defaultLogger = {
  info: (...args: any[]) => console.log("[image-worker]", ...args),
  warn: (...args: any[]) => console.warn("[image-worker]", ...args),
  error: (...args: any[]) => console.error("[image-worker]", ...args),
  fatal: (...args: any[]) => console.error("[image-worker FATAL]", ...args),
  debug: (..._args: any[]) => {},
};

export async function processNextImageJob(
  deps: ImageWorkerDeps,
): Promise<{ processed: boolean }> {
  const log = deps.logger ?? defaultLogger;
  const db = deps.db ?? getDrizzleClient();

  const attempt = await claimImageGenerationJob(db, null, deps.workerId);
  if (!attempt) return { processed: false };

  log.info(
    {
      attemptId: attempt.attemptId,
      sceneIndex: attempt.sceneIndex,
      frameRole: attempt.frameRole,
    },
    "Processing image generation attempt",
  );

  const result = await processImageGenerationAttempt(
    { db, logger: log, schema },
    attempt,
    deps.provider,
    deps.storage,
  );

  log.info(
    {
      attemptId: result.attemptId,
      status: result.status,
      storageKey: result.storageKey,
    },
    "Image generation attempt completed",
  );

  return { processed: true };
}

export async function runImageWorkerLoop(deps: ImageWorkerDeps): Promise<void> {
  const log = deps.logger ?? defaultLogger;

  log.info({ workerId: deps.workerId }, "Image worker starting");

  while (true) {
    try {
      const result = await processNextImageJob(deps);
      if (!result.processed) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      log.error({ err: error }, "Image worker tick error");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
