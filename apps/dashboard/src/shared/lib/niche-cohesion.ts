export const STOPWORDS = new Set([
  "what", "if", "happens", "happen", "when", "would", "could",
  "you", "your", "the", "a", "an", "to", "of", "in", "on",
  "for", "with", "and", "or", "is", "are", "was", "were",
  "this", "that", "shorts", "viral", "video",
]);

export const GENERIC_PHRASES = new Set([
  "what if",
  "what happens",
  "would happen",
  "in the",
  "for shorts",
  "full video",
  "what happens when",
  "what happens if",
]);

export const DOMAIN_TOKENS = new Set([
  "earth", "gravity", "humans", "planet", "space", "spinning", "rotating",
  "disappeared", "stopped", "sun", "moon", "universe", "solar", "vanished",
  "human", "body", "inside", "die", "storm",
]);

const SUBJECT_ANCHOR_TOKENS = [
  "earth", "planet", "gravity", "humans", "human",
  "sun", "moon", "ocean", "space", "universe",
  "solar", "atmosphere", "core", "volcano", "asteroid",
];

const ACTION_ONLY_PATTERNS = [
  /\bstopped spinning\b/,
  /\bstopped rotating\b/,
  /\bstops rotating\b/,
  /\bstops spinning\b/,
  /\bdisappeared\b/,
  /\bvanished\b/,
  /\bfor 1 second\b/,
  /\bfor 5 seconds\b/,
];

export function hasSubjectAnchor(phrase: string): boolean {
  const words = phrase.toLowerCase().split(/\s+/);
  return words.some((w) => SUBJECT_ANCHOR_TOKENS.includes(w));
}

export function isActionOnlyPhrase(phrase: string): boolean {
  return ACTION_ONLY_PATTERNS.some((p) => p.test(phrase.toLowerCase()));
}

export function isValidSuggestedQuery(query: string): boolean {
  const lower = query.toLowerCase();
  if (lower.includes("stopped spinning") && !lower.includes("earth")) return false;
  if (lower.includes("stopped rotating") && !lower.includes("earth")) return false;
  if (lower.includes("disappeared") && !["humans", "human", "gravity", "sun", "moon", "earth", "planet", "ocean"].some((s) => lower.includes(s))) return false;
  if (/^what if stopped/.test(lower)) return false;
  if (/^what happens if stopped/.test(lower)) return false;
  return true;
}

export type RepeatedPhrase = {
  phrase: string;
  count: number;
  videoCount: number;
  channelCount: number;
  score: number;
};

export const PATTERNS = [
  { name: "cars vs *", regex: /cars?\s+vs/i },
  { name: "truck vs *", regex: /truck\s+vs/i },
  { name: "what if *", regex: /what if/i },
  { name: "what happens if *", regex: /what happens if/i },
  { name: "what happens when *", regex: /what happens when/i },
  { name: "in gta 5", regex: /in gta\s*5/i },
  { name: "in minecraft", regex: /in minecraft/i },
  { name: "beamng *", regex: /beamng/i },
  { name: "* simulator", regex: /simulator/i },
  { name: "* experiment", regex: /experiment/i },
  { name: "* challenge", regex: /challenge/i },
  { name: "* explained", regex: /explained/i },
  { name: "* animation", regex: /animation/i },
];

export type TokenFrequency = { token: string; count: number };

export type RepeatedPattern = {
  name: string;
  videoCount: number;
  uniqueChannels: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
};

export type NicheCohesionVideoInput = {
  internalVideoId: string;
  title: string;
  channelId: string;
  query: string;
  viewCount: number | null;
  publishedAt: string | null;
};

export type TitleTokenCohesionResult = {
  topTokens: TokenFrequency[];
  tokenCoverage: number;
  topTokenConcentration: number;
};

export type ChannelRepeatabilityResult = {
  channelsWithMultipleVideos: number;
  uniqueChannels: number;
  repeatChannelRatio: number;
  avgVideosPerChannel: number;
  topChannelDominance: number;
};

export type QueryOverlapResult = {
  averageQueryChannelOverlap: number;
  averageQueryTokenOverlap: number;
  queryOverlapScore: number;
};

export type NicheCohesionMetrics = {
  titleTokenCohesion: TitleTokenCohesionResult;
  repeatedPatterns: RepeatedPattern[];
  patternCoverage: number;
  channelRepeatability: ChannelRepeatabilityResult;
  queryOverlap: QueryOverlapResult;
  nicheCohesionScore: number;
  cohesionLabel: string;
  broadnessWarnings: string[];
  suggestedNarrowedQueries: string[];
};

