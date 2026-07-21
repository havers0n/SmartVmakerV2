import { and, asc, countDistinct, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import {
  discoveryRuns,
  discoveryRunSteps,
  discoveryClusters,
  discoveryClusterVideos,
  discoveryVideoEmbeddings,
  nicheQueries,
  niches,
  videoDiscoveries,
  youtubeChannels,
  youtubeVideos,
} from "@/shared/lib/schema";
import {
  computeDiscoveryClusters,
  computeTokenDiscoveryClusters,
  embeddingFingerprint,
  generateDiscoveryEmbedding,
  generateLocalDiscoveryEmbeddings,
  getDiscoveryCandidateSignals,
  deriveDiscoveryFormatDetails,
  labelDiscoveryCluster,
  generateDiscoveryRunSummary,
  type ComputedDiscoveryCluster,
  type DiscoveryIntelligenceVideo,
} from "./discovery-intelligence";
import {
  computeNicheCohesion,
  computeQueryCohesion,
  generateSuggestedNarrowedQueries,
} from "@/shared/lib/niche-cohesion";
import {
  generateNicheBranches,
  mapQueriesToBranches,
} from "@/shared/lib/niche-branching";
import { createLogger } from "@aec/logger";
import {
  getYouTubeChannelsByIds,
  searchYouTubeDiscoveryPage,
  searchYouTubeForDiscovery,
  type YouTubeSearchOrder,
} from "@/shared/lib/youtube";
import {
  calculateDiscoveryRetryDelay,
  classifyDiscoveryExecutionError,
  DiscoveryLeaseLostError,
  DiscoveryMalformedCheckpointError,
} from "./discovery-execution-errors";

const logger = createLogger({ name: "discovery-runs" });

const searchOrderSchema = z.enum(["relevance", "viewCount", "date"]);

export const discoveryChannelFiltersSchema = z.object({
  maxChannelAgeMonths: z.coerce.number().nonnegative().optional(),
  minMatchedVideos: z.coerce.number().int().nonnegative().optional(),
  minSubscribers: z.coerce.number().nonnegative().optional(),
  maxSubscribers: z.coerce.number().nonnegative().optional(),
  minMedianViews: z.coerce.number().nonnegative().optional(),
  minRelevanceScore: z.coerce.number().min(0).max(1).optional(),
  minQueryCoverage: z.coerce.number().int().nonnegative().optional(),
  minMedianViewsPerDay: z.coerce.number().nonnegative().optional(),
});

export type DiscoveryChannelFilters = z.infer<
  typeof discoveryChannelFiltersSchema
>;

export type DiscoveryChannelEvidenceRow = {
  channelId: string;
  channelTitle: string | null;
  channelPublishedAt: string | null;
  subscriberCount: number | null;
  totalViewCount: number | null;
  channelVideoCount: number | null;
  internalVideoId: string;
  youtubeVideoId: string | null;
  title: string;
  publishedAt: string | null;
  viewCount: number | null;
  queryId: string;
  query: string;
  searchOrder: string;
  resultPosition: number;
};

// === Opportunity Analysis Types ===

export type OpportunitySignal = {
  label: string;
  value: string | number;
  description?: string;
};

export type RisingSmallChannel = {
  channelId: string;
  channelTitle: string | null;
  subscriberCount: number | null;
  matchedVideoCount: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
  queryCoverage: number;
  relevanceScore: number;
  topEvidenceVideoTitle: string | null;
};

export type OutlierVideoInfo = {
  videoId: string;
  title: string;
  channelTitle: string | null;
  subscriberCount: number | null;
  viewCount: number | null;
  viewsPerDay: number;
  publishedAt: string | null;
  query: string;
  outlierScore: number;
  confidence: "low" | "medium" | "high";
};

export type QueryPerformanceInfo = {
  query: string;
  totalDiscoveredVideos: number;
  uniqueChannels: number;
  knownSubscriberChannels: number;
  unknownSubscriberChannels: number;
  smallChannelsCount: number;
  medianViewsPerDay: number;
  bestViewsPerDay: number;
  outlierCount: number;
  queryQualityScore: number;
  knownSubscriberCoverage: number;
  dataQualityWarning?: string;
  cohesionContribution?: number;
  genericQueryWarning?: string;
  branchMatches?: string[];
};

export type SubscriberDataQuality = {
  knownCount: number;
  unknownCount: number;
  zeroSubscriberCount: number;
  suspiciousZeroSubscriberCount: number;
  knownCoverage: number;
};

export type OpportunityAnalysis = {
  signals: OpportunitySignal[];
  risingSmallChannels: RisingSmallChannel[];
  outlierVideos: OutlierVideoInfo[];
  queryPerformance: QueryPerformanceInfo[];
  dataQualityWarning?: string;
  subscriberDataQuality?: SubscriberDataQuality;
  nicheCohesion?: import("@/shared/lib/niche-cohesion").NicheCohesionMetrics;
  nicheBranches?: import("@/shared/lib/niche-branching").NicheBranchSuggestion[];
};

export function computeOpportunityAnalysis(
  rows: DiscoveryChannelEvidenceRow[],
  now = new Date(),
): OpportunityAnalysis {
  // Deduplicate videos by internalVideoId
  const uniqueVideosMap = new Map<string, DiscoveryChannelEvidenceRow>();
  for (const row of rows) {
    if (!uniqueVideosMap.has(row.internalVideoId)) {
      uniqueVideosMap.set(row.internalVideoId, row);
    }
  }
  const uniqueVideos = [...uniqueVideosMap.values()];
  const totalUniqueVideos = uniqueVideos.length;
  const channelIdSet = new Set(rows.map((r) => r.channelId));
  const totalUniqueChannels = channelIdSet.size;

  const channels = aggregateDiscoveryChannels(rows, {}, now);
  const channelMap = new Map(channels.map((c) => [c.channelId, c]));

  const knownSubscriberChannels = channels.filter(
    (c) => c.subscriberCount !== null,
  ).length;
  const unknownSubscriberChannels = channels.filter(
    (c) => c.subscriberCount === null,
  ).length;
  const zeroSubscriberChannels = channels.filter(
    (c) => c.subscriberCount === 0,
  ).length;

  const suspiciousZeroSubscriberChannels = channels.filter(
    (c) =>
      c.subscriberCount === 0 &&
      c.evidenceVideos.some((v) => Number(v.viewCount ?? 0) > 1_000_000),
  );
  const suspiciousZeroSubscriberCount = suspiciousZeroSubscriberChannels.length;
  const suspiciousChannelIds = new Set(
    suspiciousZeroSubscriberChannels.map((c) => c.channelId),
  );

  const smallChannels = channels.filter(
    (c) =>
      c.subscriberCount !== null &&
      c.subscriberCount < 10_000 &&
      !suspiciousChannelIds.has(c.channelId),
  );

  const knownSubscriberCoverage =
    totalUniqueChannels > 0 ? knownSubscriberChannels / totalUniqueChannels : 0;

  const suspiciousZeroWarning =
    suspiciousZeroSubscriberCount > 0
      ? "Some channels have suspicious 0 subscriber counts despite high-view videos. Rehydrate channels or treat small-channel signals as unreliable."
      : undefined;

  const dataQualityWarning =
    knownSubscriberCoverage < 0.5 ||
    unknownSubscriberChannels / totalUniqueChannels > 0.3 ||
    (knownSubscriberChannels > 0 &&
      knownSubscriberChannels === smallChannels.length)
      ? "Subscriber data quality is low. Small-channel signals may be unreliable."
      : (suspiciousZeroWarning ?? undefined);

  // Outlier videos
  const outlierVideos: OutlierVideoInfo[] = [];
  for (const video of uniqueVideos) {
    const videoAgeDays = video.publishedAt
      ? Math.max(
          1,
          (now.getTime() - new Date(video.publishedAt).getTime()) / 86_400_000,
        )
      : 1;
    const viewCount = Number(video.viewCount ?? 0);
    const viewsPerDay = viewCount / videoAgeDays;

    const channelData = channelMap.get(video.channelId);
    if (!channelData) continue;
    const channelMedian = channelData.medianViewsPerDay;
    const outlierScore = channelMedian > 0 ? viewsPerDay / channelMedian : 0;

    const evidenceCount = channelData.matchedVideoCount;
    const confidence: "low" | "medium" | "high" =
      evidenceCount >= 5 ? "high" : evidenceCount >= 3 ? "medium" : "low";

    outlierVideos.push({
      videoId: video.youtubeVideoId ?? video.internalVideoId,
      title: video.title,
      channelTitle: video.channelTitle,
      subscriberCount: video.subscriberCount,
      viewCount: video.viewCount,
      viewsPerDay: Math.round(viewsPerDay * 100) / 100,
      publishedAt: video.publishedAt,
      query: video.query,
      outlierScore: Math.round(outlierScore * 100) / 100,
      confidence,
    });
  }

  outlierVideos.sort((a, b) => b.outlierScore - a.outlierScore);
  const topOutlierVideos = outlierVideos.slice(0, 10);
  const outlierCount = outlierVideos.filter((v) => v.outlierScore >= 3).length;

  // Rising small channels
  const risingSmallChannels: RisingSmallChannel[] = smallChannels
    .map((c) => ({
      channelId: c.channelId,
      channelTitle: c.channelTitle,
      subscriberCount: c.subscriberCount,
      matchedVideoCount: c.matchedVideoCount,
      medianViewsPerDay: c.medianViewsPerDay,
      bestViewsPerDay: c.bestViewsPerDay,
      queryCoverage: c.queryCoverage,
      relevanceScore: c.relevanceScore,
      topEvidenceVideoTitle:
        c.evidenceVideos.length > 0
          ? c.evidenceVideos.reduce((best, v) =>
              (v.viewCount ?? 0) > (best.viewCount ?? 0) ? v : best,
            ).title
          : null,
    }))
    .sort((a, b) => {
      if (a.bestViewsPerDay !== b.bestViewsPerDay)
        return b.bestViewsPerDay - a.bestViewsPerDay;
      return b.medianViewsPerDay - a.medianViewsPerDay;
    })
    .slice(0, 10);

  // Query performance
  const queryGroups = new Map<string, DiscoveryChannelEvidenceRow[]>();
  for (const row of rows) {
    const existing = queryGroups.get(row.query) ?? [];
    existing.push(row);
    queryGroups.set(row.query, existing);
  }

  const queryPerformance: QueryPerformanceInfo[] = [];
  for (const [query, qRows] of queryGroups) {
    const qVideosMap = new Map<string, DiscoveryChannelEvidenceRow>();
    for (const row of qRows) qVideosMap.set(row.internalVideoId, row);
    const qUniqueVideos = [...qVideosMap.values()];
    const totalVideos = qUniqueVideos.length;

    const qChannelsSet = new Set(qRows.map((r) => r.channelId));
    const qUniqueChannelCount = qChannelsSet.size;

    const qKnownChannelsSet = new Set(
      qRows.filter((r) => r.subscriberCount !== null).map((r) => r.channelId),
    );
    const qKnownChannelCount = qKnownChannelsSet.size;
    const qUnknownChannelCount = qUniqueChannelCount - qKnownChannelCount;

    const qSmallChannelsSet = new Set(
      qRows
        .filter((r) => r.subscriberCount !== null && r.subscriberCount < 10_000)
        .map((r) => r.channelId),
    );
    const qSmallChannelCount = qSmallChannelsSet.size;

    const qViewsPerDay = qUniqueVideos.map((v) => {
      const age = v.publishedAt
        ? Math.max(
            1,
            (now.getTime() - new Date(v.publishedAt).getTime()) / 86_400_000,
          )
        : 1;
      return Number(v.viewCount ?? 0) / age;
    });
    const qMedianViewsPerDay = median(qViewsPerDay);
    const qBestViewsPerDay = qViewsPerDay.length
      ? Math.max(...qViewsPerDay)
      : 0;

    let qOutlierCount = 0;
    for (const v of qUniqueVideos) {
      const age = v.publishedAt
        ? Math.max(
            1,
            (now.getTime() - new Date(v.publishedAt).getTime()) / 86_400_000,
          )
        : 1;
      const vpd = Number(v.viewCount ?? 0) / age;
      const chData = channelMap.get(v.channelId);
      if (
        chData &&
        chData.medianViewsPerDay > 0 &&
        vpd >= 3 * chData.medianViewsPerDay
      ) {
        qOutlierCount++;
      }
    }

    const smallChannelRatio =
      qKnownChannelCount > 0 ? qSmallChannelCount / qKnownChannelCount : 0;
    const normalizedMedianViewsPerDay = Math.min(
      qMedianViewsPerDay / 10_000,
      1,
    );
    const outlierRatio = totalVideos > 0 ? qOutlierCount / totalVideos : 0;
    const diversityScore =
      totalVideos > 0 ? qUniqueChannelCount / totalVideos : 0;
    const knownSubscriberCoverage =
      qUniqueChannelCount > 0 ? qKnownChannelCount / qUniqueChannelCount : 0;

    const queryQualityScore =
      smallChannelRatio * 0.35 +
      normalizedMedianViewsPerDay * 0.25 +
      outlierRatio * 0.25 +
      diversityScore * 0.15;

    const dataQualityWarning =
      qKnownChannelCount === 0
        ? "Subscriber counts unavailable for this query"
        : undefined;

    queryPerformance.push({
      query,
      totalDiscoveredVideos: totalVideos,
      uniqueChannels: qUniqueChannelCount,
      knownSubscriberChannels: qKnownChannelCount,
      unknownSubscriberChannels: qUnknownChannelCount,
      smallChannelsCount: qSmallChannelCount,
      medianViewsPerDay: Math.round(qMedianViewsPerDay * 100) / 100,
      bestViewsPerDay: Math.round(qBestViewsPerDay * 100) / 100,
      outlierCount: qOutlierCount,
      queryQualityScore: Math.round(queryQualityScore * 10_000) / 10_000,
      knownSubscriberCoverage: Math.round(knownSubscriberCoverage * 100) / 100,
      dataQualityWarning,
    });
  }

  queryPerformance.sort((a, b) => b.queryQualityScore - a.queryQualityScore);

  const nicheCohesion = computeNicheCohesion(rows, now);
  const topTokens = nicheCohesion.titleTokenCohesion.topTokens.map(
    (t) => t.token,
  );
  for (const qp of queryPerformance) {
    const qRows = queryGroups.get(qp.query) ?? [];
    const { cohesionContribution, genericQueryWarning } = computeQueryCohesion(
      qRows,
      topTokens,
    );
    qp.cohesionContribution = cohesionContribution;
    qp.genericQueryWarning = genericQueryWarning;
  }

  const nicheBranches = generateNicheBranches(
    rows,
    nicheCohesion,
    now,
    suspiciousChannelIds,
  );
  if (nicheBranches.length > 0) {
    const queryBranchMap = mapQueriesToBranches(
      queryPerformance,
      nicheBranches,
    );
    for (const qp of queryPerformance) {
      qp.branchMatches = queryBranchMap.get(qp.query);
    }
  }

  const branchQueries = nicheBranches.flatMap((b) => b.suggestedQueries);
  const existingQueryStrings = [...new Set(rows.map((r) => r.query))];
  const titles = uniqueVideos.map((v) => v.title);
  nicheCohesion.suggestedNarrowedQueries = generateSuggestedNarrowedQueries(
    titles,
    nicheCohesion.titleTokenCohesion.topTokens,
    nicheCohesion.repeatedPatterns,
    uniqueVideos,
    existingQueryStrings,
    branchQueries.length > 0 ? branchQueries : undefined,
  );

  const bestQuery =
    queryPerformance.length > 0 ? queryPerformance[0].query : null;
  const signals: OpportunitySignal[] = [
    { label: "Total Unique Videos", value: totalUniqueVideos },
    { label: "Total Unique Channels", value: totalUniqueChannels },
    { label: "Known Subscriber Channels", value: knownSubscriberChannels },
    { label: "Unknown Subscriber Channels", value: unknownSubscriberChannels },
    { label: "Small Channels (<10K known subs)", value: smallChannels.length },
    { label: "Outlier Videos (3x+ channel median)", value: outlierCount },
    ...(bestQuery ? [{ label: "Best Query by Signal", value: bestQuery }] : []),
  ];

  const subscriberDataQuality: SubscriberDataQuality = {
    knownCount: knownSubscriberChannels,
    unknownCount: unknownSubscriberChannels,
    zeroSubscriberCount: zeroSubscriberChannels,
    suspiciousZeroSubscriberCount,
    knownCoverage: Math.round(knownSubscriberCoverage * 100) / 100,
  };

  return {
    signals,
    risingSmallChannels,
    outlierVideos: topOutlierVideos,
    queryPerformance,
    dataQualityWarning,
    subscriberDataQuality,
    nicheCohesion,
    nicheBranches: nicheBranches.length > 0 ? nicheBranches : undefined,
  };
}

export async function analyzeDiscoveryRunOpportunity(id: string) {
  const validId = z.string().uuid().parse(id);
  const now = new Date();

  const rows = await db
    .select({
      channelId: youtubeChannels.youtubeChannelId,
      channelTitle: youtubeChannels.title,
      channelPublishedAt: youtubeChannels.publishedAt,
      subscriberCount: youtubeChannels.subscriberCount,
      totalViewCount: youtubeChannels.viewCount,
      channelVideoCount: youtubeChannels.videoCount,
      internalVideoId: youtubeVideos.id,
      youtubeVideoId: youtubeVideos.youtubeId,
      title: youtubeVideos.title,
      publishedAt: youtubeVideos.publishedAt,
      viewCount: youtubeVideos.viewCount,
      queryId: nicheQueries.id,
      query: nicheQueries.query,
      searchOrder: videoDiscoveries.searchOrder,
      resultPosition: videoDiscoveries.resultPosition,
    })
    .from(videoDiscoveries)
    .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
    .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
    .innerJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(eq(videoDiscoveries.runId, validId));

  return computeOpportunityAnalysis(rows, now);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateRecencyScore(uploadRecencyDays: number | null) {
  if (uploadRecencyDays === null) return 0;
  if (uploadRecencyDays <= 7) return 1;
  if (uploadRecencyDays <= 30) return 0.75;
  if (uploadRecencyDays <= 90) return 0.5;
  if (uploadRecencyDays <= 180) return 0.25;
  return 0;
}

export function aggregateDiscoveryChannels(
  rows: DiscoveryChannelEvidenceRow[],
  filters: DiscoveryChannelFilters = {},
  now = new Date(),
) {
  const channels = new Map<string, DiscoveryChannelEvidenceRow[]>();
  for (const row of rows) {
    const existing = channels.get(row.channelId) ?? [];
    existing.push(row);
    channels.set(row.channelId, existing);
  }

  return Array.from(channels.values(), (channelRows) => {
    const channel = channelRows[0];
    const videos = new Map<string, DiscoveryChannelEvidenceRow>();
    for (const row of channelRows) videos.set(row.internalVideoId, row);
    const uniqueVideos = [...videos.values()];
    const views = uniqueVideos.map((video) => Number(video.viewCount ?? 0));
    const subscribers = Number(channel.subscriberCount ?? 0);
    const latestMatchedVideoAt =
      uniqueVideos
        .map((video) => video.publishedAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    const viewsPerDay = uniqueVideos.map((video) => {
      const videoAgeDays = video.publishedAt
        ? Math.max(
            1,
            (now.getTime() - new Date(video.publishedAt).getTime()) /
              86_400_000,
          )
        : 1;
      return Number(video.viewCount ?? 0) / videoAgeDays;
    });
    const queryCoverage = new Set(channelRows.map((row) => row.queryId)).size;
    const medianViewsPerDay = median(viewsPerDay);
    const bestViewsPerDay = viewsPerDay.length ? Math.max(...viewsPerDay) : 0;
    const uploadRecencyDays = latestMatchedVideoAt
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(latestMatchedVideoAt).getTime()) /
              86_400_000,
          ),
        )
      : null;
    const recencyScore = calculateRecencyScore(uploadRecencyDays);
    const viewsPerSubscriber =
      subscribers > 0 ? median(views) / subscribers : null;
    const viewsPerSubscriberScore =
      viewsPerSubscriber === null ? 0 : Math.min(viewsPerSubscriber / 10, 1);
    const relevanceScore =
      Math.min(uniqueVideos.length / 10, 1) * 0.3 +
      Math.min(queryCoverage / 3, 1) * 0.2 +
      Math.min(medianViewsPerDay / 10_000, 1) * 0.25 +
      recencyScore * 0.15 +
      viewsPerSubscriberScore * 0.1;
    const channelAgeDays = channel.channelPublishedAt
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(channel.channelPublishedAt).getTime()) /
              86_400_000,
          ),
        )
      : null;

    return {
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      channelPublishedAt: channel.channelPublishedAt,
      channelAgeDays,
      subscriberCount: channel.subscriberCount,
      totalViewCount: channel.totalViewCount,
      channelVideoCount: channel.channelVideoCount,
      matchedVideoCount: uniqueVideos.length,
      queryCoverage,
      latestMatchedVideoAt,
      medianMatchedVideoViews: median(views),
      bestMatchedVideoViews: views.length ? Math.max(...views) : 0,
      medianViewsPerDay,
      bestViewsPerDay,
      uploadRecencyDays,
      recencyScore,
      viewsPerSubscriber,
      viewsPerSubscriberScore,
      relevanceScore,
      evidenceVideos: channelRows.map((video) => ({
        videoId: video.youtubeVideoId ?? video.internalVideoId,
        title: video.title,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        queryId: video.queryId,
        query: video.query,
        searchOrder: video.searchOrder,
        resultPosition: video.resultPosition,
      })),
    };
  })
    .filter(
      (channel) =>
        (filters.maxChannelAgeMonths === undefined ||
          (channel.channelAgeDays !== null &&
            channel.channelAgeDays <= filters.maxChannelAgeMonths * 30.4375)) &&
        (filters.minMatchedVideos === undefined ||
          channel.matchedVideoCount >= filters.minMatchedVideos) &&
        (filters.minSubscribers === undefined ||
          Number(channel.subscriberCount ?? 0) >= filters.minSubscribers) &&
        (filters.maxSubscribers === undefined ||
          Number(channel.subscriberCount ?? 0) <= filters.maxSubscribers) &&
        (filters.minMedianViews === undefined ||
          channel.medianMatchedVideoViews >= filters.minMedianViews) &&
        (filters.minRelevanceScore === undefined ||
          channel.relevanceScore >= filters.minRelevanceScore) &&
        (filters.minQueryCoverage === undefined ||
          channel.queryCoverage >= filters.minQueryCoverage) &&
        (filters.minMedianViewsPerDay === undefined ||
          channel.medianViewsPerDay >= filters.minMedianViewsPerDay),
    )
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore ||
        b.matchedVideoCount - a.matchedVideoCount ||
        b.medianMatchedVideoViews - a.medianMatchedVideoViews ||
        Date.parse(b.latestMatchedVideoAt ?? "1970-01-01") -
          Date.parse(a.latestMatchedVideoAt ?? "1970-01-01"),
    );
}

