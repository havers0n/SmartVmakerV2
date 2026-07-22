export type Status = "draft" | "active" | "archived";
export type Format = {
  id: string;
  name: string;
  slug: string;
  status: Status;
  formatType: string;
  description?: string | null;
  hookPattern?: string | null;
  structurePattern?: string | null;
  visualPattern?: string | null;
  pacingPattern?: string | null;
  notes?: string | null;
  targetDurationMinSeconds?: number | null;
  targetDurationMaxSeconds?: number | null;
  updatedAt: string;
};
export type Counts = {
  videoCount: number;
  channelCount: number;
  evidenceCount: number;
  exemplarVideoCount?: number;
};
export type Detail = {
  format: Format;
  counts: Counts;
  videos: Array<any>;
  channels: Array<any>;
  evidence: Array<any>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
const json = (method: string, body?: unknown) => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
export const contentFormatsApi = {
  list: (filters: { search?: string; status?: string; limit?: number }) =>
    request<Array<{ format: Format } & Counts>>(
      `/api/content-formats?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString()}`,
    ),
  detail: (id: string) => request<Detail>(`/api/content-formats/${id}`),
  create: (
    body: Omit<Partial<Format>, "status" | "id" | "slug" | "updatedAt">,
  ) => request<Format>("/api/content-formats", json("POST", body)),
  update: (id: string, body: Partial<Format>) =>
    request<Format>(`/api/content-formats/${id}`, json("PATCH", body)),
  activate: (id: string) =>
    request<Format>(`/api/content-formats/${id}/activate`, json("POST")),
  archive: (id: string) =>
    request<Format>(`/api/content-formats/${id}/archive`, json("POST")),
  restore: (id: string) =>
    request<Format>(`/api/content-formats/${id}/restore`, json("POST")),
  updateVideo: (id: string, videoId: string, body: unknown) =>
    request(
      `/api/content-formats/${id}/videos/${videoId}`,
      json("PATCH", body),
    ),
  deleteVideo: (id: string, videoId: string) =>
    request(`/api/content-formats/${id}/videos/${videoId}`, json("DELETE")),
  updateChannel: (id: string, channelId: string, body: unknown) =>
    request(
      `/api/content-formats/${id}/channels/${channelId}`,
      json("PATCH", body),
    ),
  deleteChannel: (id: string, channelId: string) =>
    request(`/api/content-formats/${id}/channels/${channelId}`, json("DELETE")),
  createEvidence: (id: string, body: unknown) =>
    request(`/api/content-formats/${id}/evidence`, json("POST", body)),
  updateEvidence: (id: string, evidenceId: string, body: unknown) =>
    request(
      `/api/content-formats/${id}/evidence/${evidenceId}`,
      json("PATCH", body),
    ),
  deleteEvidence: (id: string, evidenceId: string) =>
    request(
      `/api/content-formats/${id}/evidence/${evidenceId}`,
      json("DELETE"),
    ),
};
export const contentFormatKeys = {
  list: (filters: object) => ["content-formats", filters] as const,
  detail: (id: string) => ["content-format", id] as const,
};
