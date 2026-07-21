import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDbChain } = vi.hoisted(() => {
  const chain: Record<string, any> = {};
  chain.selectDistinct = vi.fn();
  chain.from = vi.fn();
  chain.innerJoin = vi.fn();
  chain.where = vi.fn();
  chain.insert = vi.fn();
  chain.values = vi.fn();
  chain.onConflictDoUpdate = vi.fn();

  chain.selectDistinct.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockReturnValue({});

  return { mockDbChain: chain };
});

vi.mock("@/shared/lib/db", () => ({
  db: {
    selectDistinct: mockDbChain.selectDistinct,
    insert: mockDbChain.insert,
  },
}));

vi.mock("@/shared/lib/schema", () => ({
  discoveryRuns: {},
  nicheQueries: {},
  niches: {},
  videoDiscoveries: {},
  youtubeChannels: {
    youtubeChannelId: "youtube_channel_id",
    handle: "handle",
    title: "title",
    description: "description",
    country: "country",
    subscriberCount: "subscriber_count",
    hiddenSubscriberCount: "hidden_subscriber_count",
    videoCount: "video_count",
    viewCount: "view_count",
    publishedAt: "published_at",
    thumbnailUrl: "thumbnail_url",
    updatedAt: "updated_at",
  },
  youtubeVideos: {},
}));

vi.mock("@/shared/lib/youtube", () => ({
  getYouTubeChannelsByIds: vi.fn(),
  searchYouTubeForDiscovery: vi.fn(),
}));