export const DEFAULT_DISCOVERY_REQUEST_BUDGET = 50;
export const MAX_DISCOVERY_REQUEST_BUDGET = 50;

export const createDiscoveryRunSchema = z.object({
  nicheId: z.string().uuid(),
  searchOrders: z
    .array(searchOrderSchema)
    .min(1)
    .max(3)
    .refine(
      (orders) => new Set(orders).size === orders.length,
      "Search orders must be unique",
    )
    .default(["relevance", "viewCount", "date"]),
  maxResultsPerQuery: z.coerce.number().int().min(1).max(50).default(25),
  publishedAfter: z.string().datetime({ offset: true }).optional(),
  requestBudget: z.number().int().min(1).max(MAX_DISCOVERY_REQUEST_BUDGET).default(DEFAULT_DISCOVERY_REQUEST_BUDGET),
});

export class DiscoveryRunError extends Error {
  constructor(
    message: string,
    public readonly runId: string,
  ) {
    super(message);
    this.name = "DiscoveryRunError";
  }
}

export async function listDiscoveryRuns(nicheId: string) {
  const validNicheId = z.string().uuid().parse(nicheId);
  return db
    .select()
    .from(discoveryRuns)
    .where(eq(discoveryRuns.nicheId, validNicheId))
    .orderBy(desc(discoveryRuns.createdAt))
    .limit(20);
}

