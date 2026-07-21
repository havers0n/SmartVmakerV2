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
  buildResearchCandidateCsv,
  calculateRecencyScore,
  computeOpportunityAnalysis,
  createDiscoveryRunSchema,
  getIncludedDiscoveryCurationVideos,
  RESEARCH_CANDIDATE_CSV_COLUMNS,
  type ResearchCandidateCsvRow,
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

describe("Discovery cluster curation", () => {
  it("keeps only selected videos for a research export", () => {
    expect(getIncludedDiscoveryCurationVideos([
      { id: "included", isExcluded: false },
      { id: "excluded", isExcluded: true },
    ])).toEqual([{ id: "included", isExcluded: false }]);
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

describe("opportunity analysis", () => {
  const base = {
    channelId: "UC-small",
    channelTitle: "Small Channel",
    channelPublishedAt: "2025-01-01T00:00:00Z",
    subscriberCount: 5_000,
    totalViewCount: 100_000,
    channelVideoCount: 50,
    publishedAt: "2026-06-01T00:00:00Z",
    viewCount: 1000,
    queryId: "q-1",
    query: "test query",
    searchOrder: "relevance",
    resultPosition: 1,
  };
  const rows = [
    {
      ...base,
      internalVideoId: "v1",
      youtubeVideoId: "yt-1",
      title: "Video One",
    },
    {
      ...base,
      internalVideoId: "v2",
      youtubeVideoId: "yt-2",
      title: "Video Two",
      publishedAt: "2026-06-15T00:00:00Z",
      viewCount: 500,
      queryId: "q-2",
      query: "second query",
    },
    {
      ...base,
      channelId: "UC-large",
      channelTitle: "Large Channel",
      subscriberCount: 100_000,
      internalVideoId: "v3",
      youtubeVideoId: "yt-3",
      title: "Big Video",
      publishedAt: "2026-05-01T00:00:00Z",
      viewCount: 50_000,
      queryId: "q-1",
      query: "test query",
    },
  ];
  const now = new Date("2026-07-01T00:00:00Z");

  it("computes signal counts", () => {
    const r = computeOpportunityAnalysis(rows, now);
    expect(r.signals).toContainEqual(
      expect.objectContaining({ label: "Total Unique Videos", value: 3 }),
    );
    expect(r.signals).toContainEqual(
      expect.objectContaining({ label: "Total Unique Channels", value: 2 }),
    );
    expect(r.signals).toContainEqual(
      expect.objectContaining({ label: "Small Channels (<10K known subs)", value: 1 }),
    );
    expect(r.signals).toContainEqual(
      expect.objectContaining({ label: "Known Subscriber Channels", value: 2 }),
    );
    expect(r.signals).toContainEqual(
      expect.objectContaining({ label: "Unknown Subscriber Channels", value: 0 }),
    );
  });

  it("excludes large channels from rising small channels", () => {
    const r = computeOpportunityAnalysis(rows, now);
    expect(r.risingSmallChannels).toHaveLength(1);
    expect(r.risingSmallChannels[0].channelTitle).toBe("Small Channel");
  });

  it("sorts rising small channels by bestViewsPerDay desc", () => {
    const multi = [
      { ...base, internalVideoId: "a", youtubeVideoId: "a", title: "A", viewCount: 100, publishedAt: "2026-06-01T00:00:00Z" },
      { ...base, channelId: "UC-small2", channelTitle: "Smaller", subscriberCount: 2000, internalVideoId: "b", youtubeVideoId: "b", title: "B", viewCount: 900, publishedAt: "2026-06-01T00:00:00Z" },
      { ...base, channelId: "UC-small2", internalVideoId: "c", youtubeVideoId: "c", title: "C", viewCount: 100, publishedAt: "2026-06-15T00:00:00Z" },
    ];
    const r = computeOpportunityAnalysis(multi, now);
    expect(r.risingSmallChannels[0].channelTitle).toBe("Smaller");
    expect(r.risingSmallChannels[1].channelTitle).toBe("Small Channel");
  });

  it("sets topEvidenceVideoTitle to the highest-viewed video", () => {
    const r = computeOpportunityAnalysis(rows, now);
    expect(r.risingSmallChannels[0].topEvidenceVideoTitle).toBe("Video One");
  });

  it("computes outlierScore from viewsPerDay vs channel median", () => {
    const r = computeOpportunityAnalysis(rows, now);
    expect(r.outlierVideos).toHaveLength(3);
    expect(r.signals.find((s) => s.label.startsWith("Outlier"))?.value).toBe(0);
  });

  it("assigns confidence based on evidence count per channel", () => {
    const confRows = [
      { ...base, internalVideoId: "c1", youtubeVideoId: "c1", title: "C1", viewCount: 100, publishedAt: "2026-06-01T00:00:00Z" },
      { ...base, internalVideoId: "c2", youtubeVideoId: "c2", title: "C2", viewCount: 200, publishedAt: "2026-06-01T00:00:00Z" },
      { ...base, internalVideoId: "c3", youtubeVideoId: "c3", title: "C3", viewCount: 300, publishedAt: "2026-06-01T00:00:00Z" },
      { ...base, internalVideoId: "c4", youtubeVideoId: "c4", title: "C4", viewCount: 400, publishedAt: "2026-06-01T00:00:00Z" },
    ];
    const r = computeOpportunityAnalysis(confRows, now);
    for (const v of r.outlierVideos) expect(v.confidence).toBe("medium");
  });

  it("flags videos as outliers when viewsPerDay >= 3x channel median", () => {
    const spikeRows = [
      { ...base, internalVideoId: "lo1", youtubeVideoId: "lo1", title: "Low 1", viewCount: 10, publishedAt: "2026-06-01T00:00:00Z" },
      { ...base, internalVideoId: "lo2", youtubeVideoId: "lo2", title: "Low 2", viewCount: 20, publishedAt: "2026-06-01T00:00:00Z" },
      { ...base, internalVideoId: "hi", youtubeVideoId: "hi", title: "Spike", viewCount: 100_000, publishedAt: "2026-06-30T00:00:00Z" },
    ];
    const r = computeOpportunityAnalysis(spikeRows, now);
    const spike = r.outlierVideos.find((v) => v.title === "Spike");
    expect(spike?.outlierScore).toBeGreaterThanOrEqual(3);
    expect(r.signals.find((s) => s.label.startsWith("Outlier"))?.value).toBeGreaterThanOrEqual(1);
  });

  it("computes query performance metrics", () => {
    const r = computeOpportunityAnalysis(rows, now);
    expect(r.queryPerformance).toHaveLength(2);
    const tq = r.queryPerformance.find((q) => q.query === "test query");
    expect(tq).toBeDefined();
    expect(tq!.totalDiscoveredVideos).toBe(2);
    expect(tq!.uniqueChannels).toBe(2);
    expect(tq!.smallChannelsCount).toBe(1);
    expect(tq!.queryQualityScore).toBeGreaterThan(0);
  });

  it("sorts queries by queryQualityScore descending", () => {
    const r = computeOpportunityAnalysis(rows, now);
    for (let i = 1; i < r.queryPerformance.length; i++) {
      expect(r.queryPerformance[i - 1].queryQualityScore).toBeGreaterThanOrEqual(
        r.queryPerformance[i].queryQualityScore,
      );
    }
  });

  it("returns empty data when no rows provided", () => {
    const r = computeOpportunityAnalysis([], now);
    expect((r.signals[0]?.value ?? 0)).toBe(0);
    expect(r.risingSmallChannels).toHaveLength(0);
    expect(r.outlierVideos).toHaveLength(0);
    expect(r.queryPerformance).toHaveLength(0);
  });

  it("handles nullable subscriberCount (null is not small)", () => {
    const nullSubs = [{ ...base, subscriberCount: null, internalVideoId: "x", youtubeVideoId: "x", title: "X" }];
    const r = computeOpportunityAnalysis(nullSubs, now);
    expect(r.signals.find((s) => s.label.startsWith("Small"))?.value).toBe(0);
    expect(r.signals.find((s) => s.label === "Known Subscriber Channels")?.value).toBe(0);
    expect(r.signals.find((s) => s.label === "Unknown Subscriber Channels")?.value).toBe(1);
    expect(r.risingSmallChannels).toHaveLength(0);
  });

  it("counts 0 subscriberCount as small when explicitly present (no high-view evidence)", () => {
    const zeroSubs = [
      { ...base, subscriberCount: 0, internalVideoId: "z1", youtubeVideoId: "z1", title: "Z1", viewCount: 100 },
    ];
    const r = computeOpportunityAnalysis(zeroSubs, now);
    expect(r.signals.find((s) => s.label.startsWith("Small"))?.value).toBe(1);
    expect(r.signals.find((s) => s.label === "Known Subscriber Channels")?.value).toBe(1);
    expect(r.signals.find((s) => s.label === "Unknown Subscriber Channels")?.value).toBe(0);
    expect(r.risingSmallChannels).toHaveLength(1);
  });

  it("separates known and unknown subscriber channels in signals", () => {
    const mixedRows = [
      { ...base, subscriberCount: 5000, internalVideoId: "m1", youtubeVideoId: "m1", title: "Known Small" },
      { ...base, channelId: "UC-known2", channelTitle: "Known Big", subscriberCount: 100_000, internalVideoId: "m2", youtubeVideoId: "m2", title: "Big" },
      { ...base, channelId: "UC-unknown1", channelTitle: "Unknown One", subscriberCount: null, internalVideoId: "m3", youtubeVideoId: "m3", title: "Unk1" },
      { ...base, channelId: "UC-unknown2", channelTitle: "Unknown Two", subscriberCount: null, internalVideoId: "m4", youtubeVideoId: "m4", title: "Unk2" },
    ];
    const r = computeOpportunityAnalysis(mixedRows, now);
    expect(r.signals.find((s) => s.label === "Known Subscriber Channels")?.value).toBe(2);
    expect(r.signals.find((s) => s.label === "Unknown Subscriber Channels")?.value).toBe(2);
    expect(r.signals.find((s) => s.label.startsWith("Small"))?.value).toBe(1);
  });

  it("reports subscriberDataQuality metrics", () => {
    const sdqRows = [
      { ...base, subscriberCount: 5000, internalVideoId: "s1", youtubeVideoId: "s1", title: "S1" },
      { ...base, channelId: "UC-big", channelTitle: "Big", subscriberCount: 50000, internalVideoId: "s2", youtubeVideoId: "s2", title: "S2" },
      { ...base, channelId: "UC-unk", channelTitle: "Unk", subscriberCount: null, internalVideoId: "s3", youtubeVideoId: "s3", title: "S3" },
    ];
    const r = computeOpportunityAnalysis(sdqRows, now);
    expect(r.subscriberDataQuality).toBeDefined();
    expect(r.subscriberDataQuality!.knownCount).toBe(2);
    expect(r.subscriberDataQuality!.unknownCount).toBe(1);
    expect(r.subscriberDataQuality!.zeroSubscriberCount).toBe(0);
    expect(r.subscriberDataQuality!.suspiciousZeroSubscriberCount).toBe(0);
    expect(r.subscriberDataQuality!.knownCoverage).toBeGreaterThan(0);
  });

  it("detects suspicious zero subscriber channel with high-view evidence video", () => {
    const suspRows = [
      {
        ...base,
        subscriberCount: 0,
        internalVideoId: "z1",
        youtubeVideoId: "z1",
        title: "Suspicious Zero",
        viewCount: 2_000_000,
      },
    ];
    const r = computeOpportunityAnalysis(suspRows, now);
    expect(r.subscriberDataQuality!.suspiciousZeroSubscriberCount).toBe(1);
    expect(r.dataQualityWarning).toContain("suspicious 0 subscriber counts");
  });

  it("does not flag zero subscriber as suspicious without high-view video", () => {
    const lowViewRows = [
      {
        ...base,
        subscriberCount: 0,
        internalVideoId: "z2",
        youtubeVideoId: "z2",
        title: "Legit Zero",
        viewCount: 100,
      },
    ];
    const r = computeOpportunityAnalysis(lowViewRows, now);
    expect(r.subscriberDataQuality!.suspiciousZeroSubscriberCount).toBe(0);
    expect(r.subscriberDataQuality!.zeroSubscriberCount).toBe(1);
  });

  it("excludes suspicious zero subscriber channel from rising small channels", () => {
    const suspRows = [
      {
        ...base,
        channelId: "UC-suspicious",
        channelTitle: "Suspicious Zero",
        subscriberCount: 0,
        internalVideoId: "z1",
        youtubeVideoId: "z1",
        title: "Suspicious Zero",
        viewCount: 2_000_000,
      },
    ];
    const r = computeOpportunityAnalysis(suspRows, now);
    expect(r.risingSmallChannels).toHaveLength(0);
  });

  it("excludes unknown subscriberCount from rising small channels", () => {
    const mixedChannelRows = [
      { ...base, subscriberCount: null, internalVideoId: "n1", youtubeVideoId: "n1", title: "Unknown" },
      { ...base, channelId: "UC-small-known", channelTitle: "Known Small", subscriberCount: 5000, internalVideoId: "n2", youtubeVideoId: "n2", title: "Known" },
    ];
    const r = computeOpportunityAnalysis(mixedChannelRows, now);
    expect(r.risingSmallChannels).toHaveLength(1);
    expect(r.risingSmallChannels[0].channelTitle).toBe("Known Small");
  });

  it("computes queryQualityScore without treating unknown subs as small", () => {
    const qaRows = [
      { ...base, subscriberCount: null, internalVideoId: "qa1", youtubeVideoId: "qa1", title: "QA1", query: "test query", queryId: "q-1" },
      { ...base, channelId: "UC-null2", subscriberCount: null, internalVideoId: "qa2", youtubeVideoId: "qa2", title: "QA2", query: "test query", queryId: "q-1" },
    ];
    const r = computeOpportunityAnalysis(qaRows, now);
    const tq = r.queryPerformance.find((q) => q.query === "test query");
    expect(tq).toBeDefined();
    expect(tq!.smallChannelsCount).toBe(0);
    expect(tq!.uniqueChannels).toBe(2);
    expect(tq!.knownSubscriberChannels).toBe(0);
    expect(tq!.unknownSubscriberChannels).toBe(2);
    expect(tq!.knownSubscriberCoverage).toBe(0);
    expect(tq!.dataQualityWarning).toBe("Subscriber counts unavailable for this query");
  });

  it("sets dataQualityWarning when subscriber coverage is low", () => {
    const lowCoverageRows = [
      { ...base, subscriberCount: null, internalVideoId: "l1", youtubeVideoId: "l1", title: "L1", query: "test query", queryId: "q-1" },
      { ...base, channelId: "UC-known", subscriberCount: 100_000, internalVideoId: "l2", youtubeVideoId: "l2", title: "L2", query: "test query", queryId: "q-1" },
    ];
    const r = computeOpportunityAnalysis(lowCoverageRows, now);
    expect(r.dataQualityWarning).toBe("Subscriber data quality is low. Small-channel signals may be unreliable.");
  });
});

describe("research candidate CSV export", () => {
  const sampleRow: ResearchCandidateCsvRow = {
    video_id: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: 'Weird "facts" about space',
    channel_id: "UC-test",
    channel_title: "Space Facts",
    view_count: 1200000,
    published_at: "2026-01-15T12:00:00.000Z",
    views_per_day: 42105.26,
    candidate_label: "space weird facts",
    candidate_score: 0.8123,
    shorts_evidence_ratio: 0.75,
    language_script_score: 0.98,
  };

  it("emits the required CSV header and column order", () => {
    const csv = buildResearchCandidateCsv([sampleRow]);
    const [header, dataRow] = csv.split("\n");

    expect(header).toBe(RESEARCH_CANDIDATE_CSV_COLUMNS.join(","));
    expect(dataRow.split(",")).toHaveLength(RESEARCH_CANDIDATE_CSV_COLUMNS.length);
    expect(csv).toContain("video_id,url,title,channel_id,channel_title");
    expect(csv).toContain(
      "candidate_label,candidate_score,shorts_evidence_ratio,language_script_score",
    );
  });

  it("escapes commas and quotes in CSV cells", () => {
    const csv = buildResearchCandidateCsv([sampleRow]);
    expect(csv).toContain('"Weird ""facts"" about space"');
  });

  it("returns only the header row when there are no videos", () => {
    expect(buildResearchCandidateCsv([])).toBe(
      RESEARCH_CANDIDATE_CSV_COLUMNS.join(","),
    );
  });
});
