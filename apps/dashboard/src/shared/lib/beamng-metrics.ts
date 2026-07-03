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
    viewsPerDay: ageDays !== null && ageDays > 0 ? +(views / ageDays).toFixed(1) : views > 0 ? views : null,
    likesPer1000Views: views > 0 ? +((likes / views) * 1000).toFixed(2) : null,
    commentsPer1000Views: views > 0 ? +((comments / views) * 1000).toFixed(2) : null,
    engagementRate: views > 0 ? +(((likes + comments) / views) * 100).toFixed(3) : null,
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