export async function getDiscoveryRun(id: string) {
  const validId = z.string().uuid().parse(id);
  const [run] = await db
    .select()
    .from(discoveryRuns)
    .where(eq(discoveryRuns.id, validId))
    .limit(1);
  if (!run) return null;

  const [counts] = await db
    .select({
      videoCount: countDistinct(videoDiscoveries.videoId),
      uniqueChannelCount: countDistinct(youtubeVideos.channelId),
    })
    .from(videoDiscoveries)
    .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
    .where(eq(videoDiscoveries.runId, validId));

  return {
    ...run,
    videoCount: Number(counts?.videoCount ?? 0),
    uniqueChannelCount: Number(counts?.uniqueChannelCount ?? 0),
  };
}

export async function listDiscoveryRunVideos(id: string) {
  const validId = z.string().uuid().parse(id);
  return db
    .select({
      videoId: youtubeVideos.id,
      youtubeId: youtubeVideos.youtubeId,
      title: youtubeVideos.title,
      channelTitle: youtubeVideos.channelTitle,
      viewCount: youtubeVideos.viewCount,
      publishedAt: youtubeVideos.publishedAt,
      queryId: nicheQueries.id,
      query: nicheQueries.query,
      searchOrder: videoDiscoveries.searchOrder,
      resultPosition: videoDiscoveries.resultPosition,
    })
    .from(videoDiscoveries)
    .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
    .innerJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(eq(videoDiscoveries.runId, validId))
    .orderBy(
      asc(nicheQueries.query),
      asc(videoDiscoveries.searchOrder),
      asc(videoDiscoveries.resultPosition),
    );
}

export type ResearchCandidate = {
  id: string;
  label: string;
  summary: string;
  researchScore: number;
  adjustedResearchScore: number;
  labelQualityScore: number;
  dominantLanguage: string;
  languageMatchScore: number;
  contentFormat: string;
  audience: string;
  suggestedQueries: string[];
  whyResearchable: string;
  semanticCohesion: number;
  repeatedFormatEvidence: number;
  isOutlier: boolean;
  videoCount: number;
  channelCount: number;
  medianViewsPerDay: number;
  smallChannelCount: number;
  why_boosted: string[];
  why_penalized: string[];
  language_script_score: number;
  shorts_evidence_ratio: number;
  representativeTitles: string[];
  representativeChannels: { channelId: string; title: string | null }[];
  representativeVideos: {
    youtubeId: string | null;
    title: string;
    channelTitle: string | null;
  }[];
  format_name: string;
  confidence_score: number;
  format_summary: string;
  common_hooks: string[];
  common_title_patterns: string[];
  common_emotions: string[];
  typical_duration_range: string;
  likely_visual_style: string;
  repeatability_score: number;
  example_videos: string[];
  example_channels: string[];
  export_to_research: { status: "placeholder"; label: string };
};

export async function listDiscoveryRunResearchCandidates(
  id: string,
  _options: { allowedLanguages?: string[]; includeMultilingual?: boolean } = {},
): Promise<ResearchCandidate[]> {
  const runId = z.string().uuid().parse(id);
  const [run] = await db
    .select({ nicheLanguage: niches.language, nicheName: niches.name })
    .from(discoveryRuns)
    .innerJoin(niches, eq(discoveryRuns.nicheId, niches.id))
    .where(eq(discoveryRuns.id, runId))
    .limit(1);
  if (!run) return [];
  // Research candidates must match the niche language; caller display filters cannot broaden this.
  const allowedLanguages = new Set([run.nicheLanguage.toLowerCase()]);
  const clusters = await db
    .select()
    .from(discoveryClusters)
    .where(eq(discoveryClusters.runId, runId))
    .orderBy(desc(discoveryClusters.adjustedResearchScore));
  if (!clusters.length) return [];

  const members = await db
    .select({
      clusterId: discoveryClusterVideos.clusterId,
      videoId: youtubeVideos.id,
      youtubeId: youtubeVideos.youtubeId,
      title: youtubeVideos.title,
      durationSeconds: youtubeVideos.durationSeconds,
      channelId: youtubeChannels.youtubeChannelId,
      channelTitle: youtubeChannels.title,
      query: nicheQueries.query,
    })
    .from(discoveryClusterVideos)
    .innerJoin(
      youtubeVideos,
      eq(discoveryClusterVideos.videoId, youtubeVideos.id),
    )
    .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
    .innerJoin(
      videoDiscoveries,
      and(
        eq(discoveryClusterVideos.videoId, videoDiscoveries.videoId),
        eq(discoveryClusterVideos.runId, videoDiscoveries.runId),
      ),
    )
    .innerJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(eq(discoveryClusterVideos.runId, runId));

  return clusters
    .filter((cluster) => cluster.videoCount >= 3 && cluster.videoCount <= 50 && cluster.channelCount >= 2 && !cluster.isOutlier)
    .filter((cluster) => allowedLanguages.has(cluster.dominantLanguage))
    .map((cluster) => {
      const clusterMembers = members.filter(
        (member) => member.clusterId === cluster.id,
      );
      const representativeChannels = Array.from(
        new Map(
          clusterMembers.map((member) => [
            member.channelId,
            { channelId: member.channelId, title: member.channelTitle },
          ]),
        ).values(),
      ).slice(0, 3);
      const signals = getDiscoveryCandidateSignals(
        clusterMembers.map(member => ({ ...member, queryEvidence: [member.query], subscriberCount: null, viewCount: null, publishedAt: null })),
        run.nicheName,
        run.nicheLanguage,
        cluster.label,
      );
      return {
        ...cluster,
        researchScore: Number(cluster.researchScore),
        adjustedResearchScore: Number(cluster.adjustedResearchScore),
        labelQualityScore: Number(cluster.labelQualityScore),
        languageMatchScore: Number(cluster.languageMatchScore),
        medianViewsPerDay: Number(cluster.medianViewsPerDay),
        suggestedQueries: cluster.suggestedQueries as string[],
        semanticCohesion: Number(cluster.semanticCohesion),
        repeatedFormatEvidence: Number(cluster.repeatedFormatEvidence),
        why_boosted: signals.whyBoosted,
        why_penalized: signals.whyPenalized,
        language_script_score: signals.languageScriptScore,
        shorts_evidence_ratio: signals.shortsEvidenceRatio,
        representativeChannels,
        representativeVideos: clusterMembers.slice(0, 3).map((member) => ({
          youtubeId: member.youtubeId,
          title: member.title,
          channelTitle: member.channelTitle,
        })),
        format_name: cluster.formatName,
        confidence_score: cluster.confidenceScore,
        format_summary: cluster.formatSummary,
        common_hooks: cluster.commonHooks as string[],
        common_title_patterns: cluster.commonTitlePatterns as string[],
        common_emotions: cluster.commonEmotions as string[],
        typical_duration_range: cluster.typicalDurationRange,
        likely_visual_style: cluster.likelyVisualStyle,
        repeatability_score: cluster.repeatabilityScore,
        example_videos: cluster.exampleVideos as string[],
        example_channels: cluster.exampleChannels as string[],
        export_to_research: { status: "placeholder" as const, label: "Send to Research (coming soon)" },
        _candidateEligible: signals.eligible,
      };
    })
    .filter(candidate => candidate._candidateEligible)
    .map(({ _candidateEligible: _unused, ...candidate }) => candidate)
    .sort((a, b) => b.adjustedResearchScore - a.adjustedResearchScore);
}

