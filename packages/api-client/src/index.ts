export type Fetcher = (path: string, init?: RequestInit) => Promise<any>;

export const makeClient = (base = "/api") => {
  const fetcher: Fetcher = async (path, init) => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      cache: 'no-store' as RequestCache
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  return {
    hwar: {
      // Create pages methods
      createScenario: (body: unknown) =>
        fetcher(`/hwar/scenarios`, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      listProjects: () => fetcher(`/hwar/projects`),
      getProject: (id: string) => fetcher(`/hwar/projects/${id}`),
      createProject: (body: unknown) =>
        fetcher(`/hwar/projects`, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      updateProject: (id: string, body: unknown) =>
        fetcher(`/hwar/projects/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      generateScenarios: (projectId: string, body: unknown) =>
        fetcher(`/hwar/projects/${projectId}/scenarios/generate`, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      
      // Factory methods
      listFactoryStats: () => fetcher(`/hwar/factory/stats`),
      listHarvests: () => fetcher(`/hwar/harvests`),
      getHarvest: (id: string) => fetcher(`/hwar/harvests/${id}`),
      createHarvest: (body: { query: string; lang?: string; limit?: number }) =>
        fetcher(`/hwar/harvests`, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      listAnalysisTasks: () => fetcher(`/hwar/analysis`),
      getAnalysisTask: (id: string) => fetcher(`/hwar/analysis/${id}`),
      listQueues: () => fetcher(`/hwar/queues`),
      listWorkers: () => fetcher(`/hwar/workers`),
      updateWorker: (id: string, body: { status?: string; concurrency?: number; dailyLimitUsd?: number }) =>
        fetcher(`/hwar/workers/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      listBatches: () => fetcher(`/hwar/batches`),
      
      // Library methods
      listPresets: () => fetcher(`/hwar/presets`),
      createPreset: (body: { name: string; description?: string; theme?: string; emotions?: string[]; examplePrompt?: string; meta?: Record<string, any> }) =>
        fetcher(`/hwar/presets`, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      listCharacters: () => fetcher(`/hwar/characters`),
      createCharacter: (body: { name: string; description?: string; referenceImages?: string[]; styleRules?: string; tags?: string[]; meta?: Record<string, any> }) =>
        fetcher(`/hwar/characters`, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      listDatasets: () => fetcher(`/hwar/datasets`),
      listTemplates: () => fetcher(`/hwar/templates`)
    }
  };
};

export type Client = ReturnType<typeof makeClient>;
export const client = makeClient();