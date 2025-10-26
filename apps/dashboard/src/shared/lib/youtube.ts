/**
 * YouTube Data API v3 integration
 * Handles video search and metadata fetching
 */

import { google } from 'googleapis';
import type { NewYoutubeVideos } from '@scrimspec/db';

// Initialize YouTube API client
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
  videos: NewYoutubeVideos[];
  totalResults: number;
}

/**
 * Map YouTube API duration to our duration filter
 * short: < 4 minutes
 * medium: 4-20 minutes
 * long: > 20 minutes
 */
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

/**
 * Parse ISO 8601 duration (PT#M#S) to seconds
 * Example: PT15M33S -> 933 seconds
 */
function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Search YouTube videos based on parameters
 */
export async function searchYouTubeVideos(
  params: YouTubeSearchParams,
): Promise<YouTubeSearchResult> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const { query, publishedAfter, duration = 'short', maxResults = 50 } = params;

  // Step 1: Search for videos
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

  // Step 2: Get detailed video information (statistics, contentDetails)
  const videoIds = items
    .map((item) => item.id?.videoId)
    .filter((id): id is string => !!id);

  const videosResponse = await youtube.videos.list({
    part: ['snippet', 'contentDetails', 'statistics'],
    id: videoIds,
  });

  const videoItems = videosResponse.data.items || [];

  // Step 3: Transform to our database schema
  const videos: NewYoutubeVideos[] = videoItems.map((item) => {
    const snippet = item.snippet!;
    const statistics = item.statistics;
    const contentDetails = item.contentDetails;

    return {
      url: `https://www.youtube.com/watch?v=${item.id}`,
      title: snippet.title || 'Untitled',
      description: snippet.description || null,
      published_at: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
      channel_title: snippet.channelTitle || null,
      duration_seconds: contentDetails?.duration
        ? parseISO8601Duration(contentDetails.duration)
        : null,
      view_count: statistics?.viewCount ? parseInt(statistics.viewCount, 10) : 0,
      like_count: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : 0,
      comment_count: statistics?.commentCount
        ? parseInt(statistics.commentCount, 10)
        : 0,
      tags: (snippet.tags as string[]) || [],
      youtube_id: item.id!,
    };
  });

  return {
    videos,
    totalResults: searchResponse.data.pageInfo?.totalResults || videos.length,
  };
}

/**
 * Get detailed information for a single video by ID
 */
export async function getYouTubeVideoById(
  videoId: string,
): Promise<NewYoutubeVideos | null> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const response = await youtube.videos.list({
    part: ['snippet', 'contentDetails', 'statistics'],
    id: [videoId],
  });

  const item = response.data.items?.[0];
  if (!item) return null;

  const snippet = item.snippet!;
  const statistics = item.statistics;
  const contentDetails = item.contentDetails;

  return {
    url: `https://www.youtube.com/watch?v=${item.id}`,
    title: snippet.title || 'Untitled',
    description: snippet.description || null,
    published_at: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
    channel_title: snippet.channelTitle || null,
    duration_seconds: contentDetails?.duration
      ? parseISO8601Duration(contentDetails.duration)
      : null,
    view_count: statistics?.viewCount ? parseInt(statistics.viewCount, 10) : 0,
    like_count: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : 0,
    comment_count: statistics?.commentCount
      ? parseInt(statistics.commentCount, 10)
      : 0,
    tags: (snippet.tags as string[]) || [],
    youtube_id: item.id!,
  };
}
