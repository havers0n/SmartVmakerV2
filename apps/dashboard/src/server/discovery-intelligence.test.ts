import { describe, expect, it } from "vitest";
import {
  computeDiscoveryClusters,
  computeTokenDiscoveryClusters,
  getDiscoveryCandidateSignals,
  deriveDiscoveryFormatDetails,
  detectDiscoveryTextLanguage,
} from "./discovery-intelligence";

describe("discovery intelligence", () => {
  it("derives a repeatable short facts format from metadata only", () => {
    const members = [
      { videoId: "1", title: "3 Crazy Fish Facts #shorts", channelId: "a", channelTitle: "Ocean Bits", subscriberCount: null, viewCount: 100, publishedAt: null, durationSeconds: 32, queryEvidence: ["fish facts shorts"] },
      { videoId: "2", title: "Fish Facts You Won't Believe #shorts", channelId: "b", channelTitle: "Daily Facts", subscriberCount: null, viewCount: 100, publishedAt: null, durationSeconds: 45, queryEvidence: ["fish facts shorts"] },
      { videoId: "3", title: "Weird Facts About Fish #shorts", channelId: "c", channelTitle: "Fact Burst", subscriberCount: null, viewCount: 100, publishedAt: null, durationSeconds: 51, queryEvidence: ["fish facts shorts"] },
    ];
    const format = deriveDiscoveryFormatDetails({ videoCount: 3, channelCount: 3, semanticCohesion: .9, repeatedFormatEvidence: .8, medianViewsPerDay: 1_000, representativeTitles: members.map(member => member.title) }, members);
    expect(format).toMatchObject({ formatName: "Short Viral Facts", typicalDurationRange: "0:32–0:51" });
    expect(format.commonEmotions).toEqual(expect.arrayContaining(["curiosity", "surprise"]));
    expect(format.exampleChannels).toHaveLength(3);
    expect(format.repeatabilityScore).toBe(61);
    expect(format.confidenceScore).toBeGreaterThan(0);
    expect(format.commonTitlePatterns).toHaveLength(3);
    expect(format.exampleVideos).toHaveLength(3);
  });

  it("uses Shorts evidence to rank candidates without excluding long-form clusters", () => {
    const signals = getDiscoveryCandidateSignals([
      { videoId: "1", title: "Full movie compilation for kids", channelId: "a", channelTitle: "A", subscriberCount: null, viewCount: null, publishedAt: null, durationSeconds: 3600 },
      { videoId: "2", title: "History facts #shorts", channelId: "b", channelTitle: "B", subscriberCount: null, viewCount: null, publishedAt: null, durationSeconds: 45 },
      { videoId: "3", title: "History facts #shorts", channelId: "c", channelTitle: "C", subscriberCount: null, viewCount: null, publishedAt: null, durationSeconds: 45 },
    ], "History facts");
    expect(signals.eligible).toBe(true);
    expect(signals.longFormRatio).toBeGreaterThan(0);
    expect(signals.kidsContentRatio).toBeGreaterThan(0);
    expect(signals.repeatableFormatCount).toBeGreaterThan(0);
  });

  it("keeps a same-language repeated format eligible when it has no Shorts metadata", () => {
    const signals = getDiscoveryCandidateSignals([
      { videoId: "1", title: "BeamNG realistic crash experiment", channelId: "a", channelTitle: "A", subscriberCount: null, viewCount: null, publishedAt: null, durationSeconds: 180 },
      { videoId: "2", title: "BeamNG realistic crash test", channelId: "b", channelTitle: "B", subscriberCount: null, viewCount: null, publishedAt: null, durationSeconds: 240 },
      { videoId: "3", title: "BeamNG car crash physics", channelId: "c", channelTitle: "C", subscriberCount: null, viewCount: null, publishedAt: null, durationSeconds: 300 },
    ], "BeamNG vehicle simulation");

    expect(signals.shortsEvidenceRatio).toBe(0);
    expect(signals.eligible).toBe(true);
    expect(signals.whyPenalized).toContain("no recognized repeatable Shorts format");
  });

  it("filters mixed-script English candidates and penalizes generic labels", () => {
    const signals = getDiscoveryCandidateSignals([
      { videoId: "1", title: "हिंदी facts #shorts", channelId: "a", channelTitle: "A", subscriberCount: null, viewCount: null, publishedAt: null },
      { videoId: "2", title: "हिंदी history #shorts", channelId: "b", channelTitle: "B", subscriberCount: null, viewCount: null, publishedAt: null },
      { videoId: "3", title: "हिंदी facts #shorts", channelId: "c", channelTitle: "C", subscriberCount: null, viewCount: null, publishedAt: null },
    ], "History facts", "en", "Viral News");
    expect(signals.eligible).toBe(true);
    expect(signals.languageScriptScore).toBeLessThan(0.9);
    expect(signals.whyPenalized).toContain("generic candidate label");
  });

  it("filters actual non-Latin script in English candidates", () => {
    const devanagari = String.fromCodePoint(0x0939, 0x093f, 0x0928, 0x094d, 0x0926, 0x0940);
    const signals = getDiscoveryCandidateSignals(
      ["facts", "history", "facts"].map((suffix, index) => ({ videoId: String(index), title: `${devanagari} ${suffix} #shorts`, channelId: String(index), channelTitle: null, subscriberCount: null, viewCount: null, publishedAt: null })),
      "History facts", "en", "Viral News",
    );
    expect(signals.eligible).toBe(false);
    expect(signals.languageScriptScore).toBeLessThan(0.85);
  });

  it("uses conservative token fallback groups instead of hashed-vector graph components", () => {
    const videos = Array.from({ length: 80 }, (_, index) => ({
      videoId: String(index),
      title: `Random facts and stories topic ${index}`,
      channelId: `channel-${index}`,
      channelTitle: `Channel ${index}`,
      subscriberCount: 1_000,
      viewCount: 1_000,
      publishedAt: "2026-07-01T00:00:00Z",
    }));
    const clusters = computeTokenDiscoveryClusters(
      videos,
      new Date("2026-07-10T00:00:00Z"),
    );
    expect(Math.max(...clusters.map(cluster => cluster.videoCount))).toBeLessThanOrEqual(50);
    expect(clusters.flatMap(cluster => cluster.videoIds).sort()).toEqual(videos.map(video => video.videoId).sort());
  });

  it("assigns every input video once and ranks semantic candidates", () => {
    const clusters = computeDiscoveryClusters(
      [
        {
          videoId: "1",
          title: "Car crash physics experiment",
          channelId: "a",
          channelTitle: "A",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "2",
          title: "Car crash test in slow motion",
          channelId: "b",
          channelTitle: "B",
          subscriberCount: 2_000,
          viewCount: 80_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "3",
          title: "Ocean facts explained",
          channelId: "c",
          channelTitle: "C",
          subscriberCount: 500_000,
          viewCount: 10,
          publishedAt: "2026-07-01T00:00:00Z",
        },
      ],
      new Date("2026-07-10T00:00:00Z"),
    );

    expect(clusters.flatMap((cluster) => cluster.videoIds).sort()).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(clusters[0]).toMatchObject({
      label: expect.stringContaining("car"),
      videoCount: 2,
      channelCount: 2,
      smallChannelCount: 2,
    });
    expect(clusters[0].researchScore).toBeGreaterThan(
      clusters[1].researchScore,
    );
    expect(clusters[0].adjustedResearchScore).toBeLessThan(
      clusters[0].researchScore,
    );
  });

  it("penalizes generic labels while boosting specific, repeated multi-channel patterns", () => {
    const clusters = computeDiscoveryClusters(
      [
        {
          videoId: "1",
          title: "Viral shorts stories",
          channelId: "a",
          channelTitle: "A",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "2",
          title: "Viral shorts stories",
          channelId: "b",
          channelTitle: "B",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "3",
          title: "Viral shorts stories",
          channelId: "c",
          channelTitle: "C",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "4",
          title: "Volcano eruption explained",
          channelId: "d",
          channelTitle: "D",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "5",
          title: "Volcano eruption documentary",
          channelId: "e",
          channelTitle: "E",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "6",
          title: "Volcano eruption footage",
          channelId: "f",
          channelTitle: "F",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
      ],
      new Date("2026-07-10T00:00:00Z"),
    );

    expect(clusters[0]).toMatchObject({
      label: expect.stringContaining("volcano"),
      labelQualityScore: 1,
    });
    expect(clusters[1]).toMatchObject({ labelQualityScore: 0 });
    expect(clusters[0].adjustedResearchScore).toBeGreaterThan(
      clusters[1].adjustedResearchScore,
    );
  });

  it("detects non-Latin titles and penalizes a cluster outside the allowed language", () => {
    const clusters = computeDiscoveryClusters(
      [
        {
          videoId: "1",
          title: "قصص الجن المخيفة",
          channelId: "a",
          channelTitle: "A",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "2",
          title: "قصص الجن الحقيقية",
          channelId: "b",
          channelTitle: "B",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
        {
          videoId: "3",
          title: "قصص الجن المرعبة",
          channelId: "c",
          channelTitle: "C",
          subscriberCount: 1_000,
          viewCount: 100_000,
          publishedAt: "2026-07-01T00:00:00Z",
        },
      ],
      new Date("2026-07-10T00:00:00Z"),
      { allowedLanguages: ["en"] },
    );

    expect(detectDiscoveryTextLanguage("قصص الجن")).toBe("ar");
    expect(clusters[0]).toMatchObject({
      dominantLanguage: "ar",
      languageMatchScore: 0,
    });
    expect(clusters[0].adjustedResearchScore).toBeLessThan(
      clusters[0].researchScore,
    );
  });
});