export type QueryCohesionResult = {
  cohesionContribution: number;
  genericQueryWarning?: string;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function removeEmoji(text: string): string {
  return text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}]/gu,
    "",
  );
}

export function extractRepeatedTitlePhrases(
  titles: string[],
  videos?: NicheCohesionVideoInput[],
): RepeatedPhrase[] {
  if (titles.length === 0) return [];

  const normalized = titles.map((t) =>
    removeEmoji(t)
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  const phraseVideoIndices = new Map<string, Set<number>>();

  for (let i = 0; i < normalized.length; i++) {
    const title = normalized[i];
    if (!title) continue;
    const words = title.split(/\s+/);

    for (let n = 2; n <= Math.min(5, words.length); n++) {
      for (let start = 0; start <= words.length - n; start++) {
        const phrase = words.slice(start, start + n).join(" ");
        if (!phrase || phrase.length < 3) continue;

        const phraseWords = phrase.split(" ");
        if (phraseWords.every((w) => STOPWORDS.has(w))) continue;
        if (GENERIC_PHRASES.has(phrase)) continue;

        const nonStopWords = phraseWords.filter((w) => !STOPWORDS.has(w));
        if (nonStopWords.length === 0) continue;

        if (!phraseVideoIndices.has(phrase))
          phraseVideoIndices.set(phrase, new Set());
        phraseVideoIndices.get(phrase)!.add(i);
      }
    }
  }

  const result: RepeatedPhrase[] = [];

  for (const [phrase, indices] of phraseVideoIndices) {
    const videoCount = indices.size;
    if (videoCount < 2) continue;

    let channelCount = 0;
    if (videos) {
      const channels = new Set<string>();
      for (const idx of indices) {
        const v = videos[idx];
        if (v?.channelId) channels.add(v.channelId);
      }
      channelCount = channels.size;
    }

    result.push({
      phrase,
      count: videoCount,
      videoCount,
      channelCount,
      score: 0,
    });
  }

  const totalVideos = titles.length;
  const totalChannels = videos
    ? new Set(videos.map((v) => v.channelId).filter(Boolean)).size
    : totalVideos;

  for (const item of result) {
    const videoCoverage = totalVideos > 0 ? item.videoCount / totalVideos : 0;
    const channelCoverage =
      totalChannels > 0 ? item.channelCount / totalChannels : 0;
    const phraseTokens = item.phrase.split(" ");
    const hasDomainToken = phraseTokens.some((t) => DOMAIN_TOKENS.has(t));
    const specificRatio =
      phraseTokens.filter((t) => !STOPWORDS.has(t)).length / phraseTokens.length;
    const specificityScore = hasDomainToken ? 1 : specificRatio;

    let viewsSignal = 0;
    if (videos) {
      let bestVpd = 0;
      for (const idx of phraseVideoIndices.get(item.phrase)!) {
        const v = videos[idx];
        if (v) {
          const age = v.publishedAt
            ? Math.max(
                1,
                (new Date().getTime() - new Date(v.publishedAt).getTime()) /
                  86_400_000,
              )
            : 1;
          const vpd = Number(v.viewCount ?? 0) / age;
          if (vpd > bestVpd) bestVpd = vpd;
        }
      }
      viewsSignal = Math.min(bestVpd / 100000, 1);
    }

    const startsOrEndsWithStopword =
      STOPWORDS.has(phraseTokens[0]) ||
      STOPWORDS.has(phraseTokens[phraseTokens.length - 1]);
    const structuralBonus = startsOrEndsWithStopword ? -0.1 : 0;

    const anchoredPhraseBoost = hasSubjectAnchor(item.phrase) ? 0.20 : 0;
    const hasAction = ACTION_ONLY_PATTERNS.some((p) => p.test(item.phrase));
    const completeActionBoost = hasSubjectAnchor(item.phrase) && hasAction ? 0.20 : 0;
    const fragmentPenalty = isActionOnlyPhrase(item.phrase) && !hasSubjectAnchor(item.phrase) ? -1 : 0;

    item.score =
      videoCoverage * 0.35 +
      channelCoverage * 0.25 +
      specificityScore * 0.25 +
      viewsSignal * 0.15 +
      structuralBonus +
      anchoredPhraseBoost +
      completeActionBoost +
      fragmentPenalty;
  }

  return result.sort((a, b) => b.score - a.score);
}

export function normalizeText(title: string): string[] {
  const cleaned = removeEmoji(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned.split(/\s+/).filter((t) => !STOPWORDS.has(t) && t.length > 0);
}

export function computeTitleTokenCohesion(
  titles: string[],
): TitleTokenCohesionResult {
  const normalizedTitles = titles.map((t) => normalizeText(t));
  const tokenCounts = new Map<string, number>();

  for (const tokens of normalizedTitles) {
    const seen = new Set<string>();
    for (const token of tokens) {
      if (!seen.has(token)) {
        seen.add(token);
        tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
      }
    }
  }

  const sorted = [...tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([token, count]) => ({ token, count }));

  const top10 = sorted.slice(0, 10).map((t) => t.token);
  const top3 = sorted.slice(0, 3).map((t) => t.token);

  const totalVideos = titles.length;
  let videosWithTop10 = 0;
  let videosWithTop3 = 0;

  for (const tokens of normalizedTitles) {
    if (top10.some((t) => tokens.includes(t))) videosWithTop10++;
    if (top3.some((t) => tokens.includes(t))) videosWithTop3++;
  }

  return {
    topTokens: sorted,
    tokenCoverage:
      totalVideos > 0
        ? Math.round((videosWithTop10 / totalVideos) * 10000) / 10000
        : 0,
    topTokenConcentration:
      totalVideos > 0
        ? Math.round((videosWithTop3 / totalVideos) * 10000) / 10000
        : 0,
  };
}

export function computeRepeatedPatterns(
  videos: NicheCohesionVideoInput[],
  now = new Date(),
): { repeatedPatterns: RepeatedPattern[]; patternCoverage: number } {
  if (videos.length === 0) return { repeatedPatterns: [], patternCoverage: 0 };

  const videosById = new Map<string, NicheCohesionVideoInput>();
  for (const v of videos) {
    if (!videosById.has(v.internalVideoId)) {
      videosById.set(v.internalVideoId, v);
    }
  }
  const uniqueVideos = [...videosById.values()];

  const patternMatches = new Map<string, NicheCohesionVideoInput[]>();
  for (const pat of PATTERNS) {
    patternMatches.set(pat.name, []);
  }

  for (const video of uniqueVideos) {
    for (const pat of PATTERNS) {
      if (pat.regex.test(video.title)) {
        patternMatches.get(pat.name)!.push(video);
      }
    }
  }

  const repeatedPatterns: RepeatedPattern[] = [];
  const matchedVideoIds = new Set<string>();

  for (const pat of PATTERNS) {
    const matchingVideos = patternMatches.get(pat.name)!;
    if (matchingVideos.length < 3) continue;

    const uniqueChannels = new Set(matchingVideos.map((v) => v.channelId)).size;
    const viewsPerDayList = matchingVideos.map((v) => {
      const age = v.publishedAt
        ? Math.max(
            1,
            (now.getTime() - new Date(v.publishedAt).getTime()) / 86_400_000,
          )
        : 1;
      return Number(v.viewCount ?? 0) / age;
    });
    const med = median(viewsPerDayList);
    const best = viewsPerDayList.length ? Math.max(...viewsPerDayList) : 0;

    repeatedPatterns.push({
      name: pat.name,
      videoCount: matchingVideos.length,
      uniqueChannels,
      medianViewsPerDay: Math.round(med * 100) / 100,
      bestViewsPerDay: Math.round(best * 100) / 100,
    });

    for (const v of matchingVideos) {
      matchedVideoIds.add(v.internalVideoId);
    }
  }

  repeatedPatterns.sort((a, b) => b.videoCount - a.videoCount);

  return {
    repeatedPatterns,
    patternCoverage:
      uniqueVideos.length > 0
        ? Math.round(
            (matchedVideoIds.size / uniqueVideos.length) * 10000,
          ) / 10000
        : 0,
  };
}

export function computeChannelRepeatability(
  videos: NicheCohesionVideoInput[],
): ChannelRepeatabilityResult {
  const videosById = new Map<string, NicheCohesionVideoInput>();
  for (const v of videos) {
    if (!videosById.has(v.internalVideoId)) {
      videosById.set(v.internalVideoId, v);
    }
  }
  const uniqueVideos = [...videosById.values()];

  const channelVideoCounts = new Map<string, number>();
  for (const v of uniqueVideos) {
    channelVideoCounts.set(
      v.channelId,
      (channelVideoCounts.get(v.channelId) ?? 0) + 1,
    );
  }

  const uniqueChannels = channelVideoCounts.size;
  let channelsWithMultipleVideos = 0;
  for (const count of channelVideoCounts.values()) {
    if (count > 1) channelsWithMultipleVideos++;
  }

  const sortedByCount = [...channelVideoCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );

  const top5Count = sortedByCount
    .slice(0, 5)
    .reduce((sum, [, count]) => sum + count, 0);

  return {
    channelsWithMultipleVideos,
    uniqueChannels,
    repeatChannelRatio:
      uniqueChannels > 0
        ? Math.round((channelsWithMultipleVideos / uniqueChannels) * 10000) /
          10000
        : 0,
    avgVideosPerChannel:
      uniqueChannels > 0
        ? Math.round(
            (uniqueVideos.length / uniqueChannels) * 10000,
          ) / 10000
        : 0,
    topChannelDominance:
      uniqueVideos.length > 0
        ? Math.round((top5Count / uniqueVideos.length) * 10000) / 10000
        : 0,
  };
}

export function computeQueryOverlap(
  rows: NicheCohesionVideoInput[],
): QueryOverlapResult {
  const queryGroups = new Map<string, NicheCohesionVideoInput[]>();
  for (const row of rows) {
    const group = queryGroups.get(row.query) ?? [];
    group.push(row);
    queryGroups.set(row.query, group);
  }

  const queries = [...queryGroups.keys()];
  if (queries.length <= 1) {
    return {
      averageQueryChannelOverlap: 0,
      averageQueryTokenOverlap: 0,
      queryOverlapScore: 0,
    };
  }

  const queryChannels = new Map<string, Set<string>>();
  const queryTokens = new Map<string, Set<string>>();

  for (const [q, qRows] of queryGroups) {
    const uniqueVideosMap = new Map<string, NicheCohesionVideoInput>();
    for (const row of qRows) uniqueVideosMap.set(row.internalVideoId, row);

    const channels = new Set(qRows.map((r) => r.channelId));
    queryChannels.set(q, channels);

    const tokens = new Set<string>();
    for (const row of qRows) {
      const normalized = normalizeText(row.title);
      for (const token of normalized) tokens.add(token);
    }
    queryTokens.set(q, tokens);
  }

  let totalChannelOverlap = 0;
  let totalTokenOverlap = 0;
  let pairCount = 0;

  for (let i = 0; i < queries.length; i++) {
    for (let j = i + 1; j < queries.length; j++) {
      const channelsA = queryChannels.get(queries[i])!;
      const channelsB = queryChannels.get(queries[j])!;
      const channelIntersection = [...channelsA].filter((c) =>
        channelsB.has(c),
      ).length;
      const channelUnion = new Set([...channelsA, ...channelsB]).size;
      totalChannelOverlap +=
        channelUnion > 0 ? channelIntersection / channelUnion : 0;

      const tokensA = queryTokens.get(queries[i])!;
      const tokensB = queryTokens.get(queries[j])!;
      const tokenIntersection = [...tokensA].filter((t) => tokensB.has(t))
        .length;
      const tokenUnion = new Set([...tokensA, ...tokensB]).size;
      totalTokenOverlap +=
        tokenUnion > 0 ? tokenIntersection / tokenUnion : 0;

      pairCount++;
    }
  }

  const avgChannelOverlap =
    pairCount > 0
      ? Math.round((totalChannelOverlap / pairCount) * 10000) / 10000
      : 0;
  const avgTokenOverlap =
    pairCount > 0
      ? Math.round((totalTokenOverlap / pairCount) * 10000) / 10000
      : 0;

  return {
    averageQueryChannelOverlap: avgChannelOverlap,
    averageQueryTokenOverlap: avgTokenOverlap,
    queryOverlapScore: Math.round(((avgChannelOverlap + avgTokenOverlap) / 2) * 10000) / 10000,
  };
}

export function computeBroadnessWarnings(metrics: {
  titleTokenCohesion: TitleTokenCohesionResult;
  patternCoverage: number;
  channelRepeatability: ChannelRepeatabilityResult;
}): string[] {
  const warnings: string[] = [];
  let hasLowCohesion = false;

  if (metrics.titleTokenCohesion.tokenCoverage < 0.3) {
    warnings.push(
      "LOW_TITLE_COHESION: Few shared non-generic tokens across video titles.",
    );
    hasLowCohesion = true;
  }

  if (metrics.patternCoverage < 0.2) {
    warnings.push(
      "LOW_PATTERN_COVERAGE: Few repeated title patterns detected.",
    );
    hasLowCohesion = true;
  }

  if (metrics.channelRepeatability.repeatChannelRatio < 0.1) {
    warnings.push(
      "LOW_CHANNEL_REPEATABILITY: Almost every channel appears only once.",
    );
    hasLowCohesion = true;
  }

  const topTokenText = metrics.titleTokenCohesion.topTokens
    .slice(0, 5)
    .map((t) => t.token)
    .join(" ");
  const topTokenWords = topTokenText.split(/\s+/).filter(Boolean);
  const stopRatio =
    topTokenWords.length > 0
      ? topTokenWords.filter((w) => STOPWORDS.has(w)).length /
        topTokenWords.length
      : 1;
  if (stopRatio > 0.5) {
    warnings.push(
      "QUERY_TOO_GENERIC: Top tokens are mostly generic or query words.",
    );
  }

  if (hasLowCohesion) {
    warnings.unshift(
      "Run appears broad: low token cohesion and low repeated format coverage.",
    );
  }

  return warnings;
}

export function computeSuggestedNarrowing(
  topTokens: TokenFrequency[],
  repeatedPatterns: RepeatedPattern[],
): string[] {
  const tokens = topTokens.slice(0, 5).map((t) => t.token);
  if (tokens.length === 0) return [];

  const suggestions: string[] = [];

  if (tokens.length >= 2) {
    suggestions.push(
      `what if ${tokens.slice(0, 3).join(" ")}`,
    );
  }

  if (tokens.length >= 2) {
    suggestions.push(
      `${tokens.slice(0, 2).join(" ")} what if shorts`,
    );
  }

  if (tokens.length >= 3) {
    suggestions.push(tokens.slice(0, 4).join(" "));
  }

  const hasPatterns = repeatedPatterns.length > 0;
  if (hasPatterns) {
    const patternName = repeatedPatterns[0].name
      .replace(/[\s*]/g, "")
      .trim();
    suggestions.push(`${tokens[0]} ${patternName} shorts`);
  } else {
    suggestions.push(`${tokens.slice(0, 2).join(" ")} shorts`);
  }

  if (tokens.length >= 2) {
    suggestions.push(`${tokens[0]} ${tokens[1]} experiment`);
  }

  return [...new Set(suggestions)].slice(0, 5);
}

export function generateSuggestedNarrowedQueries(
  titles: string[],
  _topTokens: TokenFrequency[],
  repeatedPatterns: RepeatedPattern[],
  videos?: NicheCohesionVideoInput[],
  existingQueries?: string[],
  branchSuggestedQueries?: string[],
): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();
  const existingLower = new Set(
    (existingQueries ?? []).map((q) => q.trim().toLowerCase()),
  );

  const phrases = extractRepeatedTitlePhrases(titles, videos);
  const topPhrases = phrases.slice(0, 5);

  const templateSuffixes: string[] = [];
  if (repeatedPatterns.some((p) => p.name.includes("animation")))
    templateSuffixes.push("animation");
  if (repeatedPatterns.some((p) => p.name.includes("explained")))
    templateSuffixes.push("explained");
  if (repeatedPatterns.some((p) => p.name.includes("experiment")))
    templateSuffixes.push("experiment");
  if (repeatedPatterns.some((p) => p.name.includes("simulator")))
    templateSuffixes.push("simulator");
  if (repeatedPatterns.some((p) => p.name.includes("challenge")))
    templateSuffixes.push("challenge");
  if (templateSuffixes.length === 0) {
    templateSuffixes.push("shorts");
  }

  for (const phraseObj of topPhrases) {
    const phrase = phraseObj.phrase;

    if (isActionOnlyPhrase(phrase) && !hasSubjectAnchor(phrase)) continue;

    const templates = [
      `what if ${phrase}`,
      `${phrase} shorts`,
      ...templateSuffixes.map((s) => `${phrase} ${s}`),
      `what happens if ${phrase}`,
    ];

    for (const tpl of templates) {
      const normalized = tpl.trim().replace(/\s+/g, " ");
      const wordCount = normalized.split(/\s+/).length;
      if (wordCount < 3 && !DOMAIN_TOKENS.has(phrase)) continue;

      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      if (existingLower.has(key)) continue;

      seen.add(key);
      suggestions.push(normalized);
    }
  }

  if (branchSuggestedQueries) {
    for (const q of branchSuggestedQueries) {
      const normalized = q.trim().replace(/\s+/g, " ");
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      if (existingLower.has(key)) continue;
      seen.add(key);
      suggestions.push(normalized);
    }
  }

  if (suggestions.length < 3) {
    for (const phraseObj of topPhrases) {
      if (isActionOnlyPhrase(phraseObj.phrase) && !hasSubjectAnchor(phraseObj.phrase)) continue;
      const key = phraseObj.phrase.toLowerCase();
      if (seen.has(key)) continue;
      if (existingLower.has(key)) continue;
      seen.add(key);
      suggestions.push(phraseObj.phrase);
      if (suggestions.length >= 5) break;
    }
  }

  return [...new Set(suggestions)].filter(isValidSuggestedQuery).slice(0, 10);
}

export function computeNicheCohesion(
  rows: NicheCohesionVideoInput[],
  now = new Date(),
): NicheCohesionMetrics {
  const uniqueVideosMap = new Map<string, NicheCohesionVideoInput>();
  for (const row of rows) {
    if (!uniqueVideosMap.has(row.internalVideoId)) {
      uniqueVideosMap.set(row.internalVideoId, row);
    }
  }
  const uniqueVideos = [...uniqueVideosMap.values()];
  const titles = uniqueVideos.map((v) => v.title);

  const titleTokenCohesion = computeTitleTokenCohesion(titles);
  const { repeatedPatterns, patternCoverage } =
    computeRepeatedPatterns(uniqueVideos, now);
  const channelRepeatability = computeChannelRepeatability(uniqueVideos);
  const queryOverlap = computeQueryOverlap(rows);

  const repeatChannelRatioNormalized = Math.min(
    channelRepeatability.repeatChannelRatio / 0.25,
    1,
  );

  const nicheCohesionScore =
    titleTokenCohesion.tokenCoverage * 0.3 +
    patternCoverage * 0.3 +
    repeatChannelRatioNormalized * 0.2 +
    queryOverlap.queryOverlapScore * 0.2;

  const roundedScore = Math.round(nicheCohesionScore * 10000) / 10000;

  const cohesionLabel =
    roundedScore < 0.3
      ? "Too broad"
      : roundedScore < 0.6
        ? "Mixed"
        : roundedScore < 0.8
          ? "Focused"
          : "Highly focused";

  const broadnessWarnings = computeBroadnessWarnings({
    titleTokenCohesion,
    patternCoverage,
    channelRepeatability,
  });

  const suggestedNarrowedQueries = generateSuggestedNarrowedQueries(
    titles,
    titleTokenCohesion.topTokens,
    repeatedPatterns,
    uniqueVideos,
  );

  return {
    titleTokenCohesion,
    repeatedPatterns,
    patternCoverage: Math.round(patternCoverage * 10000) / 10000,
    channelRepeatability,
    queryOverlap,
    nicheCohesionScore: roundedScore,
    cohesionLabel,
    broadnessWarnings,
    suggestedNarrowedQueries,
  };
}

export function computeQueryCohesion(
  qRows: NicheCohesionVideoInput[],
  topTokens: string[],
): QueryCohesionResult {
  const query = qRows[0]?.query ?? "";
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const nonStopWords = words.filter((w) => !STOPWORDS.has(w));

  const warnings: string[] = [];

  if (words.length <= 2) {
    warnings.push("Query is very short (≤2 words), likely too generic.");
  }

  if (nonStopWords.length === 0) {
    warnings.push("Query consists entirely of stop words.");
  }

  const qVideosMap = new Map<string, NicheCohesionVideoInput>();
  for (const row of qRows) qVideosMap.set(row.internalVideoId, row);
  const qUniqueVideos = [...qVideosMap.values()];
  const totalVideos = qUniqueVideos.length;

  if (totalVideos > 5) {
    const uniqueChannels = new Set(qRows.map((r) => r.channelId)).size;
    if (uniqueChannels > totalVideos * 0.8) {
      warnings.push(
        "Query returns many unique channels with low repeatability.",
      );
    }
  }

  let countWithTopToken = 0;
  for (const video of qUniqueVideos) {
    const tokens = normalizeText(video.title);
    if (tokens.some((t) => topTokens.includes(t))) {
      countWithTopToken++;
    }
  }
  const cohesionContribution =
    totalVideos > 0
      ? Math.round((countWithTopToken / totalVideos) * 10000) / 10000
      : 0;

  return {
    cohesionContribution,
    genericQueryWarning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}
