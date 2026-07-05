import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/db", () => ({ db: {} }));
vi.mock("@/shared/lib/schema", () => ({
  discoveryRuns: {},
  nicheQueries: {},
  niches: {},
  videoDiscoveries: {},
  youtubeChannels: {},
  youtubeVideos: {},
}));
vi.mock("@/shared/lib/youtube", () => ({ searchYouTubeForDiscovery: vi.fn() }));

import { createDiscoveryRunSchema } from "./discovery-runs";

describe("discovery run validation", () => {
  it("applies quota-conscious defaults", () => {
    expect(
      createDiscoveryRunSchema.parse({
        nicheId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toMatchObject({
      searchOrders: ["relevance", "viewCount", "date"],
      maxResultsPerQuery: 25,
    });
  });

  it("caps YouTube search results and rejects unsupported orders", () => {
    const base = { nicheId: "550e8400-e29b-41d4-a716-446655440000" };
    expect(
      createDiscoveryRunSchema.safeParse({ ...base, maxResultsPerQuery: 51 })
        .success,
    ).toBe(false);
    expect(
      createDiscoveryRunSchema.safeParse({ ...base, searchOrders: ["rating"] })
        .success,
    ).toBe(false);
  });
});