export type DiscoveryClusterCurationVideo = {
  videoId: string;
  youtubeId: string | null;
  url: string;
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  viewsPerDay: number;
  language: string;
  isExcluded: boolean;
};

/** Shared by curation and export; excluded videos never enter the research dataset. */
export function getIncludedDiscoveryCurationVideos<T extends { isExcluded: boolean }>(
  videos: T[],
) {
  return videos.filter((video) => !video.isExcluded);
}

/** Returns the unique videos in one generated format cluster for manual curation. */
export async function listDiscoveryClusterCurationVideos(
  runId: string,
  candidateId: string,
): Promise<DiscoveryClusterCurationVideo[] | null> {
  const validRunId = z.string().uuid().parse(runId);
  const validCandidateId = z.string().uuid().parse(candidateId);
  const [cluster] = await db
    .select({ id: discoveryClusters.id, dominantLanguage: discoveryClusters.dominantLanguage })
    .from(discoveryClusters)
    .where(and(eq(discoveryClusters.id, validCandidateId), eq(discoveryClusters.runId, validRunId)))
    .limit(1);
  if (!cluster) return null;

  const rows = await db
    .select({
      videoId: youtubeVideos.id,
      youtubeId: youtubeVideos.youtubeId,
      url: youtubeVideos.url,
      title: youtubeVideos.title,
      channelTitle: youtubeChannels.title,
      durationSeconds: youtubeVideos.durationSeconds,
      viewCount: youtubeVideos.viewCount,
      publishedAt: youtubeVideos.publishedAt,
      isExcluded: discoveryClusterVideos.isExcluded,
    })
    .from(discoveryClusterVideos)
    .innerJoin(youtubeVideos, eq(discoveryClusterVideos.videoId, youtubeVideos.id))
    .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
    .where(and(eq(discoveryClusterVideos.runId, validRunId), eq(discoveryClusterVideos.clusterId, validCandidateId)));

  return rows.map((row) => ({
    ...row,
    language: cluster.dominantLanguage,
    viewsPerDay: computeResearchCandidateViewsPerDay(row.viewCount, row.publishedAt),
  }));
}

export async function setDiscoveryClusterCurationExcluded(
  runId: string,
  candidateId: string,
  videoIds: string[],
  isExcluded: boolean,
) {
  const validRunId = z.string().uuid().parse(runId);
  const validCandidateId = z.string().uuid().parse(candidateId);
  const validVideoIds = z.array(z.string().uuid()).parse(videoIds);
  if (!validVideoIds.length) return { updated: 0 };
  const updated = await db
    .update(discoveryClusterVideos)
    .set({ isExcluded })
    .where(and(
      eq(discoveryClusterVideos.runId, validRunId),
      eq(discoveryClusterVideos.clusterId, validCandidateId),
      inArray(discoveryClusterVideos.videoId, validVideoIds),
    ))
    .returning({ videoId: discoveryClusterVideos.videoId });
  return { updated: updated.length };
}

/**
 * Rebuilds only persisted content-format evidence for an existing Discovery run.
 * It intentionally preserves cluster membership, labels, and all ranking metrics.
 */
export async function rebuildDiscoveryRunContentFormats(runId: string) {
  const validRunId = z.string().uuid().parse(runId);
  const clusters = await db
    .select()
    .from(discoveryClusters)
    .where(eq(discoveryClusters.runId, validRunId));
  if (!clusters.length) return { updatedClusters: 0 };

  const members = await db
    .select({
      clusterId: discoveryClusterVideos.clusterId,
      videoId: youtubeVideos.id,
      title: youtubeVideos.title,
      channelId: youtubeChannels.youtubeChannelId,
      channelTitle: youtubeChannels.title,
      durationSeconds: youtubeVideos.durationSeconds,
      query: nicheQueries.query,
      isExcluded: discoveryClusterVideos.isExcluded,
    })
    .from(discoveryClusterVideos)
    .innerJoin(youtubeVideos, eq(discoveryClusterVideos.videoId, youtubeVideos.id))
    .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
    .innerJoin(
      videoDiscoveries,
      and(
        eq(discoveryClusterVideos.videoId, videoDiscoveries.videoId),
        eq(discoveryClusterVideos.runId, videoDiscoveries.runId),
      ),
    )
    .innerJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(eq(discoveryClusterVideos.runId, validRunId));

  const membersByCluster = new Map<string, DiscoveryIntelligenceVideo[]>();
  for (const member of members) {
    const clusterMembers = membersByCluster.get(member.clusterId) ?? [];
    const existing = clusterMembers.find((video) => video.videoId === member.videoId);
    if (existing) {
      existing.queryEvidence = [...new Set([...(existing.queryEvidence ?? []), member.query])];
    } else {
      clusterMembers.push({ ...member, queryEvidence: [member.query], subscriberCount: null, viewCount: null, publishedAt: null });
    }
    membersByCluster.set(member.clusterId, clusterMembers);
  }

  await Promise.all(clusters.map(async (cluster) => {
    const format = deriveDiscoveryFormatDetails({
      ...cluster,
      semanticCohesion: Number(cluster.semanticCohesion),
      repeatedFormatEvidence: Number(cluster.repeatedFormatEvidence),
      medianViewsPerDay: Number(cluster.medianViewsPerDay),
    }, membersByCluster.get(cluster.id) ?? []);
    await db
      .update(discoveryClusters)
      .set({
        formatName: format.formatName,
        confidenceScore: format.confidenceScore,
        formatSummary: format.formatSummary,
        commonHooks: format.commonHooks,
        commonTitlePatterns: format.commonTitlePatterns,
        commonEmotions: format.commonEmotions,
        typicalDurationRange: format.typicalDurationRange,
        likelyVisualStyle: format.likelyVisualStyle,
        repeatabilityScore: format.repeatabilityScore,
        exampleVideos: format.exampleVideos,
        exampleChannels: format.exampleChannels,
      })
      .where(and(eq(discoveryClusters.id, cluster.id), eq(discoveryClusters.runId, validRunId)));
  }));

  return { updatedClusters: clusters.length };
}

export const RESEARCH_CANDIDATE_CSV_COLUMNS = [
  "video_id",
  "url",
  "title",
  "channel_id",
  "channel_title",
  "view_count",
  "published_at",
  "views_per_day",
  "candidate_label",
  "candidate_score",
  "shorts_evidence_ratio",
  "language_script_score",
] as const;

export type ResearchCandidateCsvRow = Record<
  (typeof RESEARCH_CANDIDATE_CSV_COLUMNS)[number],
  string | number
>;

function computeResearchCandidateViewsPerDay(
  viewCount: number | null,
  publishedAt: string | null,
  now = new Date(),
) {
  const views = Number(viewCount ?? 0);
  const ageDays = publishedAt
    ? Math.max(
        1,
        (now.getTime() - new Date(publishedAt).getTime()) / 86_400_000,
      )
    : 1;
  return Math.round((views / ageDays) * 100) / 100;
}

function escapeResearchCandidateCsvCell(
  value: string | number | null | undefined,
) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildResearchCandidateCsv(rows: ResearchCandidateCsvRow[]) {
  const header = RESEARCH_CANDIDATE_CSV_COLUMNS.join(",");
  const body = rows
    .map((row) =>
      RESEARCH_CANDIDATE_CSV_COLUMNS.map((column) =>
        escapeResearchCandidateCsvCell(row[column]),
      ).join(","),
    )
    .join("\n");
  return body ? `${header}\n${body}` : header;
}

export function slugifyResearchCandidateLabel(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "candidate";
}