vi.mock("@aec/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

import { hydrateDiscoveryRunChannels } from "./discovery-runs";
import { getYouTubeChannelsByIds } from "@/shared/lib/youtube";

describe("hydrateDiscoveryRunChannels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbChain.where.mockResolvedValue([]);
  });

  it("returns early when no channels need hydration (empty result from DB)", async () => {
    const result = await hydrateDiscoveryRunChannels(
      "00000000-0000-0000-0000-000000000001",
    );
    expect(result.totalChannelsInRun).toBe(0);
    expect(result.channelsSelectedForHydration).toBe(0);
  });

  it("throws on invalid UUID", async () => {
    await expect(
      hydrateDiscoveryRunChannels("not-a-uuid"),
    ).rejects.toThrow();
  });

  it("updates subscriberCount when channel had null", async () => {
    mockDbChain.where.mockResolvedValue([
      { youtubeChannelId: "UC-known", subscriberCount: null, hiddenSubscriberCount: null },
    ]);

    vi.mocked(getYouTubeChannelsByIds).mockResolvedValue([
      {
        youtubeChannelId: "UC-known",
        handle: "@known",
        title: "Known Subs",
        description: "A channel",
        country: "US",
        subscriberCount: 12345,
        hiddenSubscriberCount: false,
        videoCount: 200,
        viewCount: 1000000,
        publishedAt: "2020-01-01T00:00:00Z",
        thumbnailUrl: "https://example.com/thumb.jpg",
      },
    ]);

    await hydrateDiscoveryRunChannels("00000000-0000-0000-0000-000000000002");

    expect(getYouTubeChannelsByIds).toHaveBeenCalledWith(["UC-known"]);
    expect(mockDbChain.insert).toHaveBeenCalled();

    const insertValues = mockDbChain.values.mock.calls[0]?.[0];
    expect(insertValues.youtubeChannelId).toBe("UC-known");
    expect(insertValues.subscriberCount).toBe(12345);
    expect(insertValues.handle).toBe("@known");
    expect(insertValues.title).toBe("Known Subs");

    const conflictArgs = mockDbChain.onConflictDoUpdate.mock.calls[0]?.[0];
    expect(conflictArgs.target).toBe("youtube_channel_id");
    expect(conflictArgs.set.subscriberCount).toBeDefined();
    expect(conflictArgs.set.handle).toBeDefined();
    expect(conflictArgs.set.title).toBeDefined();
  });

  it("stale zero subscriber channel gets selected for hydration", async () => {
    mockDbChain.where.mockResolvedValue([
      { youtubeChannelId: "UC-zero", subscriberCount: 0, hiddenSubscriberCount: false },
    ]);

    vi.mocked(getYouTubeChannelsByIds).mockResolvedValue([
      {
        youtubeChannelId: "UC-zero",
        handle: "@zero",
        title: "Zero Subs (stale)",
        description: null,
        country: null,
        subscriberCount: 500000,
        hiddenSubscriberCount: false,
        videoCount: 500,
        viewCount: 50000000,
        publishedAt: "2019-01-01T00:00:00Z",
        thumbnailUrl: null,
      },
    ]);

    await hydrateDiscoveryRunChannels("00000000-0000-0000-0000-000000000005");

    expect(getYouTubeChannelsByIds).toHaveBeenCalledWith(["UC-zero"]);
    const insertValues = mockDbChain.values.mock.calls[0]?.[0];
    expect(insertValues.subscriberCount).toBe(500000);
  });

  it("does not select channel with subscriberCount=0 and hiddenSubscriberCount=true for hydration", async () => {
    mockDbChain.where.mockResolvedValue([
      { youtubeChannelId: "UC-hidden", subscriberCount: 0, hiddenSubscriberCount: true },
    ]);

    const result = await hydrateDiscoveryRunChannels(
      "00000000-0000-0000-0000-000000000006",
    );

    expect(getYouTubeChannelsByIds).not.toHaveBeenCalled();
    expect(mockDbChain.insert).not.toHaveBeenCalled();
    expect(result.channelsSelectedForHydration).toBe(0);
  });

  it("force mode hydrates all channels regardless of subscriberCount", async () => {
    mockDbChain.where.mockResolvedValue([
      { youtubeChannelId: "UC-a", subscriberCount: 5000, hiddenSubscriberCount: false },
      { youtubeChannelId: "UC-b", subscriberCount: null, hiddenSubscriberCount: null },
      { youtubeChannelId: "UC-c", subscriberCount: 0, hiddenSubscriberCount: true },
    ]);

    vi.mocked(getYouTubeChannelsByIds).mockResolvedValue([
      {
        youtubeChannelId: "UC-a",
        handle: "@a",
        title: "Channel A",
        description: null,
        country: null,
        subscriberCount: 5000,
        hiddenSubscriberCount: false,
        videoCount: 100,
        viewCount: 1000000,
        publishedAt: null,
        thumbnailUrl: null,
      },
      {
        youtubeChannelId: "UC-b",
        handle: "@b",
        title: "Channel B",
        description: null,
        country: null,
        subscriberCount: 10000,
        hiddenSubscriberCount: false,
        videoCount: 200,
        viewCount: 2000000,
        publishedAt: null,
        thumbnailUrl: null,
      },
      {
        youtubeChannelId: "UC-c",
        handle: "@c",
        title: "Channel C",
        description: null,
        country: null,
        subscriberCount: 0,
        hiddenSubscriberCount: true,
        videoCount: 50,
        viewCount: 500000,
        publishedAt: null,
        thumbnailUrl: null,
      },
    ]);

    const result = await hydrateDiscoveryRunChannels(
      "00000000-0000-0000-0000-000000000007",
      { force: true },
    );

    expect(result.channelsSelectedForHydration).toBe(3);
    expect(getYouTubeChannelsByIds).toHaveBeenCalledWith(["UC-a", "UC-b", "UC-c"]);
  });

  it("selects channels with null subscriberCount for hydration", async () => {
    mockDbChain.where.mockResolvedValue([
      { youtubeChannelId: "UC-null", subscriberCount: null, hiddenSubscriberCount: null },
    ]);

    vi.mocked(getYouTubeChannelsByIds).mockResolvedValue([
      {
        youtubeChannelId: "UC-null",
        handle: "@null",
        title: "Null Subs",
        description: null,
        country: null,
        subscriberCount: 30000,
        hiddenSubscriberCount: false,
        videoCount: 300,
        viewCount: 3000000,
        publishedAt: null,
        thumbnailUrl: null,
      },
    ]);

    await hydrateDiscoveryRunChannels("00000000-0000-0000-0000-000000000008");

    expect(getYouTubeChannelsByIds).toHaveBeenCalledWith(["UC-null"]);
  });
});
