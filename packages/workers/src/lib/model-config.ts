import { and, eq } from "drizzle-orm";
import { getDrizzleClient, schema } from "@scrimspec/db";

type AnyJson = Record<string, any>;

export interface ModelConfig {
  modelId: string;
  providerId: string;
  apiBaseUrl?: string | null;
  apiKeyEnvVarName: string;
  authenticationType: string;
  requestDefaults?: AnyJson | null;
  responseAdapter?: {
    okPath?: string;
    okValues?: (string | number | boolean)[];
    errorPath?: string;
    dataPaths?: Record<string, string>;
  } | null;
}

/**
 * Load model configuration from database including provider settings
 */
export async function loadModelConfig(modelId: string): Promise<ModelConfig> {
  const db = getDrizzleClient();

  const [row] = await db
    .select({
      modelId: schema.aiModels.id,
      providerId: schema.aiModels.providerId,
      apiBaseUrl: schema.aiProviders.apiBaseUrl,
      apiKeyEnvVarName: schema.aiProviders.apiKeyEnvVarName,
      authenticationType: schema.aiProviders.authenticationType,
      requestDefaults: schema.aiModels.requestDefaults,
      responseAdapter: schema.aiModels.responseAdapter,
    })
    .from(schema.aiModels)
    .leftJoin(
      schema.aiProviders,
      eq(schema.aiModels.providerId, schema.aiProviders.id)
    )
    .where(and(eq(schema.aiModels.id, modelId), eq(schema.aiModels.isEnabled, true)))
    .limit(1);

  if (!row) {
    throw new Error(`Model ${modelId} not found or disabled`);
  }

  return {
    modelId: row.modelId,
    providerId: row.providerId,
    apiBaseUrl: row.apiBaseUrl,
    apiKeyEnvVarName: row.apiKeyEnvVarName!,
    authenticationType: row.authenticationType!,
    requestDefaults: (row.requestDefaults as AnyJson) ?? null,
    responseAdapter: (row.responseAdapter as AnyJson) ?? null,
  };
}

/**
 * Deep get value from nested object using dot notation path
 * Supports array indices: "data.0.url"
 */
export function deepGet(obj: any, path?: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    const idx = Number.isInteger(+p) ? +p : (p as keyof typeof cur);
    cur = (cur as any)[idx];
  }
  return cur;
}

/**
 * Check if response value indicates success
 */
export function isOkValue(val: unknown, okValues?: (string | number | boolean)[]): boolean {
  if (okValues && okValues.length) return okValues.includes(val as any);

  // Default heuristics when okValues not specified
  if (typeof val === "string") {
    const s = val.toLowerCase();
    return s === "ok" || s === "success" || s === "succeed" || s === "succeeded";
  }
  if (typeof val === "number") return val === 0 || val === 200;
  if (typeof val === "boolean") return val === true;

  // If no okPath specified, consider ok and validate by data presence
  return true;
}

/**
 * Merge request defaults with specific request params
 * Specific params take priority over defaults
 */
export function mergeRequest<T extends Record<string, any>>(
  base: T,
  requestDefaults?: AnyJson | null
): T {
  if (!requestDefaults) return base;
  return { ...requestDefaults, ...base } as T;
}
