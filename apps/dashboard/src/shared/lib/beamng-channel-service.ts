import { db } from './db';
import { youtubeChannels, youtubeVideos, importSessions } from './schema';
import { eq } from '@scrimspec/db';
import {
  resolveYouTubeChannelInput,
  getYouTubeChannel,
  getChannelUploadsPlaylist,
  getPlaylistVideoIds,
  getYouTubeVideosByIds,
} from './youtube';
import { createLogger } from '@aec/logger';

const logger = createLogger({ name: 'beamng-channel-service' });

export interface ImportBeamngChannelResult {
  channelId: string;
  channelTitle: string | null;
  videosImported: number;
  videosTotal: number;
  importSessionId: string;
}

export async function importBeamngChannel(
  input: string,
  maxVideos: number = 50,
): Promise<ImportBeamngChannelResult> {
  const [session] = await db.insert(importSessions).values({
    source: 'youtube_channel',
    status: 'pending',
    meta: { input, maxVideos },
  }).returning();

  try {
    logger.info({ input, maxVideos }, 'Starting channel import');

    const channelId = await resolveYouTubeChannelInput(input);
    logger.info({ channelId }, 'Channel resolved');

    const channelInfo = await getYouTubeChannel(channelId);
    logger.info({ channelId, title: channelInfo.title }, 'Channel metadata fetched');

    const [channel] = await db.insert(youtubeChannels).values({
      youtubeChannelId: channelInfo.youtubeChannelId,
      handle: channelInfo.handle,
      title: channelInfo.title,
      description: channelInfo.description,
      country: channelInfo.country,
      subscriberCount: channelInfo.subscriberCount,
      videoCount: channelInfo.videoCount,
      viewCount: channelInfo.viewCount,
      publishedAt: channelInfo.publishedAt,
      thumbnailUrl: channelInfo.thumbnailUrl,
    }).onConflictDoUpdate({
      target: youtubeChannels.youtubeChannelId,
      set: {
        handle: channelInfo.handle,
        title: channelInfo.title,
        description: channelInfo.description,
        country: channelInfo.country,
        subscriberCount: channelInfo.subscriberCount,
        videoCount: channelInfo.videoCount,
        viewCount: channelInfo.viewCount,
        publishedAt: channelInfo.publishedAt,
        thumbnailUrl: channelInfo.thumbnailUrl,
        updatedAt: new Date().toISOString(),
      },
    }).returning();

    const playlistId = await getChannelUploadsPlaylist(channelId);
    if (!playlistId) {
      throw new Error('No uploads playlist found for this channel');
    }

    const videoIds = await getPlaylistVideoIds(playlistId, maxVideos);
    logger.info({ videoCount: videoIds.length, playlistId }, 'Playlist video IDs fetched');

    if (videoIds.length === 0) {
      throw new Error('No videos found in channel uploads');
    }

    const videos = await getYouTubeVideosByIds(videoIds);
    logger.info({ videoCount: videos.length }, 'Video details fetched');

    let importedCount = 0;
    for (const video of videos) {
      await db.insert(youtubeVideos).values({
        ...video,
        channelId: channel.id,
      }).onConflictDoNothing();
      importedCount++;
    }

    await db.update(importSessions)
      .set({
        status: 'completed',
        finishedAt: new Date().toISOString(),
        totalChannels: 1,
        totalVideos: importedCount,
      })
      .where(eq(importSessions.id, session.id));

    logger.info({ importedCount, channelTitle: channelInfo.title }, 'Channel import completed');

    return {
      channelId: channel.id,
      channelTitle: channelInfo.title,
      videosImported: importedCount,
      videosTotal: videos.length,
      importSessionId: session.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Channel import failed');

    await db.update(importSessions)
      .set({
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage,
      })
      .where(eq(importSessions.id, session.id));

    throw error;
  }
}