export async function exportDiscoveryRunResearchCandidateCsv(
  runId: string,
  candidateId: string,
) {
  const validRunId = z.string().uuid().parse(runId);
  const validCandidateId = z.string().uuid().parse(candidateId);

  const [cluster] = await db
    .select()
    .from(discoveryClusters)
    .where(
      and(
        eq(discoveryClusters.id, validCandidateId),
        eq(discoveryClusters.runId, validRunId),
      ),
    )
    .limit(1);
  if (!cluster) return null;

  const [run] = await db
    .select({ nicheLanguage: niches.language, nicheName: niches.name })
    .from(discoveryRuns)
    .innerJoin(niches, eq(discoveryRuns.nicheId, niches.id))
    .where(eq(discoveryRuns.id, validRunId))
    .limit(1);
  if (!run) return null;

  const memberRows = await db
    .select({
      videoId: youtubeVideos.id,
      youtubeId: youtubeVideos.youtubeId,
      url: youtubeVideos.url,
      title: youtubeVideos.title,
      channelId: youtubeChannels.youtubeChannelId,
      channelTitle: youtubeChannels.title,
      viewCount: youtubeVideos.viewCount,
      publishedAt: youtubeVideos.publishedAt,
      durationSeconds: youtubeVideos.durationSeconds,
      query: nicheQueries.query,
      isExcluded: discoveryClusterVideos.isExcluded,
    })
    .from(discoveryClusterVideos)
    .innerJoin(
      youtubeVideos,
      eq(discoveryClusterVideos.videoId, youtubeVideos.id),
    )
    .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
    .leftJoin(
      videoDiscoveries,
      and(
        eq(discoveryClusterVideos.videoId, videoDiscoveries.videoId),
        eq(discoveryClusterVideos.runId, videoDiscoveries.runId),
      ),
    )
    .leftJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(
      and(
        eq(discoveryClusterVideos.runId, validRunId),
        eq(discoveryClusterVideos.clusterId, validCandidateId),
      ),
    );

  const videosById = new Map<
    string,
    DiscoveryIntelligenceVideo & {
      youtubeId: string | null;
      url: string;
      isExcluded: boolean;
    }
  >();
  for (const member of memberRows) {
    const existing = videosById.get(member.videoId);
    if (existing) {
      if (member.query && !existing.queryEvidence?.includes(member.query)) {
        existing.queryEvidence?.push(member.query);
      }
      continue;
    }
    videosById.set(member.videoId, {
      videoId: member.videoId,
      youtubeId: member.youtubeId,
      url: member.url,
      title: member.title,
      channelId: member.channelId,
      channelTitle: member.channelTitle,
      subscriberCount: null,
      viewCount: member.viewCount,
      publishedAt: member.publishedAt,
      durationSeconds: member.durationSeconds,
      queryEvidence: member.query ? [member.query] : [],
      isExcluded: member.isExcluded,
    });
  }

  const allVideos = [...videosById.values()];
  const signals = getDiscoveryCandidateSignals(
    allVideos,
    run.nicheName,
    run.nicheLanguage,
    cluster.label,
  );
  const videos = getIncludedDiscoveryCurationVideos(allVideos);
  const now = new Date();
  const candidateScore = Number(cluster.adjustedResearchScore);
  const rows: ResearchCandidateCsvRow[] = videos
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((video) => ({
      video_id: video.youtubeId ?? video.videoId,
      url: video.url,
      title: video.title,
      channel_id: video.channelId,
      channel_title: video.channelTitle ?? "",
      view_count: Number(video.viewCount ?? 0),
      published_at: video.publishedAt ?? "",
      views_per_day: computeResearchCandidateViewsPerDay(
        video.viewCount,
        video.publishedAt,
        now,
      ),
      candidate_label: cluster.label,
      candidate_score: candidateScore,
      shorts_evidence_ratio: signals.shortsEvidenceRatio,
      language_script_score: signals.languageScriptScore,
    }));

  return {
    filename: `research-candidate-${slugifyResearchCandidateLabel(cluster.label)}.csv`,
    csv: buildResearchCandidateCsv(rows),
  };
}

export async function listDiscoveryRunChannels(
  id: string,
  input: DiscoveryChannelFilters = {},
) {
  const validId = z.string().uuid().parse(id);
  const filters = discoveryChannelFiltersSchema.parse(input);
  const rows = await db
    .select({
      channelId: youtubeChannels.youtubeChannelId,
      channelTitle: youtubeChannels.title,
      channelPublishedAt: youtubeChannels.publishedAt,
      subscriberCount: youtubeChannels.subscriberCount,
      totalViewCount: youtubeChannels.viewCount,
      channelVideoCount: youtubeChannels.videoCount,
      internalVideoId: youtubeVideos.id,
      youtubeVideoId: youtubeVideos.youtubeId,
      title: youtubeVideos.title,
      publishedAt: youtubeVideos.publishedAt,
      durationSeconds: youtubeVideos.durationSeconds,
      viewCount: youtubeVideos.viewCount,
      queryId: nicheQueries.id,
      query: nicheQueries.query,
      searchOrder: videoDiscoveries.searchOrder,
      resultPosition: videoDiscoveries.resultPosition,
    })
    .from(videoDiscoveries)
    .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
    .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
    .innerJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(eq(videoDiscoveries.runId, validId))
    .orderBy(asc(videoDiscoveries.createdAt));

  return aggregateDiscoveryChannels(rows, filters);
}

/**
 * Hydrate unique channels in a discovery run with YouTube Data API stats.
 * Fetches subscriberCount, videoCount, viewCount, and other metadata
 * for channels that currently have null or stale zero subscriberCount.
 *
 * @param options.force - When true, hydrate all unique channels regardless of subscriberCount.
 *
 * This is not a fatal step — errors are logged and the run continues.
 */
export async function hydrateDiscoveryRunChannels(
  runId: string,
  options?: { force?: boolean },
): Promise<{
  totalChannelsInRun: number;
  channelsSelectedForHydration: number;
  channelsHydrated: number;
  channelsStillUnknown: number;
  suspiciousZeroSubscriberCountBefore: number;
  suspiciousZeroSubscriberCountAfter: number;
  batchCallsMade: number;
}> {
  const validId = z.string().uuid().parse(runId);
  const defaultResult = {
    totalChannelsInRun: 0,
    channelsSelectedForHydration: 0,
    channelsHydrated: 0,
    channelsStillUnknown: 0,
    suspiciousZeroSubscriberCountBefore: 0,
    suspiciousZeroSubscriberCountAfter: 0,
    batchCallsMade: 0,
  };

  try {
    // Count total unique channels in this run
    const allRows = await db
      .selectDistinct({
        youtubeChannelId: youtubeChannels.youtubeChannelId,
        subscriberCount: youtubeChannels.subscriberCount,
        hiddenSubscriberCount: youtubeChannels.hiddenSubscriberCount,
      })
      .from(videoDiscoveries)
      .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
      .innerJoin(
        youtubeChannels,
        eq(youtubeVideos.channelId, youtubeChannels.id),
      )
      .where(eq(videoDiscoveries.runId, validId));

    const totalChannelsInRun = allRows.length;

    const suspiciousZeroBefore = allRows.filter(
      (r) => r.subscriberCount === 0 && r.hiddenSubscriberCount !== true,
    ).length;

    // Select channels that need hydration:
    // - force mode: all channels
    // - normal mode: null subscriberCount OR (0 subscriberCount AND not hidden)
    const needsHydration = options?.force
      ? allRows
      : allRows.filter(
          (r) =>
            r.subscriberCount === null ||
            (r.subscriberCount === 0 && r.hiddenSubscriberCount !== true),
        );

    const channelIds = needsHydration.map((r) => r.youtubeChannelId);
    if (channelIds.length === 0)
      return { ...defaultResult, totalChannelsInRun };

    const batchCallsMade = Math.ceil(channelIds.length / 50);
    const hydrated = await getYouTubeChannelsByIds(channelIds);
    if (hydrated.length === 0)
      return {
        ...defaultResult,
        totalChannelsInRun,
        channelsSelectedForHydration: channelIds.length,
        batchCallsMade,
      };

    const now = new Date().toISOString();
    for (const info of hydrated) {
      await db
        .insert(youtubeChannels)
        .values({
          youtubeChannelId: info.youtubeChannelId,
          handle: info.handle,
          title: info.title,
          description: info.description,
          country: info.country,
          subscriberCount: info.subscriberCount,
          hiddenSubscriberCount: info.hiddenSubscriberCount,
          videoCount: info.videoCount,
          viewCount: info.viewCount,
          publishedAt: info.publishedAt,
          thumbnailUrl: info.thumbnailUrl,
        })
        .onConflictDoUpdate({
          target: youtubeChannels.youtubeChannelId,
          set: {
            handle: sql`excluded.handle`,
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            country: sql`excluded.country`,
            subscriberCount: sql`excluded.subscriber_count`,
            hiddenSubscriberCount: sql`excluded.hidden_subscriber_count`,
            videoCount: sql`excluded.video_count`,
            viewCount: sql`excluded.view_count`,
            publishedAt: sql`excluded.published_at`,
            thumbnailUrl: sql`excluded.thumbnail_url`,
            updatedAt: now,
          },
        });
    }

    logger.info(
      {
        runId,
        hydratedCount: hydrated.length,
        totalMissing: channelIds.length,
      },
      "Channel hydration completed",
    );

    // Count how many are still unknown / suspicious zero after hydration
    const afterRows = await db
      .selectDistinct({
        subscriberCount: youtubeChannels.subscriberCount,
        hiddenSubscriberCount: youtubeChannels.hiddenSubscriberCount,
      })
      .from(videoDiscoveries)
      .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
      .innerJoin(
        youtubeChannels,
        eq(youtubeVideos.channelId, youtubeChannels.id),
      )
      .where(eq(videoDiscoveries.runId, validId));

    const channelsStillUnknown = afterRows.filter(
      (r) => r.subscriberCount === null,
    ).length;
    const suspiciousZeroAfter = afterRows.filter(
      (r) => r.subscriberCount === 0 && r.hiddenSubscriberCount !== true,
    ).length;

    return {
      totalChannelsInRun,
      channelsSelectedForHydration: channelIds.length,
      channelsHydrated: hydrated.length,
      channelsStillUnknown,
      suspiciousZeroSubscriberCountBefore: suspiciousZeroBefore,
      suspiciousZeroSubscriberCountAfter: suspiciousZeroAfter,
      batchCallsMade,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ runId, error: message }, "Channel hydration failed");
    // Non-fatal: run continues without enriched data
    return defaultResult;
  }
}

