import { describe, expect, it } from "vitest";
import {
  STOPWORDS,
  normalizeText,
  computeTitleTokenCohesion,
  computeRepeatedPatterns,
  computeChannelRepeatability,
  computeQueryOverlap,
  computeBroadnessWarnings,
  computeSuggestedNarrowing,
  generateSuggestedNarrowedQueries,
  extractRepeatedTitlePhrases,
  computeNicheCohesion,
  computeQueryCohesion,
  hasSubjectAnchor,
  isActionOnlyPhrase,
  isValidSuggestedQuery,
  type NicheCohesionVideoInput,
  DOMAIN_TOKENS,
} from "./niche-cohesion";

describe("normalizeText", () => {
  it("removes stopwords from title", () => {
    const tokens = normalizeText("What if the video goes viral");
    for (const t of tokens) {
      expect(STOPWORDS.has(t)).toBe(false);
    }
  });

  it("lowercases and splits correctly", () => {
    const tokens = normalizeText("BeamNG Crash Compilation 2024");
    expect(tokens).toContain("beamng");
    expect(tokens).toContain("crash");
    expect(tokens).toContain("compilation");
    expect(tokens).toContain("2024");
  });

  it("removes punctuation", () => {
    const tokens = normalizeText("Cars vs. Trucks! What happens?");
    expect(tokens).not.toContain("vs.");
    expect(tokens).toContain("vs");
    expect(tokens).toContain("trucks");
    expect(tokens).not.toContain("what");
  });

  it("removes emoji", () => {
    const tokens = normalizeText("BeamNG Crash 🚗💥");
    expect(tokens).toContain("beamng");
    expect(tokens).toContain("crash");
    expect(tokens).not.toContain("🚗");
    expect(tokens).not.toContain("💥");
  });

  it("returns empty array for only stopwords", () => {
    const tokens = normalizeText("the a an in on of");
    expect(tokens).toHaveLength(0);
  });

  it("handles empty title", () => {
    expect(normalizeText("")).toEqual([]);
  });
});

describe("computeTitleTokenCohesion", () => {
  it("diverse titles have more uniform token distribution than focused titles", () => {
    const diverse = [
      "What if the Earth stopped spinning",
      "What happens when you fall into a black hole",
      "What would happen if the sun disappeared",
      "If time travel was real what would you do",
      "What if everyone jumped at the same time",
    ];
    const focused = [
      "BeamNG Crash Compilation Cars vs Truck",
      "BeamNG Realistic Crash Experiment Truck vs Wall",
      "BeamNG Truck Crash Simulation at High Speed",
      "BeamNG Cars vs Concrete Barrier Experiment",
      "BeamNG Police Chase Crash Compilation",
    ];
    const diverseResult = computeTitleTokenCohesion(diverse);
    const focusedResult = computeTitleTokenCohesion(focused);
    const top3Focused = focusedResult.topTokens.slice(0, 3).reduce((s, t) => s + t.count, 0);
    const top3Diverse = diverseResult.topTokens.slice(0, 3).reduce((s, t) => s + t.count, 0);
    expect(top3Focused).toBeGreaterThan(top3Diverse);
  });

  it("gives high cohesion for focused BeamNG-like titles", () => {
    const titles = [
      "BeamNG Crash Compilation Cars vs Truck",
      "BeamNG Realistic Crash Experiment Truck vs Wall",
      "BeamNG Truck Crash Simulation at High Speed",
      "BeamNG Cars vs Concrete Barrier Experiment",
      "BeamNG Police Chase Crash Compilation",
    ];
    const result = computeTitleTokenCohesion(titles);
    expect(result.tokenCoverage).toBeGreaterThan(0.6);
    expect(result.topTokens[0].token).toBe("beamng");
  });

  it("computes topTokenConcentration correctly", () => {
    const titles = [
      "BeamNG Crash Test",
      "BeamNG Truck Crash",
      "BeamNG Car Crash Compilation",
      "Random Video Title",
      "Another Random Video",
    ];
    const result = computeTitleTokenCohesion(titles);
    expect(result.topTokenConcentration).toBeGreaterThan(0);
    expect(result.topTokenConcentration).toBeLessThanOrEqual(1);
  });

  it("returns empty topTokens for empty titles", () => {
    const result = computeTitleTokenCohesion([]);
    expect(result.topTokens).toHaveLength(0);
    expect(result.tokenCoverage).toBe(0);
  });

  it("handles single title", () => {
    const result = computeTitleTokenCohesion(["BeamNG Crash Test"]);
    expect(result.topTokens.length).toBeGreaterThan(0);
    expect(result.tokenCoverage).toBe(1);
  });
});

