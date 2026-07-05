import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list, POST as create } from "./route";
import { GET as getRun } from "./[id]/route";
import { GET as getVideos } from "./[id]/videos/route";
import {
  createDiscoveryRun,
  getDiscoveryRun,
  listDiscoveryRuns,
  listDiscoveryRunVideos,
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
  listDiscoveryRuns: vi.fn(),
  listDiscoveryRunVideos: vi.fn(),
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
    expect(response.status).toBe(201);
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
    vi.mocked(getDiscoveryRun).mockResolvedValue({
      id,
      videoCount: 2,
      uniqueChannelCount: 1,
    } as never);
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
});
