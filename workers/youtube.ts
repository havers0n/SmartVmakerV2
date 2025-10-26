/**
 * YouTube Data API v3 integration for workers
 */

import { google } from 'googleapis';
import type { NewYouTubeVideo } from '@scrimspec/db';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

export interface YouTubeSearchParams {
  query: string;
  publishedAfter?: Date;
  duration?: 'short' | 'medium' | 'long';
  maxResults?: number;
}

export interface YouTubeSearchResult {
  videos: NewYouTubeVideo[];
  totalResults: number;
}

function mapDurationFilter(duration?: string): 'short' | 'medium' | 'long' | 'any' {
  if (!duration) return 'any';
  switch (duration) {
    case 'short':
      return 'short';
    case 'medium':
      return 'medium';
    case 'long':
      return 'long';
    default:
      return 'any';
  }
}

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

export async function searchYouTubeVideos(
  params: YouTubeSearchParams,
): Promise<YouTubeSearchResult> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const { query, publishedAfter, duration = 'short', maxResults = 50 } = params;

  const searchResponse = await youtube.search.list({
    part: ['snippet'],
    q: query,
    type: ['video'],
    videoDuration: mapDurationFilter(duration),
    publishedAfter: publishedAfter?.toISOString(),
    maxResults,
    order: 'relevance',
  });

  const items = searchResponse.data.items || [];
  if (items.length === 0) {
    return { videos: [], totalResults: 0 };
  }

  const videoIds = items
    .map((item) => item.id?.videoId)
    .filter((id): id is string => !!id);

  const videosResponse = await youtube.videos.list({
    part: ['snippet', 'contentDetails', 'statistics'],
    id: videoIds,
  });

  const videoItems = videosResponse.data.items || [];

  const videos: NewYouTubeVideo[] = videoItems.map((item) => {
    const snippet = item.snippet!;
    const statistics = item.statistics;
    const contentDetails = item.contentDetails;

    return {
      id: item.id!,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      title: snippet.title || 'Untitled',
      description: snippet.description || null,
      publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
      channelTitle: snippet.channelTitle || null,
      durationSeconds: contentDetails?.duration
        ? parseISO8601Duration(contentDetails.duration)
        : null,
      viewCount: statistics?.viewCount ? parseInt(statistics.viewCount, 10) : 0,
      likeCount: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : 0,
      commentCount: statistics?.commentCount
        ? parseInt(statistics.commentCount, 10)
        : 0,
      tags: (snippet.tags as string[]) || [],
    };
  });

  return {
    videos,
    totalResults: searchResponse.data.pageInfo?.totalResults || videos.length,
  };
}