describe("computeRepeatedPatterns", () => {
  const beamngVideos: NicheCohesionVideoInput[] = [
    { internalVideoId: "1", title: "BeamNG Crash Compilation", channelId: "c1", query: "beamng crash", viewCount: 1000, publishedAt: "2026-06-01T00:00:00Z" },
    { internalVideoId: "2", title: "BeamNG Truck vs Wall Experiment", channelId: "c1", query: "beamng crash", viewCount: 2000, publishedAt: "2026-06-02T00:00:00Z" },
    { internalVideoId: "3", title: "BeamNG Realistic Crash Simulation", channelId: "c2", query: "beamng crash", viewCount: 1500, publishedAt: "2026-06-03T00:00:00Z" },
    { internalVideoId: "4", title: "BeamNG Car vs Truck Challenge", channelId: "c3", query: "beamng crash", viewCount: 500, publishedAt: "2026-06-04T00:00:00Z" },
    { internalVideoId: "5", title: "GTA 5 Funny Moments #1", channelId: "c4", query: "gta funny", viewCount: 800, publishedAt: "2026-06-01T00:00:00Z" },
  ];

  it("detects beamng pattern across multiple videos", () => {
    const { repeatedPatterns } = computeRepeatedPatterns(beamngVideos, new Date("2026-07-01T00:00:00Z"));
    const beamngPat = repeatedPatterns.find((p) => p.name === "beamng *");
    expect(beamngPat).toBeDefined();
    expect(beamngPat!.videoCount).toBe(4);
    expect(beamngPat!.uniqueChannels).toBe(3);
  });

  it("computes patternCoverage correctly", () => {
    const { patternCoverage } = computeRepeatedPatterns(beamngVideos, new Date("2026-07-01T00:00:00Z"));
    expect(patternCoverage).toBeGreaterThan(0);
    expect(patternCoverage).toBeLessThanOrEqual(1);
  });

  it("returns empty for videos with no patterns", () => {
    const noPatternVideos: NicheCohesionVideoInput[] = [
      { internalVideoId: "a", title: "Random Interesting Video", channelId: "c1", query: "random", viewCount: 100, publishedAt: null },
      { internalVideoId: "b", title: "My Personal Vlog #42", channelId: "c1", query: "vlog", viewCount: 50, publishedAt: null },
    ];
    const { repeatedPatterns, patternCoverage } = computeRepeatedPatterns(noPatternVideos);
    expect(repeatedPatterns).toHaveLength(0);
    expect(patternCoverage).toBe(0);
  });

  it("only includes patterns with >= 3 videos", () => {
    const fewMatchVideos: NicheCohesionVideoInput[] = [
      { internalVideoId: "a", title: "BeamNG Crash", channelId: "c1", query: "beamng", viewCount: 100, publishedAt: null },
      { internalVideoId: "b", title: "Minecraft Survival", channelId: "c2", query: "minecraft", viewCount: 200, publishedAt: null },
      { internalVideoId: "c", title: "GTA 5 Gameplay", channelId: "c3", query: "gta", viewCount: 300, publishedAt: null },
    ];
    const { repeatedPatterns } = computeRepeatedPatterns(fewMatchVideos);
    for (const p of repeatedPatterns) {
      expect(p.videoCount).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("computeChannelRepeatability", () => {
  it("calculates correct ratios", () => {
    const videos: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "A", channelId: "c1", query: "q", viewCount: 100, publishedAt: null },
      { internalVideoId: "2", title: "B", channelId: "c1", query: "q", viewCount: 100, publishedAt: null },
      { internalVideoId: "3", title: "C", channelId: "c2", query: "q", viewCount: 100, publishedAt: null },
      { internalVideoId: "4", title: "D", channelId: "c2", query: "q", viewCount: 100, publishedAt: null },
      { internalVideoId: "5", title: "E", channelId: "c3", query: "q", viewCount: 100, publishedAt: null },
    ];
    const result = computeChannelRepeatability(videos);
    expect(result.channelsWithMultipleVideos).toBe(2);
    expect(result.uniqueChannels).toBe(3);
    expect(result.repeatChannelRatio).toBeCloseTo(0.6667, 3);
    expect(result.avgVideosPerChannel).toBeCloseTo(1.6667, 3);
    expect(result.topChannelDominance).toBeCloseTo(1, 3);
  });

  it("handles all unique channels", () => {
    const videos: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "A", channelId: "c1", query: "q", viewCount: 100, publishedAt: null },
      { internalVideoId: "2", title: "B", channelId: "c2", query: "q", viewCount: 100, publishedAt: null },
      { internalVideoId: "3", title: "C", channelId: "c3", query: "q", viewCount: 100, publishedAt: null },
    ];
    const result = computeChannelRepeatability(videos);
    expect(result.channelsWithMultipleVideos).toBe(0);
    expect(result.repeatChannelRatio).toBe(0);
    expect(result.topChannelDominance).toBeCloseTo(1, 3);
  });
});

describe("computeQueryOverlap", () => {
  it("calculates overlap between queries", () => {
    const rows: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "BeamNG Crash Compilation", channelId: "c1", query: "beamng crash", viewCount: 100, publishedAt: null },
      { internalVideoId: "2", title: "BeamNG Truck Experiment", channelId: "c1", query: "beamng crash", viewCount: 100, publishedAt: null },
      { internalVideoId: "3", title: "GTA 5 Funny Moments", channelId: "c2", query: "gta funny", viewCount: 100, publishedAt: null },
      { internalVideoId: "4", title: "GTA 5 Police Chase", channelId: "c2", query: "gta funny", viewCount: 100, publishedAt: null },
    ];
    const result = computeQueryOverlap(rows);
    expect(result.averageQueryChannelOverlap).toBe(0);
    expect(result.averageQueryTokenOverlap).toBeGreaterThanOrEqual(0);
    expect(result.queryOverlapScore).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 for single query", () => {
    const rows: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "BeamNG Crash", channelId: "c1", query: "beamng crash", viewCount: 100, publishedAt: null },
    ];
    const result = computeQueryOverlap(rows);
    expect(result.averageQueryChannelOverlap).toBe(0);
    expect(result.averageQueryTokenOverlap).toBe(0);
    expect(result.queryOverlapScore).toBe(0);
  });

  it("detects high overlap when queries share channels and tokens", () => {
    const rows: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "BeamNG Crash Test", channelId: "c1", query: "beamng crash", viewCount: 100, publishedAt: null },
      { internalVideoId: "2", title: "BeamNG Truck vs Wall", channelId: "c2", query: "beamng crash", viewCount: 100, publishedAt: null },
      { internalVideoId: "3", title: "BeamNG Realistic Crash", channelId: "c1", query: "beamng realistic", viewCount: 100, publishedAt: null },
      { internalVideoId: "4", title: "BeamNG Truck Experiment", channelId: "c2", query: "beamng realistic", viewCount: 100, publishedAt: null },
    ];
    const result = computeQueryOverlap(rows);
    expect(result.averageQueryChannelOverlap).toBeGreaterThan(0);
    expect(result.averageQueryTokenOverlap).toBeGreaterThan(0);
    expect(result.queryOverlapScore).toBeGreaterThan(0);
  });
});

