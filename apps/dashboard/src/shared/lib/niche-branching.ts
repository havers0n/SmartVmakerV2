import { normalizeText, type NicheCohesionMetrics } from "./niche-cohesion";

export type BranchingVideoInput = {
  internalVideoId: string;
  title: string;
  channelId: string;
  channelTitle: string | null;
  query: string;
  viewCount: number | null;
  publishedAt: string | null;
  subscriberCount: number | null;
  youtubeVideoId: string | null;
  hiddenSubscriberCount?: boolean | null;
};

export type ExampleVideo = {
  title: string;
  channelTitle: string;
  viewsPerDay: number;
  url?: string;
};

export type NicheBranchSuggestion = {
  id: string;
  name: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  sourceTokens: string[];
  sourcePatterns: string[];
  evidenceVideoCount: number;
  evidenceChannelCount: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
  smallKnownChannelCount: number;
  suggestedQueries: string[];
  exampleVideos: ExampleVideo[];
  branchScore: number;
  specificTokenMatchStrength: number;
};

type BranchDefinition = {
  id: string;
  name: string;
  signalTokens: string[];
  signalPatterns: { name: string; regex: RegExp }[];
  suggestedQueries: string[];
};

const BRANCHES: BranchDefinition[] = [
  {
    id: "gta-gaming-what-if",
    name: "GTA / gaming what-if",
    signalTokens: ["gta", "gta5", "michael", "franklin", "trevor"],
    signalPatterns: [
      { name: "in gta 5", regex: /in gta\s*5/i },
      { name: "what if", regex: /what if/i },
    ],
    suggestedQueries: [
      "GTA 5 what if shorts",
      "what happens if in GTA 5",
      "GTA 5 experiment shorts",
      "GTA 5 future Michael Franklin Trevor",
      "GTA 5 what if 20 years later",
    ],
  },
  {
    id: "beamng-vehicle-simulation",
    name: "BeamNG / vehicle simulation",
    signalTokens: ["beamng", "crash", "cars", "truck", "bus", "police", "train"],
    signalPatterns: [
      { name: "cars vs", regex: /cars?\s+vs/i },
      { name: "truck vs", regex: /truck\s+vs/i },
      { name: "beamng", regex: /beamng/i },
      { name: "simulator", regex: /simulator/i },
      { name: "experiment", regex: /experiment/i },
    ],
    suggestedQueries: [
      "BeamNG what if cars crash",
      "BeamNG cars vs obstacles shorts",
      "BeamNG truck crash simulator",
      "BeamNG realistic crash experiment",
      "BeamNG police chase crash shorts",
    ],
  },
  {
    id: "body-facts-medical",
    name: "Body facts / medical explainers",
    signalTokens: ["body", "eat", "urine", "water", "die", "human", "inside", "health"],
    signalPatterns: [
      { name: "what happens if", regex: /what happens if/i },
      { name: "explained", regex: /explained/i },
      { name: "animation", regex: /animation/i },
    ],
    suggestedQueries: [
      "what happens inside the body shorts",
      "what happens if you eat too much shorts",
      "body facts animation shorts",
      "medical facts shorts",
      "human body what if animation",
    ],
  },
  {
    id: "science-apocalypse",
    name: "Science / apocalypse explainers",
    signalTokens: ["earth", "planet", "solar", "humans", "vanished", "rotating", "universe", "storm", "disappeared", "spinning"],
    signalPatterns: [
      { name: "what if", regex: /what if/i },
      { name: "explained", regex: /explained/i },
      { name: "animation", regex: /animation/i },
    ],
    suggestedQueries: [
      "what if earth stopped rotating",
      "what if humans disappeared animation",
      "science what if shorts",
      "apocalypse explained shorts",
      "space what if animation",
    ],
  },
  {
    id: "football-alternate-history",
    name: "Football alternate-history edits",
    signalTokens: ["messi", "ronaldo", "mbappe", "football", "soccer", "worldcup"],
    signalPatterns: [
      { name: "what if", regex: /what if/i },
    ],
    suggestedQueries: [
      "what if Messi was born in another country",
      "football what if shorts",
      "soccer alternate history shorts",
      "Mbappe Messi what if edit",
      "football edits what if",
    ],
  },
  {
    id: "kids-educational",
    name: "Kids educational what-if",
    signalTokens: ["kids", "dr", "binocs", "baby", "learn", "cartoon", "children", "education"],
    signalPatterns: [
      { name: "explained", regex: /explained/i },
      { name: "animation", regex: /animation/i },
      { name: "what happens if", regex: /what happens if/i },
    ],
    suggestedQueries: [
      "kids what if animation",
      "what happens if kids science animation",
      "Dr Binocs what happens if",
      "educational what if shorts kids",
      "cartoon science facts shorts",
    ],
  },
];

