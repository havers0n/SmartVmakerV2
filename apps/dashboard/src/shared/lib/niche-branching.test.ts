import { describe, expect, it } from "vitest";
import {
  generateNicheBranches,
  mapQueriesToBranches,
  type BranchingVideoInput,
  type NicheBranchSuggestion,
} from "./niche-branching";
import { type NicheCohesionMetrics } from "./niche-cohesion";

const emptyCohesion: NicheCohesionMetrics = {
  titleTokenCohesion: { topTokens: [], tokenCoverage: 0, topTokenConcentration: 0 },
  repeatedPatterns: [],
  patternCoverage: 0,
  channelRepeatability: {
    channelsWithMultipleVideos: 0,
    uniqueChannels: 0,
    repeatChannelRatio: 0,
    avgVideosPerChannel: 0,
    topChannelDominance: 0,
  },
  queryOverlap: {
    averageQueryChannelOverlap: 0,
    averageQueryTokenOverlap: 0,
    queryOverlapScore: 0,
  },
  nicheCohesionScore: 0,
  cohesionLabel: "Too broad",
  broadnessWarnings: [],
  suggestedNarrowedQueries: [],
};

const now = new Date("2026-07-01T00:00:00Z");

function makeVideo(overrides: Partial<BranchingVideoInput>): BranchingVideoInput {
  return {
    internalVideoId: overrides.internalVideoId ?? "v1",
    title: overrides.title ?? "Test Video",
    channelId: overrides.channelId ?? "c1",
    channelTitle: overrides.channelTitle ?? "Test Channel",
    query: overrides.query ?? "test query",
    viewCount: overrides.viewCount ?? 1000,
    publishedAt: overrides.publishedAt ?? "2026-06-01T00:00:00Z",
    subscriberCount: overrides.subscriberCount !== undefined ? overrides.subscriberCount : 5000,
    youtubeVideoId: overrides.youtubeVideoId ?? "yt-1",
  };
}