describe("computeBroadnessWarnings", () => {
  it("generates warnings when tokenCoverage is low", () => {
    const warnings = computeBroadnessWarnings({
      titleTokenCohesion: {
        topTokens: [{ token: "what", count: 5 }, { token: "if", count: 4 }],
        tokenCoverage: 0.1,
        topTokenConcentration: 0.1,
      },
      patternCoverage: 0.05,
      channelRepeatability: {
        channelsWithMultipleVideos: 1,
        uniqueChannels: 50,
        repeatChannelRatio: 0.02,
        avgVideosPerChannel: 1.02,
        topChannelDominance: 0.3,
      },
    });
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(warnings.some((w) => w.includes("Run appears broad"))).toBe(true);
  });

  it("generates no warnings when all metrics are high", () => {
    const warnings = computeBroadnessWarnings({
      titleTokenCohesion: {
        topTokens: [
          { token: "beamng", count: 10 },
          { token: "crash", count: 8 },
          { token: "truck", count: 6 },
        ],
        tokenCoverage: 0.8,
        topTokenConcentration: 0.6,
      },
      patternCoverage: 0.7,
      channelRepeatability: {
        channelsWithMultipleVideos: 10,
        uniqueChannels: 20,
        repeatChannelRatio: 0.5,
        avgVideosPerChannel: 3,
        topChannelDominance: 0.4,
      },
    });
    const criticalWarnings = warnings.filter(
      (w) =>
        w.includes("LOW_") || w.includes("Run appears broad"),
    );
    expect(criticalWarnings).toHaveLength(0);
  });
});

