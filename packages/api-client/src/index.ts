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
      listHarvests: () => fetcher(`/hwar/harvests`)
    }
  };
};