function computeViewsPerDay(
  video: BranchingVideoInput,
  now: Date,
): number {
  const age = video.publishedAt
    ? Math.max(
        1,
        (now.getTime() - new Date(video.publishedAt).getTime()) / 86_400_000,
      )
    : 1;
  return Number(video.viewCount ?? 0) / age;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function generateNicheBranches(
  videos: BranchingVideoInput[],
  _nicheCohesion: NicheCohesionMetrics,
  now = new Date(),
  suspiciousChannelIds?: Set<string>,
): NicheBranchSuggestion[] {
  if (videos.length === 0) return [];

  const uniqueVideosMap = new Map<string, BranchingVideoInput>();
  for (const v of videos) {
    if (!uniqueVideosMap.has(v.internalVideoId)) {
      uniqueVideosMap.set(v.internalVideoId, v);
    }
  }
  const uniqueVideos = [...uniqueVideosMap.values()];
  const totalVideos = uniqueVideos.length;

  const normalizedVideos = uniqueVideos.map((v) => ({
    video: v,
    tokens: normalizeText(v.title),
  }));

  const results: NicheBranchSuggestion[] = [];

  for (const branch of BRANCHES) {
    const matching = normalizedVideos.filter((nv) => {
      const tokenMatch = nv.tokens.some((t) =>
        branch.signalTokens.includes(t),
      );
      return tokenMatch;
    });

    if (matching.length < 2) continue;

    const matchingVideos = matching.map((m) => m.video);
    const uniqueChannels = new Set(matchingVideos.map((v) => v.channelId));

    const isSuspiciousZero = (v: BranchingVideoInput) =>
      suspiciousChannelIds?.has(v.channelId) ?? false;

    const smallKnownChannels = new Set(
      matchingVideos
        .filter(
          (v) =>
            v.subscriberCount !== null &&
            v.subscriberCount < 10_000 &&
            !isSuspiciousZero(v),
        )
        .map((v) => v.channelId),
    );

    const viewsPerDayValues = matchingVideos.map((v) =>
      computeViewsPerDay(v, now),
    );
    const medianViewsPerDay = median(viewsPerDayValues);
    const bestViewsPerDay = viewsPerDayValues.length
      ? Math.max(...viewsPerDayValues)
      : 0;

    const matchedPatternNames = new Set<string>();
    for (const nv of matching) {
      for (const pat of branch.signalPatterns) {
        if (pat.regex.test(nv.video.title)) {
          matchedPatternNames.add(pat.name);
        }
      }
    }

    const patternMatchStrength =
      branch.signalPatterns.length > 0
        ? matchedPatternNames.size / branch.signalPatterns.length
        : 0;

    const evidenceVideoCoverage = matching.length / totalVideos;
    const medianViewsNormalized = Math.min(medianViewsPerDay / 10_000, 1);
    const bestViewsNormalized = Math.min(bestViewsPerDay / 100_000, 1);
    const smallChannelSignal = Math.min(smallKnownChannels.size / 5, 1);

    const branchScore =
      evidenceVideoCoverage * 0.2 +
      medianViewsNormalized * 0.25 +
      bestViewsNormalized * 0.2 +
      smallChannelSignal * 0.2 +
      patternMatchStrength * 0.15;

    const confidence: "high" | "medium" | "low" =
      branchScore >= 0.65 && matching.length >= 5
        ? "high"
        : branchScore >= 0.35 && matching.length >= 3
          ? "medium"
          : "low";

    const sourceTokens = branch.signalTokens.filter((t) =>
      matching.some((nv) => nv.tokens.includes(t)),
    );
    const sourcePatterns = [...matchedPatternNames];

    const specificTokenMatchStrength =
      matching.length > 0
        ? matching.filter((nv) =>
            nv.tokens.some((t) => branch.signalTokens.includes(t)),
          ).length / matching.length
        : 0;

    const sortedByVpd = matchingVideos
      .map((v, i) => ({ video: v, vpd: viewsPerDayValues[i] }))
      .sort((a, b) => b.vpd - a.vpd)
      .slice(0, 3);

    const reasonParts: string[] = [];
    if (sourceTokens.length > 0) {
      reasonParts.push(`tokens: ${sourceTokens.slice(0, 4).join(", ")}`);
    }
    if (sourcePatterns.length > 0) {
      reasonParts.push(
        `patterns: ${sourcePatterns.slice(0, 3).join(", ")}`,
      );
    }
    const reason =
      reasonParts.length > 0
        ? `Detected from ${reasonParts.join(" and ")}`
        : `Matched ${matching.length} videos with related content`;

    results.push({
      id: branch.id,
      name: branch.name,
      confidence,
      reason,
      sourceTokens,
      sourcePatterns,
      evidenceVideoCount: matching.length,
      evidenceChannelCount: uniqueChannels.size,
      medianViewsPerDay: Math.round(medianViewsPerDay * 100) / 100,
      bestViewsPerDay: Math.round(bestViewsPerDay * 100) / 100,
      smallKnownChannelCount: smallKnownChannels.size,
      suggestedQueries: branch.suggestedQueries,
      exampleVideos: sortedByVpd.map((sv) => ({
        title: sv.video.title,
        channelTitle: sv.video.channelTitle ?? "—",
        viewsPerDay: Math.round(sv.vpd * 100) / 100,
        url: sv.video.youtubeVideoId
          ? `https://www.youtube.com/watch?v=${sv.video.youtubeVideoId}`
          : undefined,
      })),
      branchScore: Math.round(branchScore * 10000) / 10000,
      specificTokenMatchStrength,
    });
  }

  results.sort((a, b) => b.branchScore - a.branchScore);

  return results;
}

export function mapQueriesToBranches(
  queryPerformance: { query: string }[],
  branches: NicheBranchSuggestion[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const qp of queryPerformance) {
    const matches: string[] = [];
    const queryLower = qp.query.toLowerCase();
    for (const branch of branches) {
      const matchedByToken = branch.sourceTokens.some((t) =>
        queryLower.includes(t),
      );
      if (matchedByToken) {
        matches.push(branch.name);
      }
    }
    if (matches.length > 0) {
      result.set(qp.query, matches);
    }
  }
  return result;
}