describe("DOMAIN_TOKENS", () => {
  it("contains expected domain-specific tokens", () => {
    expect(DOMAIN_TOKENS.has("earth")).toBe(true);
    expect(DOMAIN_TOKENS.has("gravity")).toBe(true);
    expect(DOMAIN_TOKENS.has("humans")).toBe(true);
    expect(DOMAIN_TOKENS.has("spinning")).toBe(true);
  });
});

describe("extractRepeatedTitlePhrases", () => {
  it("extracts repeated 2-5 word phrases from titles", () => {
    const titles = [
      "What if the Earth stopped spinning",
      "What if Earth stopped spinning forever",
      "What happens when Earth stops spinning",
      "What if all humans disappeared today",
      "All humans disappeared what happens next",
      "What if gravity disappeared forever",
      "Gravity disappeared what happens next",
    ];
    const phrases = extractRepeatedTitlePhrases(titles);
    const phraseTexts = phrases.map((p) => p.phrase);
    expect(phraseTexts).toContain("earth stopped spinning");
    expect(phraseTexts).toContain("humans disappeared");
    expect(phraseTexts).toContain("gravity disappeared");
  });

  it("filters out generic phrases", () => {
    const titles = [
      "What if the Earth stopped spinning",
      "What if the Sun disappeared",
      "What if the Moon exploded",
    ];
    const phrases = extractRepeatedTitlePhrases(titles);
    const phraseTexts = phrases.map((p) => p.phrase);
    expect(phraseTexts).not.toContain("what if");
    expect(phraseTexts).not.toContain("what happens");
  });

  it("returns empty for single title", () => {
    expect(extractRepeatedTitlePhrases(["What if Earth stopped"])).toHaveLength(
      0,
    );
  });

  it("returns empty for empty list", () => {
    expect(extractRepeatedTitlePhrases([])).toHaveLength(0);
  });

  it("removes emoji and punctuation from phrases", () => {
    const titles = [
      "Earth stopped spinning! 🚀 What if?",
      "Earth stopped spinning forever?",
    ];
    const phrases = extractRepeatedTitlePhrases(titles);
    const phraseTexts = phrases.map((p) => p.phrase);
    expect(phraseTexts).toContain("earth stopped spinning");
  });

  it("assigns higher score to phrases with domain tokens", () => {
    const titles = Array.from({ length: 5 }, () => "Earth stopped spinning");
    const genericTitles = Array.from({ length: 5 }, () => "my some video today");
    const allTitles = [...titles, ...genericTitles];
    const phrases = extractRepeatedTitlePhrases(allTitles);
    const earthPhrase = phrases.find((p) => p.phrase.includes("earth"));
    const genericPhrase = phrases.find((p) => p.phrase.includes("some video"));
    if (earthPhrase && genericPhrase) {
      expect(earthPhrase.score).toBeGreaterThan(genericPhrase.score);
    }
  });

  it("computes channelCount when videos provided", () => {
    const videos: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "Earth stopped spinning", channelId: "c1", query: "earth", viewCount: 1000, publishedAt: "2026-06-01T00:00:00Z" },
      { internalVideoId: "2", title: "Earth stopped spinning forever", channelId: "c2", query: "earth", viewCount: 2000, publishedAt: "2026-06-02T00:00:00Z" },
    ];
    const phrases = extractRepeatedTitlePhrases(
      videos.map((v) => v.title),
      videos,
    );
    const phrase = phrases.find((p) => p.phrase === "earth stopped spinning");
    expect(phrase).toBeDefined();
    expect(phrase!.channelCount).toBeGreaterThan(0);
  });
});

