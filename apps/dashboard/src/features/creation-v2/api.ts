import { z } from "zod";
import { scenarioArtifactResponseSchema } from "./model";

export class GenerationApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super("Generation request failed");
    this.name = "GenerationApiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  schema?: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new GenerationApiError(0, "NETWORK_ERROR");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new GenerationApiError(
      response.status,
      body.code,
      body.requestId,
    );
    error.message =
      typeof body.error === "string" ? body.error : "Generation request failed";
    throw error;
  }
  return schema ? schema.parse(body) : (body as T);
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const generationV2Api = {
  createProject: (body: unknown) =>
    request<any>("/api/generation/video-projects", json("POST", body)),
  getProject: (projectId: string) =>
    request<any>(`/api/generation/video-projects/${projectId}`),
  updateProject: (projectId: string, body: unknown) =>
    request<any>(
      `/api/generation/video-projects/${projectId}`,
      json("PATCH", body),
    ),
  createRun: (projectId: string, body: unknown) =>
    request<any>(
      `/api/generation/video-projects/${projectId}/runs`,
      json("POST", body),
    ),
  listRuns: (projectId: string) =>
    request<any[]>(`/api/generation/video-projects/${projectId}/runs`),
  getRun: (projectId: string, runId: string) =>
    request<any>(`/api/generation/video-projects/${projectId}/runs/${runId}`),
  enqueueAttempt: (projectId: string, runId: string, key: string) =>
    request<any>(
      `/api/generation/video-projects/${projectId}/runs/${runId}/scenario-attempts`,
      { method: "POST", headers: { "Idempotency-Key": key } },
    ),
  artifact: (projectId: string, runId: string) =>
    request(
      `/api/generation/video-projects/${projectId}/runs/${runId}/scenario-artifact`,
      undefined,
      scenarioArtifactResponseSchema,
    ),
};