export async function rebuildDiscoveryRunIntelligence(runId: string, persistenceDb: typeof db = db) {
  const rows = await persistenceDb
    .select({
      videoId: youtubeVideos.id,
      title: youtubeVideos.title,
      channelId: youtubeChannels.youtubeChannelId,
      channelTitle: youtubeChannels.title,
      subscriberCount: youtubeChannels.subscriberCount,
      viewCount: youtubeVideos.viewCount,
      publishedAt: youtubeVideos.publishedAt,
      durationSeconds: youtubeVideos.durationSeconds,
      query: nicheQueries.query,
    })
    .from(videoDiscoveries)
    .innerJoin(youtubeVideos, eq(videoDiscoveries.videoId, youtubeVideos.id))
    .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
    .innerJoin(nicheQueries, eq(videoDiscoveries.queryId, nicheQueries.id))
    .where(eq(videoDiscoveries.runId, runId));
  const [run] = await persistenceDb
    .select({ nicheLanguage: niches.language, nicheName: niches.name })
    .from(discoveryRuns)
    .innerJoin(niches, eq(discoveryRuns.nicheId, niches.id))
    .where(eq(discoveryRuns.id, runId))
    .limit(1);
  if (!run) throw new Error("Discovery run not found");
  const byVideo = new Map<string, DiscoveryIntelligenceVideo>();
  for (const row of rows) {
    const existing = byVideo.get(row.videoId);
    if (existing) existing.queryEvidence = [...new Set([...(existing.queryEvidence ?? []), row.query])];
    else byVideo.set(row.videoId, { ...row, queryEvidence: [row.query] });
  }
  const videos = [...byVideo.values()];
  const cached = videos.length ? await persistenceDb.select().from(discoveryVideoEmbeddings).where(inArray(discoveryVideoEmbeddings.videoId, videos.map(v => v.videoId))) : [];
  const cachedByVideo = new Map(cached.map(row => [row.videoId, row]));
  const saveEmbedding = async (video: DiscoveryIntelligenceVideo, hash: string, generated: { embedding: number[]; provider: string; model: string }) => {
    video.embedding = generated.embedding; video.embeddingProvider = generated.provider;
    await persistenceDb.insert(discoveryVideoEmbeddings).values({ videoId: video.videoId, contentHash: hash, provider: generated.provider, model: generated.model, embedding: generated.embedding, updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: discoveryVideoEmbeddings.videoId, set: { contentHash: hash, provider: generated.provider, model: generated.model, embedding: generated.embedding, updatedAt: new Date().toISOString() } });
  };
  const needsEmbedding: Array<{ video: DiscoveryIntelligenceVideo; hash: string }> = [];
  for (const video of videos) {
    const hash = embeddingFingerprint(video);
    const previous = cachedByVideo.get(video.videoId);
    if (previous?.contentHash === hash && previous.provider !== "deterministic") { video.embedding = previous.embedding; video.embeddingProvider = previous.provider; }
    else needsEmbedding.push({ video, hash });
  }
  const local = await generateLocalDiscoveryEmbeddings(needsEmbedding.map(item => item.video));
  const localCount = local?.embeddings.length ?? 0;
  await Promise.all(needsEmbedding.slice(0, localCount).map((item, index) => saveEmbedding(item.video, item.hash, { embedding: local!.embeddings[index], provider: local!.provider, model: local!.model })));
  await Promise.all(needsEmbedding.slice(localCount).map(async item => saveEmbedding(item.video, item.hash, await generateDiscoveryEmbedding(item.video))));
  const usesSemanticEmbeddings = videos.every(video => video.embeddingProvider === "local" || video.embeddingProvider === "gemini");
  const clusters: ComputedDiscoveryCluster[] = (usesSemanticEmbeddings ? computeDiscoveryClusters : computeTokenDiscoveryClusters)(videos, new Date(), {
    allowedLanguages: [run.nicheLanguage],
  });
  await Promise.all(clusters.map(async (cluster) => {
    const clusterMembers = cluster.videoIds.map(id => byVideo.get(id)!).filter(Boolean);
    const details = await labelDiscoveryCluster(cluster, clusterMembers);
    cluster.label = details.human_readable_label;
    cluster.summary = details.summary;
    cluster.contentFormat = details.content_format;
    cluster.audience = details.audience;
    cluster.suggestedQueries = details.suggested_queries;
    cluster.whyResearchable = details.why_researchable;
    const format = deriveDiscoveryFormatDetails(cluster, clusterMembers);
    cluster.labelQualityScore = Math.max(cluster.labelQualityScore, cluster.label.length >= 4 && !/[·]/.test(cluster.label) ? 1 : 0);
    const signals = getDiscoveryCandidateSignals(cluster.videoIds.map(id => byVideo.get(id)!).filter(Boolean), run.nicheName, run.nicheLanguage, cluster.label);
    cluster.adjustedResearchScore = Number(Math.max(0, Math.min(1, cluster.researchScore - (cluster.isOutlier ? .55 : 0) + cluster.labelQualityScore * .1 - (cluster.languageMatchScore === 0 ? .25 : 0) + signals.rankingDelta)).toFixed(4));
    cluster.formatDetails = format;
  }));

  const existingMemberships = await persistenceDb
    .select({ videoId: discoveryClusterVideos.videoId, isExcluded: discoveryClusterVideos.isExcluded })
    .from(discoveryClusterVideos)
    .where(eq(discoveryClusterVideos.runId, runId));
  const curatedByVideo = new Map(existingMemberships.map((membership: { videoId: string; isExcluded: boolean }) => [membership.videoId, membership.isExcluded]));
  await persistenceDb
    .delete(discoveryClusterVideos)
    .where(eq(discoveryClusterVideos.runId, runId));
  await persistenceDb.delete(discoveryClusters).where(eq(discoveryClusters.runId, runId));
  if (clusters.length) {
    const saved = await persistenceDb
      .insert(discoveryClusters)
      .values(
        clusters.map((cluster) => ({
          runId,
          label: cluster.label,
          summary: cluster.summary,
          researchScore: String(cluster.researchScore),
          adjustedResearchScore: String(cluster.adjustedResearchScore),
          labelQualityScore: String(cluster.labelQualityScore),
          dominantLanguage: cluster.dominantLanguage,
          languageMatchScore: String(cluster.languageMatchScore),
          contentFormat: cluster.contentFormat,
          audience: cluster.audience,
          suggestedQueries: cluster.suggestedQueries,
          whyResearchable: cluster.whyResearchable,
          semanticCohesion: String(cluster.semanticCohesion),
          repeatedFormatEvidence: String(cluster.repeatedFormatEvidence),
          isOutlier: cluster.isOutlier,
          rawTokenLabel: cluster.rawTokenLabel,
          videoCount: cluster.videoCount,
          channelCount: cluster.channelCount,
          medianViewsPerDay: String(cluster.medianViewsPerDay),
          smallChannelCount: cluster.smallChannelCount,
          representativeTitles: cluster.representativeTitles,
          formatName: cluster.formatDetails!.formatName,
          confidenceScore: cluster.formatDetails!.confidenceScore,
          formatSummary: cluster.formatDetails!.formatSummary,
          commonHooks: cluster.formatDetails!.commonHooks,
          commonTitlePatterns: cluster.formatDetails!.commonTitlePatterns,
          commonEmotions: cluster.formatDetails!.commonEmotions,
          typicalDurationRange: cluster.formatDetails!.typicalDurationRange,
          likelyVisualStyle: cluster.formatDetails!.likelyVisualStyle,
          repeatabilityScore: cluster.formatDetails!.repeatabilityScore,
          exampleVideos: cluster.formatDetails!.exampleVideos,
          exampleChannels: cluster.formatDetails!.exampleChannels,
        })),
      )
      .returning({ id: discoveryClusters.id });
    await persistenceDb.insert(discoveryClusterVideos).values(
      saved.flatMap((cluster, index) =>
        clusters[index].videoIds.map((videoId) => ({
          runId,
          videoId,
          clusterId: cluster.id,
          isExcluded: curatedByVideo.get(videoId) ?? false,
        })),
      ),
    );
  }
  return generateDiscoveryRunSummary(clusters);
}

type DiscoverySnapshot = {
  query: string;
  maxResults: number;
  publishedAfter?: string;
};
type DiscoveryCheckpoint = {
  version: 1;
  nextPageToken: string | null;
  pagesCompleted: number;
  externalRequestCount: number;
  paginationComplete: boolean;
  resultCounters: { videos: number; channels: number };
};

const LEASE_MS = 60_000;

/** Creates immutable work; no external API is called from this function. */
export async function createDiscoveryRun(
  input: unknown,
  idempotencyKey?: string | null,
) {
  const values = createDiscoveryRunSchema.parse(input);
  const existingKey = idempotencyKey?.trim() || null;
  if (existingKey) {
    const [existing] = await db.select().from(discoveryRuns)
      .where(eq(discoveryRuns.idempotencyKey, existingKey)).limit(1);
    if (existing) return existing;
  }
  const queries = await db.select({ id: nicheQueries.id, query: nicheQueries.query })
    .from(nicheQueries).where(and(eq(nicheQueries.nicheId, values.nicheId), eq(nicheQueries.isEnabled, true)))
    .orderBy(asc(nicheQueries.createdAt));
  if (!queries.length) throw new Error("The niche has no enabled discovery queries");
  const [niche] = await db.select({ id: niches.id }).from(niches).where(eq(niches.id, values.nicheId)).limit(1);
  if (!niche) throw new Error("Niche not found");
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const stepCount = queries.length * values.searchOrders.length + 1;
    const [run] = await tx.insert(discoveryRuns).values({
      nicheId: values.nicheId, status: "queued", cutoffDate: values.publishedAfter ?? null,
      searchOrders: values.searchOrders, totalSteps: stepCount, requestBudget: values.requestBudget,
      idempotencyKey: existingKey, updatedAt: now,
    }).returning();
    const snapshotBase = { maxResults: values.maxResultsPerQuery, publishedAfter: values.publishedAfter };
    await tx.insert(discoveryRunSteps).values([
      ...queries.flatMap((query) => values.searchOrders.map((order) => ({
        runId: run.id, stepKey: `search:${query.id}:${order}`, stepType: "search" as const,
        queryId: query.id, querySnapshot: { ...snapshotBase, query: query.query }, searchOrder: order,
      }))),
      { runId: run.id, stepKey: "finalize", stepType: "finalize" as const, querySnapshot: {} },
    ]);
    logger.info({ runId: run.id, totalSteps: stepCount }, "discovery run planned");
    return run;
  });
}