describe("generateSuggestedNarrowedQueries", () => {
  it("generates phrase-aware suggestions preserving word order", () => {
    const titles = [
      "What if the Earth stopped spinning",
      "What if Earth stopped spinning forever",
      "What happens when Earth stops spinning",
      "What if all humans disappeared today",
      "All humans disappeared what happens next",
      "What if gravity disappeared forever",
      "Gravity disappeared what happens next",
    ];
    const suggestions = generateSuggestedNarrowedQueries(
      titles,
      [
        { token: "earth", count: 3 },
        { token: "stopped", count: 2 },
        { token: "spinning", count: 3 },
        { token: "humans", count: 2 },
        { token: "disappeared", count: 2 },
      ],
      [{ name: "what if *", videoCount: 3, uniqueChannels: 3, medianViewsPerDay: 100, bestViewsPerDay: 500 }],
    );
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions.some((s) => s.includes("earth"))).toBe(true);
  });

  it("does not produce token-shuffled unnatural queries", () => {
    const titles = [
      "What if the Earth stopped spinning",
      "What if Earth stopped spinning forever",
    ];
    const suggestions = generateSuggestedNarrowedQueries(
      titles,
      [
        { token: "earth", count: 2 },
        { token: "stopped", count: 2 },
        { token: "spinning", count: 2 },
        { token: "what", count: 2 },
        { token: "if", count: 2 },
      ],
      [],
    );
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions.some((s) => s.includes("earth stopped"))).toBe(true);
    for (const s of suggestions) {
      expect(s).not.toMatch(/stopped spinning earth/);
      expect(s).not.toMatch(/ spinning stopped/);
    }
  });

  it("includes branch suggested queries when provided", () => {
    const suggestions = generateSuggestedNarrowedQueries(
      ["What if Earth stopped spinning"],
      [{ token: "earth", count: 1 }],
      [],
      undefined,
      undefined,
      ["space disaster what if shorts", "planet disaster animation shorts"],
    );
    expect(suggestions.some((s) => s.includes("space disaster"))).toBe(true);
    expect(suggestions.some((s) => s.includes("planet disaster"))).toBe(true);
  });

  it("deduplicates case-insensitive against existing queries", () => {
    const suggestions = generateSuggestedNarrowedQueries(
      ["Earth stopped spinning what if", "Earth stopped spinning animation"],
      [{ token: "earth", count: 1 }],
      [],
      undefined,
      ["EARTH STOPPED SPINNING ANIMATION"],
    );
    expect(
      suggestions.filter((s) => s.toLowerCase().includes("earth stopped spinning animation")),
    ).toHaveLength(0);
  });

  it("returns empty for empty titles", () => {
    expect(
      generateSuggestedNarrowedQueries([], [], []),
    ).toHaveLength(0);
  });
});

describe("computeSuggestedNarrowing (legacy)", () => {
  it("generates suggestions from top tokens", () => {
    const suggestions = computeSuggestedNarrowing(
      [
        { token: "gta", count: 10 },
        { token: "future", count: 8 },
        { token: "michael", count: 6 },
        { token: "franklin", count: 5 },
        { token: "trevor", count: 4 },
      ],
      [],
    );
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    expect(suggestions.some((s) => s.includes("gta"))).toBe(true);
  });

  it("returns empty for empty tokens", () => {
    expect(computeSuggestedNarrowing([], [])).toHaveLength(0);
  });
});

