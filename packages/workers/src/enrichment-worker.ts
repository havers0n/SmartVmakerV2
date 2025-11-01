import dotenv from 'dotenv';
import path from 'path';

// Загружаем переменные из корневого .env файла
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Убедимся, что NODE_ENV установлен (cross-env должен это сделать, но проверим)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { createLogger } from '@aec/logger';

const logger = createLogger({ name: 'enrichment-worker' });

logger.info({ nodeEnv: process.env.NODE_ENV }, 'Worker environment initialized');

if (process.env.DRIZZLE_DATABASE_URL) {
  logger.info('Using DRIZZLE_DATABASE_URL (Pooler)');

  // Remove sslmode parameter from the connection string to avoid conflict with Pool SSL options
  let databaseUrl = process.env.DRIZZLE_DATABASE_URL;
  if (databaseUrl && databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/\?sslmode=[^&]*&?/, '?').replace(/&sslmode=[^&]*$/, '').replace(/&sslmode=[^&]*/, '');
    databaseUrl = databaseUrl.replace(/\?$/, ''); // Remove trailing ? if no params left
  }

  // Also update DRIZZLE_DATABASE_URL itself to ensure client.ts picks it up without sslmode
  process.env.DRIZZLE_DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;

  logger.info('Cleaned database URL (sslmode removed)');
}

import { getDrizzleClient, schema } from '@scrimspec/db';
import { eq, isNull, or, desc } from 'drizzle-orm';

/**
 * YouTube API videos.list response interface
 */
interface YouTubeVideosResponse {
  items: Array<{
    id: string; // YouTube video ID
    statistics: {
      viewCount?: string;
      likeCount?: string;
      dislikeCount?: string;
      favoriteCount?: string;
      commentCount?: string;
    };
    contentDetails: {
      duration: string; // ISO 8601 format (e.g., "PT1M35S")
      dimension: string;
      definition: string;
      caption: string;
      licensedContent: boolean;
      projection: string;
    };
  }>;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}

/**
 * Парсит ISO 8601 duration строку (например, "PT1M35S", "PT1H2M10S") в секунды
 *
 * Формат: P[n]Y[n]M[n]DT[n]H[n]M[n]S
 * Где:
 * - P = period (обязательный префикс)
 * - Y = years
 * - M = months (до T)
 * - D = days
 * - T = time (разделитель между датой и временем)
 * - H = hours
 * - M = minutes (после T)
 * - S = seconds
 *
 * @param duration ISO 8601 duration string
 * @returns Duration in seconds
 */
function parseISODuration(duration: string): number {
  // Regex для парсинга ISO 8601 duration
  // Примеры: PT1M35S, PT1H2M10S, PT15S, PT2H30M
  const regex = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
  const matches = duration.match(regex);

  if (!matches) {
    logger.warn({ duration }, 'Invalid ISO 8601 duration format');
    return 0;
  }

  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  const seconds = parseInt(matches[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Обрабатывает одну пачку видео для обогащения метаданных
 */
async function processEnrichmentBatch() {
  const db = getDrizzleClient();

  try {
    // Step 1: Найти видео, которым нужно обогащение
    // Критерий: viewCount = null или viewCount = 0
    const videosToEnrich = await db
      .select({
        id: schema.youtubeVideos.id,
        youtubeId: schema.youtubeVideos.youtubeId,
        title: schema.youtubeVideos.title,
      })
      .from(schema.youtubeVideos)
      .where(
        or(
          isNull(schema.youtubeVideos.viewCount),
          eq(schema.youtubeVideos.viewCount, 0)
        )
      )
      .orderBy(desc(schema.youtubeVideos.createdAt))
      .limit(50); // YouTube API поддерживает до 50 ID в одном запросе

    if (videosToEnrich.length === 0) {
      logger.debug('No videos to enrich, waiting');
      return null;
    }

    logger.info({ videoCount: videosToEnrich.length }, 'Found videos to enrich');

    // Step 2: Собрать YouTube IDs для batch-запроса
    const videoIds = videosToEnrich
      .map(v => v.youtubeId)
      .filter((id): id is string => id !== null && id !== undefined);

    if (videoIds.length === 0) {
      logger.warn('No valid YouTube IDs found');
      return null;
    }

    logger.info({ idCount: videoIds.length }, 'Fetching data from YouTube API');

    // Step 3: Запрос к YouTube API videos.list
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY environment variable is not set');
    }

    const searchParams = new URLSearchParams({
      part: 'statistics,contentDetails',
      id: videoIds.join(','),
      key: apiKey,
    });

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?${searchParams.toString()}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `YouTube API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data: YouTubeVideosResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      logger.warn('YouTube API returned no items');
      return null;
    }

    logger.info({ itemCount: data.items.length }, 'Received data from YouTube API');

    // Step 4: Обновить записи в базе данных
    let successCount = 0;
    let errorCount = 0;

    for (const videoItem of data.items) {
      try {
        const youtubeId = videoItem.id;
        const statistics = videoItem.statistics;
        const contentDetails = videoItem.contentDetails;

        // Парсим длительность
        const durationSeconds = parseISODuration(contentDetails.duration);

        // Обновляем запись в БД
        await db
          .update(schema.youtubeVideos)
          .set({
            viewCount: parseInt(statistics.viewCount || '0', 10),
            likeCount: parseInt(statistics.likeCount || '0', 10),
            commentCount: parseInt(statistics.commentCount || '0', 10),
            durationSeconds: durationSeconds,
            updatedAt: new Date() as any,
          } as any)
          .where(eq(schema.youtubeVideos.youtubeId, youtubeId));

        successCount++;

        // Найти соответствующее видео для логирования
        const video = videosToEnrich.find(v => v.youtubeId === youtubeId);
        if (video) {
          logger.debug({
            title: video.title,
            views: statistics.viewCount || 0,
            durationSeconds
          }, 'Video enriched');
        }
      } catch (error) {
        errorCount++;
        logger.error({
          err: error,
          videoId: videoItem.id
        }, 'Failed to update video');
      }
    }

    logger.info({
      successCount,
      errorCount
    }, 'Batch completed');

    return successCount;

  } catch (error) {
    logger.error({ err: error }, 'Batch processing failed');
    return null;
  }
}

/**
 * Основной цикл воркера
 */
async function main() {
  logger.info('Starting worker');
  logger.info({
    youtubeApiKey: !!process.env.YOUTUBE_API_KEY,
    databaseUrl: !!process.env.DATABASE_URL
  }, 'Environment configuration');
  logger.info('Worker enriches videos with view count, like count, comment count, and duration (up to 50 videos per batch)');

  while (true) {
    try {
      const processedCount = await processEnrichmentBatch();

      if (processedCount === null || processedCount === 0) {
        // Нет видео для обогащения, ждем 30 секунд
        await new Promise(resolve => setTimeout(resolve, 30000));
      } else {
        // Успешно обработана пачка, небольшая пауза перед следующей
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logger.error({ err: error }, 'Unexpected error in main loop');
      // В случае критической ошибки, ждем перед повтором
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the worker
main().catch((error) => {
  logger.fatal({ err: error }, 'Fatal error');
  process.exit(1);
});
