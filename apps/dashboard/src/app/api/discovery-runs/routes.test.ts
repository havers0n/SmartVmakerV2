import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list, POST as create } from "./route";
import { GET as getRun } from "./[id]/route";
import { GET as getVideos } from "./[id]/videos/route";
import { GET as getChannels } from "./[id]/channels/route";
import {
  createDiscoveryRun,
  getDiscoveryRun,
  getDiscoveryRunProgress,
  listDiscoveryRuns,
  listDiscoveryRunVideos,
  listDiscoveryRunChannels,
} from "@/server/discovery-runs";

vi.mock("@/server/discovery-runs", () => ({
  createDiscoveryRun: vi.fn(),
  DiscoveryRunError: class DiscoveryRunError extends Error {
    constructor(
      message: string,
      public runId: string,
    ) {
      super(message);
    }
  },
  getDiscoveryRun: vi.fn(),
  getDiscoveryRunProgress: vi.fn(),
  listDiscoveryRuns: vi.fn(),
  listDiscoveryRunVideos: vi.fn(),
  listDiscoveryRunChannels: vi.fn(),
  discoveryChannelFiltersSchema: {
    parse: vi.fn((value) => value),
  },
}));

const id = "550e8400-e29b-41d4-a716-446655440000";
const context = { params: { id } };

describe("discovery run API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts a run", async () => {
    vi.mocked(createDiscoveryRun).mockResolvedValue({
      id,
      status: "completed",
    } as never);
    const response = await create(
      new Request("http://localhost/api/discovery-runs", {
        method: "POST",
        body: JSON.stringify({ nicheId: id }),
      }),
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ id, status: "completed" });
  });

  it("lists runs for a niche", async () => {
    vi.mocked(listDiscoveryRuns).mockResolvedValue([{ id }] as never);
    const response = await list(
      new Request(`http://localhost/api/discovery-runs?nicheId=${id}`),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(1);
  });

  it("returns run counts and evidence videos", async () => {
    vi.mocked(getDiscoveryRunProgress).mockResolvedValue({
      id,
      videoCount: 2,
      uniqueChannelCount: 1,
    } as never);
    vi.mocked(getDiscoveryRun).mockResolvedValue({ id } as never);
    vi.mocked(listDiscoveryRunVideos).mockResolvedValue([
      { videoId: "video-1" },
    ] as never);
    expect(
      (await getRun(new Request("http://localhost"), context)).status,
    ).toBe(200);
    const videosResponse = await getVideos(
      new Request("http://localhost"),
      context,
    );
    expect(await videosResponse.json()).toHaveLength(1);
  });

  it("returns channels and rejects an unknown run", async () => {
    vi.mocked(getDiscoveryRun).mockResolvedValue({ id } as never);
    vi.mocked(listDiscoveryRunChannels).mockResolvedValue([
      { channelId: "UC-one" },
    ] as never);
    const response = await getChannels(
      new Request(
        `http://localhost/api/discovery-runs/${id}/channels?minMatchedVideos=2&minRelevanceScore=0.4&minQueryCoverage=2&minMedianViewsPerDay=100`,
      ),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(1);
    expect(listDiscoveryRunChannels).toHaveBeenCalledWith(
      id,
      expect.objectContaining({
        minMatchedVideos: "2",
        minRelevanceScore: "0.4",
        minQueryCoverage: "2",
        minMedianViewsPerDay: "100",
      }),
    );

    vi.mocked(getDiscoveryRun).mockResolvedValue(null);
    expect(
      (await getChannels(new Request("http://localhost"), context)).status,
    ).toBe(404);
  });
});