describe("computeNicheCohesion", () => {
  const now = new Date("2026-07-01T00:00:00Z");

  it("gives low score for generic 'what if' query results", () => {
    const genericRows: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "What if the Earth stopped spinning", channelId: "c1", query: "what if earth", viewCount: 1000, publishedAt: "2026-06-01T00:00:00Z" },
      { internalVideoId: "2", title: "What happens when you fall asleep", channelId: "c2", query: "what if earth", viewCount: 2000, publishedAt: "2026-06-02T00:00:00Z" },
      { internalVideoId: "3", title: "If time travel was real what would you do", channelId: "c3", query: "what if time", viewCount: 500, publishedAt: "2026-06-03T00:00:00Z" },
      { internalVideoId: "4", title: "What would happen if the sun disappeared", channelId: "c4", query: "what if time", viewCount: 3000, publishedAt: "2026-06-04T00:00:00Z" },
      { internalVideoId: "5", title: "What if everyone jumped at the same time", channelId: "c5", query: "what if earth", viewCount: 1500, publishedAt: "2026-06-05T00:00:00Z" },
      { internalVideoId: "6", title: "What happens when you drink too much water", channelId: "c6", query: "what if earth", viewCount: 800, publishedAt: "2026-06-06T00:00:00Z" },
    ];
    const result = computeNicheCohesion(genericRows, now);
    expect(result.nicheCohesionScore).toBeLessThan(0.3);
    expect(result.cohesionLabel).toBe("Too broad");
  });

  it("gives high score for focused BeamNG-like query results", () => {
    const focusedRows: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "BeamNG Crash Compilation Cars vs Truck", channelId: "c1", query: "beamng crash", viewCount: 5000, publishedAt: "2026-06-01T00:00:00Z" },
      { internalVideoId: "2", title: "BeamNG Realistic Crash Experiment Truck vs Wall", channelId: "c1", query: "beamng crash", viewCount: 8000, publishedAt: "2026-06-02T00:00:00Z" },
      { internalVideoId: "3", title: "BeamNG Truck Crash Simulation", channelId: "c2", query: "beamng crash", viewCount: 3000, publishedAt: "2026-06-03T00:00:00Z" },
      { internalVideoId: "4", title: "BeamNG Cars vs Concrete Barrier Experiment", channelId: "c2", query: "beamng experiment", viewCount: 6000, publishedAt: "2026-06-04T00:00:00Z" },
      { internalVideoId: "5", title: "BeamNG Police Chase Crash Compilation", channelId: "c1", query: "beamng experiment", viewCount: 10000, publishedAt: "2026-06-05T00:00:00Z" },
      { internalVideoId: "6", title: "BeamNG Car vs Truck Challenge", channelId: "c3", query: "beamng crash", viewCount: 2000, publishedAt: "2026-06-06T00:00:00Z" },
    ];
    const result = computeNicheCohesion(focusedRows, now);
    expect(result.nicheCohesionScore).toBeGreaterThan(0.6);
    expect(["Focused", "Highly focused"]).toContain(result.cohesionLabel);
  });

  it("computes nicheCohesionScore within 0-1 range", () => {
    const result = computeNicheCohesion([], now);
    expect(result.nicheCohesionScore).toBe(0);
  });
});

describe("computeQueryCohesion", () => {
  const topTokens = ["beamng", "crash", "truck", "experiment"];

  it("warns on short generic query", () => {
    const rows: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "What if the Earth stopped", channelId: "c1", query: "what if", viewCount: 100, publishedAt: null },
    ];
    const result = computeQueryCohesion(rows, topTokens);
    expect(result.genericQueryWarning).toBeDefined();
    expect(result.genericQueryWarning!.toLowerCase()).toContain("short");
  });

  it("warns on stopword-only query", () => {
    const rows: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "BeamNG Crash", channelId: "c1", query: "what if the", viewCount: 100, publishedAt: null },
    ];
    const result = computeQueryCohesion(rows, topTokens);
    expect(result.genericQueryWarning).toBeDefined();
    expect(result.genericQueryWarning!.toLowerCase()).toContain("stop");
  });

  it("high cohesion contribution for focused query", () => {
    const rows: NicheCohesionVideoInput[] = [
      { internalVideoId: "1", title: "BeamNG Crash Compilation", channelId: "c1", query: "beamng crash compilation", viewCount: 100, publishedAt: null },
      { internalVideoId: "2", title: "BeamNG Truck Experiment", channelId: "c1", query: "beamng crash compilation", viewCount: 100, publishedAt: null },
    ];
    const result = computeQueryCohesion(rows, topTokens);
    expect(result.cohesionContribution).toBeGreaterThan(0.5);
    expect(result.genericQueryWarning).toBeUndefined();
  });
});

describe("hasSubjectAnchor", () => {
  it("returns true for phrases with known subject anchors", () => {
    expect(hasSubjectAnchor("earth stopped spinning")).toBe(true);
    expect(hasSubjectAnchor("gravity disappeared")).toBe(true);
    expect(hasSubjectAnchor("humans vanished")).toBe(true);
    expect(hasSubjectAnchor("what if sun explodes")).toBe(true);
  });

  it("returns false for phrases without subject anchors", () => {
    expect(hasSubjectAnchor("stopped spinning")).toBe(false);
    expect(hasSubjectAnchor("what if disappeared")).toBe(false);
    expect(hasSubjectAnchor("vanished")).toBe(false);
  });
});

describe("isActionOnlyPhrase", () => {
  it("detects action-only phrases", () => {
    expect(isActionOnlyPhrase("stopped spinning")).toBe(true);
    expect(isActionOnlyPhrase("stopped rotating")).toBe(true);
    expect(isActionOnlyPhrase("disappeared")).toBe(true);
    expect(isActionOnlyPhrase("vanished")).toBe(true);
    expect(isActionOnlyPhrase("for 1 second")).toBe(true);
    expect(isActionOnlyPhrase("for 5 seconds")).toBe(true);
  });

  it("does not flag non-action phrases", () => {
    expect(isActionOnlyPhrase("earth spinning")).toBe(false);
    expect(isActionOnlyPhrase("what if earth")).toBe(false);
  });
});

