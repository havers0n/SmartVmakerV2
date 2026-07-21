export interface VideoMetrics {
  viewsPerDay: number | null;
  likesPer1000Views: number | null;
  commentsPer1000Views: number | null;
  engagementRate: number | null;
  videoAgeDays: number | null;
}

export interface VideoWithMetrics {
  id: string;
  youtubeId: string | null;
  title: string;
  url: string;
  description: string | null;
  publishedAt: string | null;
  channelTitle: string | null;
  channelId: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  tags: unknown;
  thumbnails: unknown;
  createdAt: string | null;
  updatedAt: string | null;
  metrics: VideoMetrics;
}

export type DurationBucket =
  | "shorts"
  | "1_5m"
  | "5_10m"
  | "10m_plus"
  | "unknown";
export type OutlierConfidence = "low" | "normal";

export function median(
  numbers: Array<number | null | undefined>,
): number | null {
  const values = numbers.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

export function average(
  numbers: Array<number | null | undefined>,
): number | null {
  const values = numbers.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export function safeDivide(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  return typeof a === "number" &&
    Number.isFinite(a) &&
    typeof b === "number" &&
    Number.isFinite(b) &&
    b !== 0
    ? a / b
    : null;
}

export function computeViewsPerDay(video: {
  viewCount: number | null;
  publishedAt: string | Date | null;
}): number | null {
  if (video.viewCount == null || !video.publishedAt) return null;
  const published = new Date(video.publishedAt).getTime();
  if (!Number.isFinite(published)) return null;
  const ageDays = Math.max(1, (Date.now() - published) / 86_400_000);
  return video.viewCount / ageDays;
}

export function computeDurationBucket(
  durationSeconds: number | null | undefined,
): DurationBucket {
  if (durationSeconds == null) return "unknown";
  if (durationSeconds <= 60) return "shorts";
  if (durationSeconds <= 300) return "1_5m";
  if (durationSeconds <= 600) return "5_10m";
  return "10m_plus";
}

export function computeOutlierScore(
  videoViewsPerDay: number | null | undefined,
  channelMedianViewsPerDay: number | null | undefined,
): number | null {
  return safeDivide(videoViewsPerDay, channelMedianViewsPerDay);
}

export function computeOutlierConfidence(
  channelVideoCount: number,
): OutlierConfidence {
  return channelVideoCount < 5 ? "low" : "normal";
}

export function computeVideoMetrics(
  viewCount: number | null,
  likeCount: number | null,
  commentCount: number | null,
  publishedAt: string | null,
  _durationSeconds: number | null,
): VideoMetrics {
  const views = viewCount ?? 0;
  const likes = likeCount ?? 0;
  const comments = commentCount ?? 0;
  const ageDays = computeAgeDays(publishedAt);

  return {
    viewsPerDay:
      ageDays !== null && ageDays > 0
        ? +(views / ageDays).toFixed(1)
        : views > 0
          ? views
          : null,
    likesPer1000Views: views > 0 ? +((likes / views) * 1000).toFixed(2) : null,
    commentsPer1000Views:
      views > 0 ? +((comments / views) * 1000).toFixed(2) : null,
    engagementRate:
      views > 0 ? +(((likes + comments) / views) * 100).toFixed(3) : null,
    videoAgeDays: ageDays,
  };
}

function computeAgeDays(publishedAt: string | null): number | null {
  if (!publishedAt) return null;
  const published = new Date(publishedAt).getTime();
  if (isNaN(published)) return null;
  const now = Date.now();
  const diffMs = now - published;
  return Math.max(0, +(diffMs / (1000 * 60 * 60 * 24)).toFixed(1));
}