async function persistDiscoverySearchHits(
  persistenceDb: typeof db, runId: string, queryId: string, order: YouTubeSearchOrder, hits: Awaited<ReturnType<typeof searchYouTubeForDiscovery>>,
  afterPersisted: (tx: any, saved: { videos: number; channels: number }) => Promise<boolean>,
) {
  const now = new Date().toISOString();
  return persistenceDb.transaction(async (tx) => {
    if (!hits.length) {
      const owned = await afterPersisted(tx, { videos: 0, channels: 0 });
      if (!owned) throw new DiscoveryLeaseLostError();
      return { videos: 0, channels: 0 };
    }
    const channels = await tx.insert(youtubeChannels).values(Array.from(new Map(hits.map((hit) => [hit.youtubeChannelId, hit])).values(), (hit) => ({ youtubeChannelId: hit.youtubeChannelId, title: hit.channelTitle, subscriberCount: null })))
      .onConflictDoUpdate({ target: youtubeChannels.youtubeChannelId, set: { title: sql`excluded.title`, updatedAt: now } })
      .returning({ id: youtubeChannels.id, youtubeChannelId: youtubeChannels.youtubeChannelId });
    const channelIds = new Map(channels.map((channel) => [channel.youtubeChannelId, channel.id]));
    const videos = await tx.insert(youtubeVideos).values(hits.map((hit) => ({ ...hit.video, channelId: channelIds.get(hit.youtubeChannelId), updatedAt: now })))
      .onConflictDoUpdate({ target: youtubeVideos.youtubeId, set: { url: sql`excluded.url`, title: sql`excluded.title`, description: sql`excluded.description`, publishedAt: sql`excluded.published_at`, channelTitle: sql`excluded.channel_title`, durationSeconds: sql`excluded.duration_seconds`, viewCount: sql`excluded.view_count`, likeCount: sql`excluded.like_count`, commentCount: sql`excluded.comment_count`, tags: sql`excluded.tags`, thumbnails: sql`excluded.thumbnails`, channelId: sql`excluded.channel_id`, updatedAt: now } })
      .returning({ id: youtubeVideos.id, youtubeId: youtubeVideos.youtubeId });
    const videoIds = new Map(videos.map((video) => [video.youtubeId, video.id]));
    await tx.insert(videoDiscoveries).values(hits.map((hit) => ({ runId, videoId: videoIds.get(hit.video.youtubeId!)!, queryId, searchOrder: order, resultPosition: hit.resultPosition })))
      .onConflictDoUpdate({ target: [videoDiscoveries.runId, videoDiscoveries.videoId, videoDiscoveries.queryId, videoDiscoveries.searchOrder], set: { resultPosition: sql`excluded.result_position` } });
    const saved = { videos: videos.length, channels: channels.length };
    const owned = await afterPersisted(tx, saved);
    if (!owned) throw new DiscoveryLeaseLostError();
    return saved;
  });
}

export { calculateDiscoveryRetryDelay, classifyDiscoveryExecutionError, DiscoveryLeaseLostError } from "./discovery-execution-errors";

export type DiscoveryWorkerDependencies = {
  database?: typeof db;
  searchPage?: typeof searchYouTubeDiscoveryPage;
  beforePageExecution?: () => void | Promise<void>;
  afterPageUpserts?: () => void | Promise<void>;
  /** Test seam for failures at the finalization transaction boundary. */
  beforeFinalizationCommit?: () => void | Promise<void>;
};

/** Atomically reserves search.list + videos.list before a page call. */
export async function reserveDiscoveryPageBudget(reservationDb: typeof db, runId: string) {
  const [reserved] = await reservationDb.update(discoveryRuns).set({
    externalRequestCount: sql`${discoveryRuns.externalRequestCount} + 2`,
    updatedAt: new Date().toISOString(), status: "running",
    startedAt: sql`coalesce(${discoveryRuns.startedAt}, now())`,
  }).where(and(eq(discoveryRuns.id, runId), sql`${discoveryRuns.cancelRequestedAt} is null`, sql`${discoveryRuns.externalRequestCount} + 2 <= ${discoveryRuns.requestBudget}`)).returning();
  return reserved;
}

/** Atomically leases one runnable discovery step for a worker. */
export async function claimDiscoveryStep(claimDb: typeof db, workerId: string) {
  // Selection and lease creation are one PostgreSQL statement. SKIP LOCKED lets
  // concurrent workers claim different runnable steps without waiting on a lease.
  // Expired processing rows are candidates directly; they must not pass through
  // retry_wait because now() is fixed for the duration of this transaction.
  const [step] = await claimDb.update(discoveryRunSteps).set({
    status: "processing",
    lockedBy: workerId,
    lockedAt: sql`now()`,
    heartbeatAt: sql`now()`,
    lockExpiresAt: sql`now() + (${LEASE_MS} * interval '1 millisecond')`,
    // available_at is NOT NULL in migration 0025. Expired processing rows are
    // made immediately runnable without changing the existing pending/retry
    // scheduling contract.
    availableAt: sql`case when ${discoveryRunSteps.status} = 'processing' then now() else ${discoveryRunSteps.availableAt} end`,
    startedAt: sql`coalesce(${discoveryRunSteps.startedAt}, now())`,
    attemptCount: sql`${discoveryRunSteps.attemptCount} + 1`,
    lastErrorCode: sql`case when ${discoveryRunSteps.status} = 'processing' then null else ${discoveryRunSteps.lastErrorCode} end`,
    lastErrorMessage: sql`case when ${discoveryRunSteps.status} = 'processing' then null else ${discoveryRunSteps.lastErrorMessage} end`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(discoveryRunSteps.id, sql`(
      with candidate as (
        select candidate.id
        from discovery_run_steps as candidate
        inner join discovery_runs as candidate_run on candidate_run.id = candidate.run_id
        where (
          candidate.status = 'pending'
          or (candidate.status = 'retry_wait' and (candidate.available_at is null or candidate.available_at <= now()))
          or (candidate.status = 'processing' and candidate.lock_expires_at is not null and candidate.lock_expires_at <= now() and candidate.attempt_count < candidate.max_attempts)
        )
        and candidate_run.cancel_requested_at is null
        and candidate_run.status not in ('completed', 'completed_with_errors', 'cancelled', 'failed')
        and (
          candidate.step_type <> 'finalize'
          or not exists (
            select 1 from discovery_run_steps as search_step
            where search_step.run_id = candidate.run_id
              and search_step.step_type = 'search'
              and search_step.status not in ('completed', 'failed', 'cancelled')
          )
        )
        order by candidate.available_at asc nulls first, candidate.created_at asc
        for update of candidate skip locked
        limit 1
      )
      select id from candidate
    )`),
    sql`(
      ${discoveryRunSteps.status} = 'pending'
      or (${discoveryRunSteps.status} = 'retry_wait' and (${discoveryRunSteps.availableAt} is null or ${discoveryRunSteps.availableAt} <= now()))
      or (${discoveryRunSteps.status} = 'processing' and ${discoveryRunSteps.lockExpiresAt} is not null and ${discoveryRunSteps.lockExpiresAt} <= now() and ${discoveryRunSteps.attemptCount} < ${discoveryRunSteps.maxAttempts})
    )`,
  )).returning();
  return step;
}

