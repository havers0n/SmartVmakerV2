import type { ImageMeta } from "./image-meta";

export interface ImageGenerationTarget {
  sceneIndex: number;
  frameRole: "first" | "last";
}

export interface ImageAttemptWithJob {
  attemptId: string;
  runId: string;
  scenePlanId: string;
  sceneIndex: number;
  frameRole: "first" | "last";
  attemptNumber: number;
  status: string;
  prompt: string;
  provider: string;
  modelId: string;
  settings: Record<string, unknown>;
  failureCode: string | null;
  failureSummary: string | null;
  queueJobId: string;
  queueStatus: string;
}

export interface ProviderAdapter {
  generate(prompt: string, settings: Record<string, unknown>): Promise<Buffer>;
}

export interface StorageAdapter {
  put(key: string, buffer: Buffer, mimeType: string): Promise<{ key: string }>;
  delete(key: string): Promise<void>;
}

export interface ProcessAttemptResult {
  status: "succeeded" | "failed";
  attemptId: string;
  meta?: ImageMeta;
  storageKey?: string;
  failureCode?: string;
  failureSummary?: string;
  diagnostics?: Record<string, unknown>;
}

export type { ImageMeta } from "./image-meta";
export { ImageValidationError } from "./image-meta";
