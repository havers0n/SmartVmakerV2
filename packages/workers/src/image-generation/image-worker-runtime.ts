import { randomUUID } from "node:crypto";
import * as schema from "@scrimspec/db";
import {
  claimImageGenerationJob,
  processImageGenerationAttempt,
  type ProviderAdapter,
  type StorageAdapter,
} from "@scrimspec/hwar-core";
import { normalizeImage } from "./image-normalizer.js";
import { recoverStaleImageJobs } from "./recovery.js";
import type { Logger } from "./shared-types.js";

export const PROVIDER_TIMEOUT_MS = 120_000;
export const SHUTDOWN_TIMEOUT_MS = PROVIDER_TIMEOUT_MS + 60_000;
export const POLL_INTERVAL_MS = 1_000;
export const ERROR_POLL_INTERVAL_MS = 5_000;
export const RECOVERY_INTERVAL_MS = 5 * 60 * 1000;

export interface ImageWorkerRuntimeOptions {
  db: any;
  provider: ProviderAdapter;
  storage: StorageAdapter;
  logger?: Logger;
  workerId?: string;
  shutdownTimeoutMs?: number;
  pollIntervalMs?: number;
  recoveryIntervalMs?: number;
}

export class ImageWorkerRuntime {
  private readonly db: any;
  private readonly provider: ProviderAdapter;
  private readonly storage: StorageAdapter;
  private readonly logger: Logger;
  private readonly workerId: string;
  private readonly shutdownTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly recoveryIntervalMs: number;

  private shutdownRequested = false;
  private currentJobPromise: Promise<void> | null = null;
  private lastRecoveryTime = 0;

  constructor(opts: ImageWorkerRuntimeOptions) {
    this.db = opts.db;
    this.provider = opts.provider;
    this.storage = opts.storage;
    this.logger = opts.logger ?? console;
    this.workerId = opts.workerId ?? randomUUID();
    this.shutdownTimeoutMs = opts.shutdownTimeoutMs ?? SHUTDOWN_TIMEOUT_MS;
    this.pollIntervalMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
    this.recoveryIntervalMs = opts.recoveryIntervalMs ?? RECOVERY_INTERVAL_MS;
  }

  getWorkerId(): string {
    return this.workerId;
  }

  isShutdownRequested(): boolean {
    return this.shutdownRequested;
  }

  requestShutdown(): void {
    if (this.shutdownRequested) return;
    this.shutdownRequested = true;
    this.logger.info?.(
      { workerId: this.workerId },
      "Image worker shutdown requested; finishing current job",
    );
  }

  private async runRecovery(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRecoveryTime < this.recoveryIntervalMs) return;
    this.lastRecoveryTime = now;

    try {
      await recoverStaleImageJobs({ db: this.db, logger: this.logger });
    } catch (error) {
      this.logger.error?.({ err: error }, "Periodic recovery failed");
    }
  }

  private async claimAndProcess(): Promise<boolean> {
    const attempt = await claimImageGenerationJob(
      this.db,
      schema,
      this.workerId,
    );
    if (!attempt) return false;

    this.logger.info?.(
      {
        attemptId: attempt.attemptId,
        sceneIndex: attempt.sceneIndex,
        frameRole: attempt.frameRole,
        provider: attempt.provider,
        modelId: attempt.modelId,
      },
      "Processing image generation attempt",
    );

    const result = await processImageGenerationAttempt(
      { db: this.db, logger: this.logger, schema, normalize: normalizeImage },
      attempt,
      this.workerId,
      this.provider,
      this.storage,
    );

    this.logger.info?.(
      {
        attemptId: result.attemptId,
        status: result.status,
        failureCode: result.failureCode,
        storageKey: result.storageKey,
      },
      "Image generation attempt completed",
    );

    return true;
  }

  async run(): Promise<void> {
    this.logger.info?.(
      { workerId: this.workerId },
      "Image worker runtime starting",
    );

    await this.runRecovery();

    while (!this.shutdownRequested) {
      try {
        const processed = await this.claimAndProcess();
        if (!processed) {
          await this.sleep(this.pollIntervalMs);
        }
        await this.runRecovery();
      } catch (error) {
        this.logger.error?.({ err: error }, "Image worker tick error");
        await this.sleep(ERROR_POLL_INTERVAL_MS);
      }
    }

    this.logger.info?.(
      { workerId: this.workerId },
      "Shutdown requested, waiting for current job to finish",
    );

    if (this.currentJobPromise) {
      await Promise.race([
        this.currentJobPromise,
        this.sleep(this.shutdownTimeoutMs),
      ]);
    }

    try {
      await (this.db as any).$client?.end?.();
    } catch {
      // ignore
    }

    this.logger.info?.(
      { workerId: this.workerId },
      "Image worker runtime stopped",
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