describe("generateNicheBranches", () => {
  it("detects GTA branch from GTA/Michael/Franklin/Trevor titles", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "GTA 5 what if Michael betrayed Franklin", channelId: "c1", viewCount: 50000, publishedAt: "2026-06-29T00:00:00Z" }),
      makeVideo({ internalVideoId: "2", title: "What if Trevor was in GTA 6", channelId: "c1", viewCount: 80000, publishedAt: "2026-06-28T00:00:00Z" }),
      makeVideo({ internalVideoId: "3", title: "GTA 5 Franklin and Michael heist gone wrong", channelId: "c2", viewCount: 60000, publishedAt: "2026-06-27T00:00:00Z" }),
      makeVideo({ internalVideoId: "4", title: "GTA 5 what if Trevor met Michael earlier", channelId: "c3", viewCount: 100000, publishedAt: "2026-06-30T00:00:00Z" }),
      makeVideo({ internalVideoId: "5", title: "What if GTA 6 had Franklin as protagonist", channelId: "c1", viewCount: 70000, publishedAt: "2026-06-26T00:00:00Z" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const gtaBranch = branches.find((b) => b.id === "gta-gaming-what-if");
    expect(gtaBranch).toBeDefined();
    expect(gtaBranch!.evidenceVideoCount).toBeGreaterThanOrEqual(5);
    expect(gtaBranch!.sourceTokens).toContain("gta");
    expect(gtaBranch!.confidence).toBe("high");
  });

  it("generic 'what if' about earth does not trigger GTA branch", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if Earth stopped spinning", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "What if humans disappeared from Earth", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "What if the Sun vanished", channelId: "c3" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const gtaBranch = branches.find((b) => b.id === "gta-gaming-what-if");
    expect(gtaBranch).toBeUndefined();
  });

  it("generic 'what if' about earth does not trigger Football branch", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if Earth stopped spinning", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "What if humans disappeared from Earth", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "What if the Sun vanished", channelId: "c3" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const footballBranch = branches.find((b) => b.id === "football-alternate-history");
    expect(footballBranch).toBeUndefined();
  });

  it("football branch requires football-specific tokens", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if Messi won the worldcup", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "What if Ronaldo played for Brazil", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "What if Mbappe left PSG", channelId: "c3" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const footballBranch = branches.find((b) => b.id === "football-alternate-history");
    expect(footballBranch).toBeDefined();
    expect(footballBranch!.sourceTokens.length).toBeGreaterThan(0);
  });

  it("GTA branch requires GTA-specific tokens", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if Michael went to jail", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "What if Franklin was a cop", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "What if Trevor died", channelId: "c3" }),
      makeVideo({ internalVideoId: "4", title: "What if GTA 5 had DLC", channelId: "c4" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const gtaBranch = branches.find((b) => b.id === "gta-gaming-what-if");
    expect(gtaBranch).toBeDefined();
    expect(gtaBranch!.sourceTokens.length).toBeGreaterThan(0);
  });

  it("Science branch triggers from earth/spinning/disappeared", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if Earth stopped spinning", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "What if humans disappeared from Earth", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "What if the Sun suddenly vanished", channelId: "c3" }),
      makeVideo({ internalVideoId: "4", title: "What if a solar storm hit", channelId: "c4" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const scienceBranch = branches.find((b) => b.id === "science-apocalypse");
    expect(scienceBranch).toBeDefined();
    expect(scienceBranch!.sourceTokens).toContain("earth");
  });

  it("Kids branch triggers from Dr Binocs / kids / education", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "Dr Binocs what happens if you eat too much", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "Kids learn about the solar system", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "Educational cartoon about space", channelId: "c3" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const kidsBranch = branches.find((b) => b.id === "kids-educational");
    expect(kidsBranch).toBeDefined();
    expect(kidsBranch!.sourceTokens.length).toBeGreaterThan(0);
  });

  it("detects BeamNG branch from crash/cars/truck titles", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "BeamNG Crash Compilation Cars vs Truck", channelId: "c1", subscriberCount: 5000 }),
      makeVideo({ internalVideoId: "2", title: "BeamNG Truck Crash Experiment", channelId: "c1", subscriberCount: 5000 }),
      makeVideo({ internalVideoId: "3", title: "BeamNG Cars vs Concrete Barrier", channelId: "c2", subscriberCount: 2000 }),
      makeVideo({ internalVideoId: "4", title: "BeamNG Police Crash Simulation", channelId: "c3", subscriberCount: 10000 }),
      makeVideo({ internalVideoId: "5", title: "BeamNG Truck vs Train Experiment", channelId: "c4", subscriberCount: 800 }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const beamngBranch = branches.find((b) => b.id === "beamng-vehicle-simulation");
    expect(beamngBranch).toBeDefined();
    expect(beamngBranch!.sourceTokens).toContain("beamng");
    expect(beamngBranch!.evidenceVideoCount).toBeGreaterThanOrEqual(5);
  });

  it("detects body facts branch from body/eat/water/urine titles", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What happens if you drink too much water", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "What happens inside your body when you eat", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "What happens if you hold your urine too long", channelId: "c3" }),
      makeVideo({ internalVideoId: "4", title: "What happens to your body when you die", channelId: "c4" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const bodyBranch = branches.find((b) => b.id === "body-facts-medical");
    expect(bodyBranch).toBeDefined();
    expect(bodyBranch!.evidenceVideoCount).toBeGreaterThanOrEqual(3);
    expect(bodyBranch!.sourceTokens.length).toBeGreaterThan(0);
  });

  it("detects science apocalypse branch from earth/humans/planet titles", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if the Earth stopped rotating", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "What if humans vanished from Earth", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "What if another planet entered solar system", channelId: "c3" }),
      makeVideo({ internalVideoId: "4", title: "What if a solar storm hit Earth explained", channelId: "c4" }),
      makeVideo({ internalVideoId: "5", title: "What if universe had no planets", channelId: "c5" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const scienceBranch = branches.find((b) => b.id === "science-apocalypse");
    expect(scienceBranch).toBeDefined();
    expect(scienceBranch!.sourceTokens).toContain("earth");
    expect(scienceBranch!.evidenceVideoCount).toBeGreaterThanOrEqual(3);
  });

  it("detects football branch from Messi/Ronaldo/football titles", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if Messi was born in Brazil", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "What if Ronaldo played for Barcelona", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "What if Mbappe stayed at Monaco", channelId: "c3" }),
      makeVideo({ internalVideoId: "4", title: "What if football worldcup had no offside", channelId: "c4" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const footballBranch = branches.find((b) => b.id === "football-alternate-history");
    expect(footballBranch).toBeDefined();
    expect(footballBranch!.sourceTokens).toContain("messi");
    expect(footballBranch!.evidenceVideoCount).toBeGreaterThanOrEqual(3);
  });

  it("branch confidence is high with enough evidence", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "GTA 5 what if", channelId: "c1", viewCount: 50000, publishedAt: "2026-06-29T00:00:00Z" }),
      makeVideo({ internalVideoId: "2", title: "GTA 5 Michael Franklin", channelId: "c2", viewCount: 40000, publishedAt: "2026-06-28T00:00:00Z" }),
      makeVideo({ internalVideoId: "3", title: "GTA 5 Trevor what if", channelId: "c3", viewCount: 30000, publishedAt: "2026-06-27T00:00:00Z" }),
      makeVideo({ internalVideoId: "4", title: "GTA 5 what if heist", channelId: "c4", viewCount: 20000, publishedAt: "2026-06-26T00:00:00Z" }),
      makeVideo({ internalVideoId: "5", title: "GTA 5 what if ending", channelId: "c5", viewCount: 10000, publishedAt: "2026-06-25T00:00:00Z" }),
      makeVideo({ internalVideoId: "6", title: "GTA 5 Franklin story", channelId: "c6", viewCount: 5000, publishedAt: "2026-06-01T00:00:00Z" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const gtaBranch = branches.find((b) => b.id === "gta-gaming-what-if");
    expect(gtaBranch).toBeDefined();
    expect(gtaBranch!.confidence).toBe("high");
  });

  it("branch confidence is low with weak evidence", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if Messi played basketball", channelId: "c1", viewCount: 100 }),
      makeVideo({ internalVideoId: "2", title: "Random video about football", channelId: "c2", viewCount: 200 }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const footballBranch = branches.find((b) => b.id === "football-alternate-history");
    if (footballBranch) {
      expect(footballBranch.confidence).toBe("low");
    }
  });

  it("suggested queries are returned for each branch", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "BeamNG Crash Test", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "BeamNG Truck Simulation", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "BeamNG Cars Experiment", channelId: "c3" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    for (const branch of branches) {
      expect(branch.suggestedQueries.length).toBeGreaterThan(0);
    }
  });

  it("unknown subscriberCount does not count as small", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "GTA 5 what if Michael", channelId: "c1", subscriberCount: null }),
      makeVideo({ internalVideoId: "2", title: "GTA 5 what if Franklin", channelId: "c2", subscriberCount: null }),
      makeVideo({ internalVideoId: "3", title: "GTA 5 what if Trevor", channelId: "c3", subscriberCount: null }),
      makeVideo({ internalVideoId: "4", title: "GTA 5 what if", channelId: "c4", subscriberCount: null }),
      makeVideo({ internalVideoId: "5", title: "GTA 5 what if story", channelId: "c5", subscriberCount: null }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const gtaBranch = branches.find((b) => b.id === "gta-gaming-what-if");
    expect(gtaBranch).toBeDefined();
    expect(gtaBranch!.smallKnownChannelCount).toBe(0);
  });

  it("branch scoring is deterministic", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "BeamNG Crash Test", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "BeamNG Truck Simulation", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "BeamNG Cars Experiment", channelId: "c3" }),
    ];
    const first = generateNicheBranches(videos, emptyCohesion, now);
    const second = generateNicheBranches(videos, emptyCohesion, now);
    expect(first).toEqual(second);
  });

  it("returns empty array for empty input", () => {
    const branches = generateNicheBranches([], emptyCohesion, now);
    expect(branches).toHaveLength(0);
  });

  it("returns branches sorted by score descending", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "GTA 5 what if Michael", channelId: "c1", viewCount: 50000 }),
      makeVideo({ internalVideoId: "2", title: "GTA 5 what if Franklin", channelId: "c2", viewCount: 40000 }),
      makeVideo({ internalVideoId: "3", title: "GTA 5 what if Trevor", channelId: "c3", viewCount: 30000 }),
      makeVideo({ internalVideoId: "4", title: "GTA 5 what if", channelId: "c4", viewCount: 20000 }),
      makeVideo({ internalVideoId: "5", title: "GTA 5 what if story", channelId: "c5", viewCount: 10000 }),
      makeVideo({ internalVideoId: "6", title: "BeamNG Crash Test", channelId: "c6", viewCount: 100 }),
      makeVideo({ internalVideoId: "7", title: "BeamNG Truck Simulation", channelId: "c7", viewCount: 200 }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    for (let i = 1; i < branches.length; i++) {
      expect(branches[i - 1].branchScore).toBeGreaterThanOrEqual(branches[i].branchScore);
    }
  });

  it("includes example videos sorted by viewsPerDay desc", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "GTA what if 1", channelId: "c1", viewCount: 1000 }),
      makeVideo({ internalVideoId: "2", title: "GTA what if 2", channelId: "c2", viewCount: 50000 }),
      makeVideo({ internalVideoId: "3", title: "GTA what if 3", channelId: "c3", viewCount: 20000 }),
      makeVideo({ internalVideoId: "4", title: "GTA what if 4", channelId: "c4", viewCount: 30000 }),
      makeVideo({ internalVideoId: "5", title: "GTA what if 5", channelId: "c5", viewCount: 40000 }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const gtaBranch = branches.find((b) => b.id === "gta-gaming-what-if");
    expect(gtaBranch).toBeDefined();
    expect(gtaBranch!.exampleVideos.length).toBeGreaterThan(0);
    for (let i = 1; i < gtaBranch!.exampleVideos.length; i++) {
      expect(gtaBranch!.exampleVideos[i - 1].viewsPerDay).toBeGreaterThanOrEqual(
        gtaBranch!.exampleVideos[i].viewsPerDay,
      );
    }
  });

  it("detects kids educational branch from kids/binocs/cartoon titles", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "What if kids learn about human body explained", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "Dr Binocs what happens if explained animation", channelId: "c2" }),
      makeVideo({ internalVideoId: "3", title: "Kids cartoon science facts animation", channelId: "c3" }),
      makeVideo({ internalVideoId: "4", title: "Learn about planets baby cartoon", channelId: "c4" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    const kidsBranch = branches.find((b) => b.id === "kids-educational");
    expect(kidsBranch).toBeDefined();
    expect(kidsBranch!.evidenceVideoCount).toBeGreaterThanOrEqual(3);
  });

  it("does not include branches with fewer than 2 matching videos", () => {
    const videos: BranchingVideoInput[] = [
      makeVideo({ internalVideoId: "1", title: "GTA 5 what if Michael", channelId: "c1" }),
      makeVideo({ internalVideoId: "2", title: "Random cooking video", channelId: "c2" }),
    ];
    const branches = generateNicheBranches(videos, emptyCohesion, now);
    for (const branch of branches) {
      expect(branch.evidenceVideoCount).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("mapQueriesToBranches", () => {
  it("maps queries to matching branches by source tokens", () => {
    const branches: NicheBranchSuggestion[] = [
      {
        id: "gta-gaming-what-if",
        name: "GTA / gaming what-if",
        confidence: "high",
        reason: "Test",
        sourceTokens: ["gta"],
        sourcePatterns: ["in gta 5"],
        evidenceVideoCount: 5,
        evidenceChannelCount: 3,
        medianViewsPerDay: 1000,
        bestViewsPerDay: 5000,
        smallKnownChannelCount: 2,
        suggestedQueries: [],
        exampleVideos: [],
        branchScore: 0.8,
        specificTokenMatchStrength: 1,
      },
    ];
    const queryPerformance = [{ query: "gta what if" }, { query: "cooking recipes" }];
    const result = mapQueriesToBranches(queryPerformance, branches);
    expect(result.get("gta what if")).toContain("GTA / gaming what-if");
    expect(result.has("cooking recipes")).toBe(false);
  });
});