/** Safely claims and executes at most one step. Suitable for `worker --once`. */
export async function runDiscoveryWorkerOnce(
  workerId = `discovery-${process.pid}`,
  dependencies: DiscoveryWorkerDependencies = {},
) {
  const workerDb = dependencies.database ?? db;
  const step = await claimDiscoveryStep(workerDb, workerId);
  if (!step) return { processed: false };
  logger.info({ runId: step.runId, stepId: step.id, stepType: step.stepType, attempt: step.attemptCount, workerId }, "discovery step claimed");
  const [run] = await workerDb.select().from(discoveryRuns).where(eq(discoveryRuns.id, step.runId)).limit(1);
  if (!run || run.cancelRequestedAt) return cancelClaimedStep(step.id, step.runId, workerDb);
  try {
    if (step.stepType === "finalize") return await finalizeDiscoveryStep(step, run, workerId, workerDb, dependencies.beforeFinalizationCommit);
    await dependencies.beforePageExecution?.();
    const [beforePageRun] = await workerDb.select({ cancelRequestedAt: discoveryRuns.cancelRequestedAt }).from(discoveryRuns).where(eq(discoveryRuns.id, run.id)).limit(1);
    if (beforePageRun?.cancelRequestedAt) return cancelClaimedStep(step.id, step.runId, workerDb);
    // A page may issue search.list + videos.list. Reserve both conservatively before any external call.
    const reserved = await reserveDiscoveryPageBudget(workerDb, run.id);
    if (!reserved) {
      const [latestRun] = await workerDb.select({ cancelRequestedAt: discoveryRuns.cancelRequestedAt }).from(discoveryRuns).where(eq(discoveryRuns.id, run.id)).limit(1);
      if (latestRun?.cancelRequestedAt) return cancelClaimedStep(step.id, step.runId, workerDb);
      await workerDb.update(discoveryRunSteps).set({ status: "blocked_quota", lockedBy: null, lockedAt: null, lockExpiresAt: null, lastErrorCode: "quota_budget_exhausted", lastErrorMessage: "The run request budget has been exhausted", updatedAt: new Date().toISOString() }).where(eq(discoveryRunSteps.id, step.id));
      await workerDb.update(discoveryRuns).set({ status: "blocked", updatedAt: new Date().toISOString() }).where(eq(discoveryRuns.id, run.id));
      return { processed: true, blocked: true };
    }
    const snapshot = step.querySnapshot as DiscoverySnapshot;
    const prior = step.checkpoint as Partial<DiscoveryCheckpoint>;
    if (!prior || typeof prior !== "object" || Array.isArray(prior) || (prior.pagesCompleted !== undefined && (!Number.isInteger(prior.pagesCompleted) || prior.pagesCompleted < 0))) throw new DiscoveryMalformedCheckpointError();
    const page = await (dependencies.searchPage ?? searchYouTubeDiscoveryPage)({ query: snapshot.query, order: step.searchOrder as YouTubeSearchOrder, maxResults: snapshot.maxResults, publishedAfter: snapshot.publishedAfter ? new Date(snapshot.publishedAfter) : undefined, pageToken: prior.nextPageToken });
    const checkpoint: DiscoveryCheckpoint = {
      version: 1, nextPageToken: page.nextPageToken, pagesCompleted: Number(prior.pagesCompleted ?? 0) + 1,
      externalRequestCount: Number(prior.externalRequestCount ?? 0) + page.requestCount,
      paginationComplete: page.nextPageToken === null,
      resultCounters: { videos: Number(prior.resultCounters?.videos ?? 0), channels: Number(prior.resultCounters?.channels ?? 0) },
    };
    await persistDiscoverySearchHits(workerDb, step.runId, step.queryId!, step.searchOrder as YouTubeSearchOrder, page.items, async (tx, persisted) => {
      await dependencies.afterPageUpserts?.();
      checkpoint.resultCounters = { videos: checkpoint.resultCounters.videos + persisted.videos, channels: checkpoint.resultCounters.channels + persisted.channels };
      const [currentRun] = await tx.select({ cancelRequestedAt: discoveryRuns.cancelRequestedAt }).from(discoveryRuns).where(eq(discoveryRuns.id, step.runId)).limit(1);
      const cancelled = Boolean(currentRun?.cancelRequestedAt);
      const [owned] = await tx.update(discoveryRunSteps).set({ status: cancelled ? "cancelled" : checkpoint.paginationComplete ? "completed" : "pending", checkpoint, completedAt: cancelled || checkpoint.paginationComplete ? new Date().toISOString() : null, lockedBy: null, lockedAt: null, lockExpiresAt: null, externalRequestCount: checkpoint.externalRequestCount, estimatedQuotaUnitsUsed: sql`${discoveryRunSteps.estimatedQuotaUnitsUsed} + ${page.estimatedQuotaUnits}`, resultCounters: checkpoint.resultCounters, updatedAt: new Date().toISOString() }).where(and(eq(discoveryRunSteps.id, step.id), eq(discoveryRunSteps.status, "processing"), eq(discoveryRunSteps.lockedBy, workerId), sql`${discoveryRunSteps.lockExpiresAt} > now()`)).returning();
      if (!owned) return false;
      await tx.update(discoveryRuns).set({ estimatedQuotaUnitsUsed: sql`${discoveryRuns.estimatedQuotaUnitsUsed} + ${page.estimatedQuotaUnits}`, updatedAt: new Date().toISOString() }).where(eq(discoveryRuns.id, step.runId));
      if (cancelled) await tx.update(discoveryRuns).set({ status: "cancelled", cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(discoveryRuns.id, step.runId));
      return true;
    });
    logger.info({ runId: step.runId, stepId: step.id, workerId, page: checkpoint.pagesCompleted, externalRequestCount: page.requestCount }, "discovery page persisted");
    return { processed: true, stepId: step.id };
  } catch (error) {
    const result = classifyDiscoveryExecutionError(error);
    if (result.lostLease) return { processed: true, ownershipLost: true };
    const retry = result.retryable && step.attemptCount < step.maxAttempts;
    const availableAt = retry ? new Date(Date.now() + calculateDiscoveryRetryDelay({ attempt: step.attemptCount, baseDelayMs: 1_000, maxDelayMs: 60_000 })).toISOString() : new Date().toISOString();
    const status = result.quotaBlocked ? "blocked_quota" : retry ? "retry_wait" : "failed";
    const [owned] = await workerDb.update(discoveryRunSteps).set({ status, availableAt, lockedBy: null, lockedAt: null, lockExpiresAt: null, lastErrorCode: result.code, lastErrorMessage: result.sanitizedMessage, updatedAt: new Date().toISOString() }).where(and(eq(discoveryRunSteps.id, step.id), eq(discoveryRunSteps.status, "processing"), eq(discoveryRunSteps.lockedBy, workerId), sql`${discoveryRunSteps.lockExpiresAt} > now()`)).returning();
    if (!owned) return { processed: true, ownershipLost: true };
    if (result.quotaBlocked) await workerDb.update(discoveryRuns).set({ status: "blocked", updatedAt: new Date().toISOString() }).where(eq(discoveryRuns.id, step.runId));
    logger.error({ runId: step.runId, stepId: step.id, workerId, errorCode: result.code }, "discovery step failed");
    return { processed: true, failed: !retry && !result.quotaBlocked, blocked: result.quotaBlocked };
  }
}

async function cancelClaimedStep(stepId: string, runId: string, workerDb: typeof db = db) {
  const now = new Date().toISOString();
  await workerDb.transaction(async (tx) => {
    await tx.update(discoveryRunSteps).set({ status: "cancelled", lockedBy: null, lockedAt: null, lockExpiresAt: null, completedAt: now, updatedAt: now }).where(eq(discoveryRunSteps.id, stepId));
    await tx.update(discoveryRuns).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(and(eq(discoveryRuns.id, runId), sql`not exists (select 1 from discovery_run_steps where run_id = ${runId} and status = 'processing')`));
  });
  return { processed: true, cancelled: true };
}

export async function finalizeDiscoveryStep(step: typeof discoveryRunSteps.$inferSelect, run: typeof discoveryRuns.$inferSelect, workerId: string, workerDb: typeof db = db, beforeCommit?: () => void | Promise<void>) {
  const searches = await workerDb.select({ status: discoveryRunSteps.status }).from(discoveryRunSteps).where(and(eq(discoveryRunSteps.runId, run.id), eq(discoveryRunSteps.stepType, "search")));
  if (searches.some((item) => !["completed", "failed", "cancelled"].includes(item.status))) {
    await workerDb.update(discoveryRunSteps).set({ status: "retry_wait", availableAt: new Date(Date.now() + 1_000).toISOString(), lockedBy: null, lockedAt: null, lockExpiresAt: null, updatedAt: new Date().toISOString() }).where(eq(discoveryRunSteps.id, step.id));
    return { processed: true, deferred: true };
  }
  await hydrateDiscoveryRunChannels(run.id);
  const hasErrors = searches.some((item) => item.status !== "completed");
  await workerDb.transaction(async (tx) => {
    const aiSummary = await rebuildDiscoveryRunIntelligence(run.id, tx as unknown as typeof db);
    await beforeCommit?.();
    await tx.update(discoveryRunSteps).set({ status: "completed", completedAt: new Date().toISOString(), lockedBy: null, lockedAt: null, lockExpiresAt: null, updatedAt: new Date().toISOString() }).where(eq(discoveryRunSteps.id, step.id));
    await tx.update(discoveryRuns).set({ status: hasErrors ? "completed_with_errors" : "completed", aiSummary, finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(discoveryRuns.id, run.id));
  });
  logger.info({ runId: run.id, stepId: step.id, workerId }, "discovery run completed");
  return { processed: true, finalized: true };
}

export async function cancelDiscoveryRun(id: string) {
  const runId = z.string().uuid().parse(id); const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.update(discoveryRuns).set({ cancelRequestedAt: sql`coalesce(${discoveryRuns.cancelRequestedAt}, ${now})`, updatedAt: now }).where(eq(discoveryRuns.id, runId));
    await tx.update(discoveryRunSteps).set({ status: "cancelled", completedAt: now, updatedAt: now }).where(and(eq(discoveryRunSteps.runId, runId), sql`${discoveryRunSteps.status} in ('pending', 'retry_wait', 'blocked_quota')`));
    await tx.update(discoveryRuns).set({ status: "cancelled", cancelledAt: sql`coalesce(${discoveryRuns.cancelledAt}, ${now})`, updatedAt: now }).where(and(eq(discoveryRuns.id, runId), sql`not exists (select 1 from discovery_run_steps where run_id = ${runId} and status = 'processing')`));
  });
  return getDiscoveryRun(runId);
}

export async function resumeDiscoveryRun(id: string) {
  const runId = z.string().uuid().parse(id); const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const [run] = await tx.select().from(discoveryRuns).where(eq(discoveryRuns.id, runId)).limit(1);
    if (!run || run.status !== "cancelled") return;
    await tx.update(discoveryRunSteps).set({ status: "pending", availableAt: now, lockedBy: null, lockedAt: null, lockExpiresAt: null, completedAt: null, updatedAt: now }).where(and(eq(discoveryRunSteps.runId, runId), sql`${discoveryRunSteps.status} = 'cancelled'`));
    await tx.update(discoveryRunSteps).set({ status: "pending", availableAt: now, lockedBy: null, lockedAt: null, lockExpiresAt: null, completedAt: null, updatedAt: now }).where(and(eq(discoveryRunSteps.runId, runId), eq(discoveryRunSteps.status, "failed"), sql`${discoveryRunSteps.attemptCount} < ${discoveryRunSteps.maxAttempts}`, sql`${discoveryRunSteps.lastErrorCode} in ('upstream_5xx', 'upstream_timeout', 'rate_limited')`));
    const [runnable] = await tx.select({ id: discoveryRunSteps.id }).from(discoveryRunSteps).where(and(eq(discoveryRunSteps.runId, runId), eq(discoveryRunSteps.status, "pending"))).limit(1);
    if (runnable) await tx.update(discoveryRuns).set({ status: "queued", cancelRequestedAt: null, cancelledAt: null, errorMessage: null, updatedAt: now }).where(eq(discoveryRuns.id, runId));
  });
  return getDiscoveryRun(runId);
}

export async function getDiscoveryRunProgress(id: string) {
  const run = await getDiscoveryRun(id); if (!run) return null;
  const steps = await db.select().from(discoveryRunSteps).where(eq(discoveryRunSteps.runId, id));
  const statuses = Object.fromEntries(["pending", "processing", "retry_wait", "completed", "failed", "cancelled", "blocked_quota"].map((status) => [status, steps.filter((step) => step.status === status).length]));
  const blockedStep = steps.find((step) => step.status === "blocked_quota");
  return { ...run, progress: { totalSteps: run.totalSteps, ...statuses, pagesCompleted: steps.reduce((n, step) => n + Number((step.checkpoint as { pagesCompleted?: number }).pagesCompleted ?? 0), 0), requestsUsed: run.externalRequestCount, requestsRemaining: Math.max(run.requestBudget - run.externalRequestCount, 0), requestBudget: run.requestBudget, blockReason: blockedStep?.lastErrorCode ?? null, estimatedQuotaUnitsUsed: run.estimatedQuotaUnitsUsed, lastError: steps.find((step) => step.lastErrorMessage)?.lastErrorMessage ?? run.errorMessage } };
}
