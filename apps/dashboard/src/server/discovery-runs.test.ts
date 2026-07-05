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

import {
  aggregateDiscoveryChannels,
  calculateRecencyScore,
  createDiscoveryRunSchema,
} from "./discovery-runs";

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

describe("discovery channel aggregation", () => {
  const base = {
    channelId: "UC-one",
    channelTitle: "One",
    channelPublishedAt: "2025-01-01T00:00:00Z",
    subscriberCount: 100,
    totalViewCount: 5000,
    channelVideoCount: 20,
    queryId: "query-1",
    query: "beamng crashes",
    searchOrder: "relevance",
    resultPosition: 1,
  };
  const rows = [
    {
      ...base,
      internalVideoId: "db-1",
      youtubeVideoId: "yt-1",
      title: "First",
      publishedAt: "2026-01-01T00:00:00Z",
      viewCount: 10,
    },
    {
      ...base,
      internalVideoId: "db-1",
      youtubeVideoId: "yt-1",
      title: "First",
      publishedAt: "2026-01-01T00:00:00Z",
      viewCount: 10,
      searchOrder: "date",
      resultPosition: 2,
    },
    {
      ...base,
      internalVideoId: "db-2",
      youtubeVideoId: "yt-2",
      title: "Second",
      publishedAt: "2026-02-01T00:00:00Z",
      viewCount: 30,
      queryId: "query-2",
      query: "car crashes",
    },
    {
      ...base,
      channelId: "UC-two",
      channelTitle: "Two",
      subscriberCount: 1000,
      internalVideoId: "db-3",
      youtubeVideoId: "yt-3",
      title: "Third",
      publishedAt: "2026-03-01T00:00:00Z",
      viewCount: 100,
    },
  ];

  it("returns unique channels with unique-video metrics and search evidence", () => {
    const channels = aggregateDiscoveryChannels(
      rows,
      {},
      new Date("2026-07-01T00:00:00Z"),
    );
    expect(channels).toHaveLength(2);
    expect(channels[0]).toMatchObject({
      channelId: "UC-one",
      matchedVideoCount: 2,
      medianMatchedVideoViews: 20,
      bestMatchedVideoViews: 30,
    });
    expect(channels[0].evidenceVideos).toHaveLength(3);
    expect(channels[0].evidenceVideos[0]).toMatchObject({
      videoId: "yt-1",
      query: "beamng crashes",
      searchOrder: "relevance",
      resultPosition: 1,
    });
  });

  it("applies all supported filters", () => {
    expect(
      aggregateDiscoveryChannels(rows, { minMatchedVideos: 2 }),
    ).toHaveLength(1);
    expect(
      aggregateDiscoveryChannels(rows, { minSubscribers: 500 }),
    ).toHaveLength(1);
    expect(
      aggregateDiscoveryChannels(rows, { maxSubscribers: 500 }),
    ).toHaveLength(1);
    expect(
      aggregateDiscoveryChannels(rows, { minMedianViews: 50 }),
    ).toHaveLength(1);
    expect(
      aggregateDiscoveryChannels(
        rows,
        { maxChannelAgeMonths: 1 },
        new Date("2026-07-01T00:00:00Z"),
      ),
    ).toHaveLength(0);
  });

  it("calculates distinct query coverage and views velocity", () => {
    const velocityRows = [
      {
        ...base,
        internalVideoId: "velocity-1",
        youtubeVideoId: "velocity-1",
        title: "One day old",
        publishedAt: "2026-06-30T00:00:00Z",
        viewCount: 100,
      },
      {
        ...base,
        internalVideoId: "velocity-1",
        youtubeVideoId: "velocity-1",
        title: "Duplicate discovery",
        publishedAt: "2026-06-30T00:00:00Z",
        viewCount: 100,
        searchOrder: "date",
      },
      {
        ...base,
        internalVideoId: "velocity-2",
        youtubeVideoId: "velocity-2",
        title: "Three days old",
        publishedAt: "2026-06-28T00:00:00Z",
        viewCount: 300,
        queryId: "query-2",
        query: "second query",
      },
    ];
    const [channel] = aggregateDiscoveryChannels(
      velocityRows,
      {},
      new Date("2026-07-01T00:00:00Z"),
    );

    expect(channel).toMatchObject({
      queryCoverage: 2,
      medianViewsPerDay: 100,
      bestViewsPerDay: 100,
      uploadRecencyDays: 1,
      recencyScore: 1,
      viewsPerSubscriberScore: 0.2,
    });
    expect(channel.relevanceScore).toBeCloseTo(0.3658333333, 10);
    expect(
      aggregateDiscoveryChannels(
        velocityRows,
        {
          minRelevanceScore: 0.36,
          minQueryCoverage: 2,
          minMedianViewsPerDay: 100,
        },
        new Date("2026-07-01T00:00:00Z"),
      ),
    ).toHaveLength(1);
    expect(
      aggregateDiscoveryChannels(
        velocityRows,
        { minRelevanceScore: 0.37 },
        new Date("2026-07-01T00:00:00Z"),
      ),
    ).toHaveLength(0);
  });

  it("sorts channels by deterministic relevance score", () => {
    const channels = aggregateDiscoveryChannels(
      rows,
      {},
      new Date("2026-07-01T00:00:00Z"),
    );
    expect(channels[0].relevanceScore).toBeGreaterThanOrEqual(
      channels[1].relevanceScore,
    );
    expect(
      aggregateDiscoveryChannels(rows, {}, new Date("2026-07-01T00:00:00Z")),
    ).toEqual(channels);
  });

  it("uses zero views-per-subscriber score for zero or hidden subscribers", () => {
    for (const subscriberCount of [0, null]) {
      const [channel] = aggregateDiscoveryChannels(
        [{ ...rows[0], subscriberCount }],
        {},
        new Date("2026-07-01T00:00:00Z"),
      );
      expect(channel.viewsPerSubscriber).toBeNull();
      expect(channel.viewsPerSubscriberScore).toBe(0);
    }
  });
});

describe("discovery channel recency scoring", () => {
  it.each([
    [0, 1],
    [7, 1],
    [8, 0.75],
    [30, 0.75],
    [31, 0.5],
    [90, 0.5],
    [91, 0.25],
    [180, 0.25],
    [181, 0],
    [null, 0],
  ])("scores %s days as %s", (days, expected) => {
    expect(calculateRecencyScore(days)).toBe(expected);
  });
});
