export type Fetcher = (path: string, init?: RequestInit) => Promise<any>;

export const makeClient = (base = "/api") => {
  const fetcher: Fetcher = async (path, init) => {
    const res = await fetch(`${base}${path}`, { ...init, next: { revalidate: 0 } });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  return {
    hwar: {
      createScenario: (body: unknown) =>
        fetcher(`/hwar/scenarios`, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
      listHarvests: () => fetcher(`/hwar/harvests`),
      // Added methods for Create pages
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
        })
    }
  };
};