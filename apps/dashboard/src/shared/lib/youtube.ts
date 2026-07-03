/**
 * YouTube Data API v3 integration
 * Handles video search and metadata fetching
 */

import { google } from 'googleapis';
import { schema } from '@scrimspec/db';
import type { InferInsertModel } from 'drizzle-orm';

// Define the type for NewYoutubeVideos using the schema
type NewYoutubeVideos = InferInsertModel<typeof schema.youtubeVideos>;

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
      publishedAt: snippet.publishedAt || null,
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
      youtubeId: item.id!,
    };
  });

  return {
    videos,
    totalResults: searchResponse.data.pageInfo?.totalResults || videos.length,
  };
}

/**
 * Resolve various YouTube channel input formats to a channelId
 * Supports: channel URL, @handle, plain handle, direct channelId
 */
export async function resolveYouTubeChannelInput(input: string): Promise<string> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const trimmed = input.trim();

  // Case 1: Already a channel ID (starts with UC, 24 chars)
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return trimmed;
  }

  // Case 2: YouTube channel URL formats
  // https://www.youtube.com/channel/UCxxxxx
  const channelUrlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([\w-]+)/,
  );
  if (channelUrlMatch) {
    return channelUrlMatch[1];
  }

  // Case 3: YouTube handle URL or @handle
  // https://www.youtube.com/@handle or @handle or handle
  let handle = trimmed;
  const handleUrlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@?([\w@.-]+)/,
  );
  if (handleUrlMatch) {
    handle = handleUrlMatch[1];
  }
  if (!handle.startsWith('@')) {
    handle = '@' + handle;
  }

  // Search for channel by handle using search.list with type: channel
  const searchResponse = await youtube.search.list({
    part: ['snippet'],
    q: handle,
    type: ['channel'],
    maxResults: 1,
  });

  const channelId = searchResponse.data.items?.[0]?.snippet?.channelId;
  if (!channelId) {
    throw new Error(`Could not resolve YouTube channel from: "${input}". Check the URL, handle, or channel ID and try again.`);
  }

  return channelId;
}

export interface YouTubeChannelInfo {
  youtubeChannelId: string;
  handle: string | null;
  title: string | null;
  description: string | null;
  country: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  publishedAt: string | null;
  thumbnailUrl: string | null;
}

/**
 * Get channel metadata from YouTube by channelId
 */
export async function getYouTubeChannel(channelId: string): Promise<YouTubeChannelInfo> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const response = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    id: [channelId],
  });

  const item = response.data.items?.[0];
  if (!item) {
    throw new Error(`YouTube channel not found: ${channelId}`);
  }

  const snippet = item.snippet!;
  const statistics = item.statistics;

  const customUrl = snippet.customUrl || null;
  const handle = customUrl?.startsWith('@') ? customUrl : customUrl ? `@${customUrl}` : null;

  return {
    youtubeChannelId: channelId,
    handle,
    title: snippet.title || null,
    description: snippet.description || null,
    country: snippet.country || null,
    subscriberCount: parseInt(statistics?.subscriberCount || '0', 10),
    videoCount: parseInt(statistics?.videoCount || '0', 10),
    viewCount: parseInt(statistics?.viewCount || '0', 10),
    publishedAt: snippet.publishedAt || null,
    thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
  };
}

/**
 * Get the uploads playlist ID for a channel
 */
export async function getChannelUploadsPlaylist(channelId: string): Promise<string | null> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const response = await youtube.channels.list({
    part: ['contentDetails'],
    id: [channelId],
  });

  const uploads = response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  return uploads || null;
}

/**
 * Get video IDs from a playlist, limited by maxVideos
 */
export async function getPlaylistVideoIds(
  playlistId: string,
  maxVideos: number = 50,
): Promise<string[]> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const videoIds: string[] = [];
  let nextPageToken: string | undefined;

  while (videoIds.length < maxVideos) {
    const response = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId,
      maxResults: Math.min(50, maxVideos - videoIds.length),
      pageToken: nextPageToken,
    });

    const items = response.data.items || [];
    for (const item of items) {
      const videoId = item.contentDetails?.videoId;
      if (videoId) {
        videoIds.push(videoId);
      }
    }

    nextPageToken = response.data.nextPageToken || undefined;
    if (!nextPageToken) break;
  }

  return videoIds;
}

/**
 * Get detailed video information for multiple video IDs
 * YouTube API allows max 50 ids per request, batches automatically
 */
export async function getYouTubeVideosByIds(videoIds: string[]): Promise<NewYoutubeVideos[]> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  if (videoIds.length === 0) return [];

  const results: NewYoutubeVideos[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const response = await youtube.videos.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      id: batch,
    });

    const items = response.data.items || [];
    for (const item of items) {
      const snippet = item.snippet!;
      const statistics = item.statistics;
      const contentDetails = item.contentDetails;

      results.push({
        url: `https://www.youtube.com/watch?v=${item.id}`,
        title: snippet.title || 'Untitled',
        description: snippet.description || null,
        publishedAt: snippet.publishedAt || null,
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
        youtubeId: item.id!,
        thumbnails: snippet.thumbnails as Record<string, { url: string }> | null || null,
      });
    }
  }

  return results;
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
    publishedAt: snippet.publishedAt || null,
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
    youtubeId: item.id!,
  };
}