describe("isValidSuggestedQuery", () => {
  it("rejects stopped spinning without earth", () => {
    expect(isValidSuggestedQuery("what if stopped spinning")).toBe(false);
    expect(isValidSuggestedQuery("stopped spinning shorts")).toBe(false);
  });

  it("accepts stopped spinning with earth", () => {
    expect(isValidSuggestedQuery("what if earth stopped spinning")).toBe(true);
    expect(isValidSuggestedQuery("earth stopped spinning shorts")).toBe(true);
  });

  it("rejects disappeared without valid subject", () => {
    expect(isValidSuggestedQuery("what if disappeared")).toBe(false);
    expect(isValidSuggestedQuery("disappeared shorts")).toBe(false);
  });

  it("accepts disappeared with valid subject", () => {
    expect(isValidSuggestedQuery("what if gravity disappeared")).toBe(true);
    expect(isValidSuggestedQuery("what if humans disappeared")).toBe(true);
  });

  it("rejects queries starting with what if stopped", () => {
    expect(isValidSuggestedQuery("what if stopped")).toBe(false);
    expect(isValidSuggestedQuery("what happens if stopped")).toBe(false);
  });
});

describe("PR-5.3: phrase-aware query generator with subject anchors", () => {
  it("rejects action-only stopped spinning phrases without subject", () => {
    const titles = [
      "What If Earth Stopped Spinning for 5 Seconds?",
      "What If Earth Stopped Spinning for 1 Second?",
      "Earth Stopped Spinning Explained",
    ];
    const suggestions = generateSuggestedNarrowedQueries(
      titles,
      [
        { token: "earth", count: 3 },
        { token: "stopped", count: 3 },
        { token: "spinning", count: 3 },
      ],
      [{ name: "explained", videoCount: 1, uniqueChannels: 1, medianViewsPerDay: 100, bestViewsPerDay: 500 }],
    );

    expect(suggestions.some((s) => s === "stopped spinning shorts")).toBe(false);
    expect(suggestions.some((s) => s === "what if stopped spinning")).toBe(false);
    expect(suggestions.some((s) => s === "earth stopped spinning shorts")).toBe(true);
    expect(suggestions.some((s) => s === "what if earth stopped spinning")).toBe(true);
  });

  it("prefers longer anchored phrase over shorter fragment", () => {
    const titles = [
      "Earth stopped",
      "Earth stopped spinning",
      "Earth stopped spinning",
      "Stopped spinning",
      "Stopped spinning",
    ];
    const phrases = extractRepeatedTitlePhrases(titles);
    const earthStopped = phrases.find((p) => p.phrase === "earth stopped");
    const earthStoppedSpinning = phrases.find((p) => p.phrase === "earth stopped spinning");
    const stoppedSpinning = phrases.find((p) => p.phrase === "stopped spinning");

    expect(earthStoppedSpinning).toBeDefined();
    expect(earthStopped).toBeDefined();
    expect(stoppedSpinning).toBeDefined();

    expect(earthStoppedSpinning!.score).toBeGreaterThan(earthStopped!.score);
    expect(earthStoppedSpinning!.score).toBeGreaterThan(stoppedSpinning!.score);
  });

  it("keeps valid non-earth subjects", () => {
    const titles = [
      "What If Gravity Disappeared?",
      "What If Humans Disappeared?",
      "Gravity disappeared what if",
      "Humans disappeared what if",
    ];
    const suggestions = generateSuggestedNarrowedQueries(
      titles,
      [
        { token: "gravity", count: 2 },
        { token: "humans", count: 2 },
        { token: "disappeared", count: 4 },
      ],
      [],
    );

    expect(suggestions.some((s) => s.includes("what if gravity disappeared"))).toBe(true);
    expect(suggestions.some((s) => s.includes("what if humans disappeared"))).toBe(true);
  });

  it("does not generate disappeared query without subject", () => {
    expect(isValidSuggestedQuery("what if disappeared")).toBe(false);
    expect(isValidSuggestedQuery("disappeared shorts")).toBe(false);
  });
});
