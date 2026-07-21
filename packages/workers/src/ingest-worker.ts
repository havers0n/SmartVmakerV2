import dotenv from 'dotenv';
import path from 'path';

// Загружаем переменные из корневого .env файла
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// === ANTI-CRASH SHIELD ===
process.on('uncaughtException', (err) => {
  const msg = String(err);
  if (msg.includes('ECONNRESET') || msg.includes('Connection terminated') || msg.includes('57P01')) {
    console.warn('[System] DB Connection glitch intercepted. Staying alive.');
    return;
  }
  console.error('[System] CRITICAL UNCAUGHT ERROR:', err);
  process.exit(1);
});

// Убедимся, что NODE_ENV установлен (cross-env должен это сделать, но проверим)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

import { createLogger } from '@aec/logger';
import { retryFetch } from './utils/retry';

const logger = createLogger({ name: 'ingest-worker' });

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

import { getDrizzleClient, schema, sql } from '@scrimspec/db';

interface YouTubeSearchResponse {
  items: Array<{
    id: {
      videoId: string;
    };
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      channelTitle: string;
      thumbnails: {
        default?: { url: string; width: number; height: number };
        medium?: { url: string; width: number; height: number };
        high?: { url: string; width: number; height: number };
      };
      liveBroadcastContent: string;
    };
  }>;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}

async function processIngestJob() {
  const db = getDrizzleClient();

  // Step 1: Атомарный захват задачи с использованием транзакции и FOR UPDATE SKIP LOCKED
  // Это гарантирует, что только один воркер возьмет конкретную задачу
  const job = await db.transaction(async (tx) => {
    // Используем сырой SQL для FOR UPDATE SKIP LOCKED, так как Drizzle пока не имеет
    // нативного API для этой конструкции
    const result = await tx.execute(
      sql`
        SELECT * FROM jobs.ingest_job_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const selectedJob = result.rows[0] as any;

    // Немедленно обновляем статус на 'processing' внутри той же транзакции
    // Это критически важно для предотвращения race condition
    await tx
      .update(schema.ingestJobQueue)
      .set({
        status: 'processing' as any,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.ingestJobQueue.id} = ${selectedJob.id}`);

    return selectedJob;
  });

  if (!job) {
    // Нет задач для обработки
    return null;
  }

  try {
    logger.info({ jobId: job.id, query: job.query }, 'Processing job');

    // Step 2: Формирование и выполнение запроса к YouTube API
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY environment variable is not set');
    }

    const searchParams = new URLSearchParams({
      part: 'snippet',
      q: job.query,
      type: job.search_type || 'video',
      maxResults: String(job.max_results || 25),
      key: apiKey,
    });

    // Добавляем опциональные параметры
    if (job.published_after) {
      // Форматируем дату в ISO формат с Z-суффиксом для YouTube API
      const formattedDate = new Date(job.published_after).toISOString();
      searchParams.append('publishedAfter', formattedDate);
    }
    if (job.region_code) {
      searchParams.append('regionCode', job.region_code);
    }
    if (job.relevance_language) {
      searchParams.append('relevanceLanguage', job.relevance_language);
    }
    if (job.safe_search) {
      searchParams.append('safeSearch', job.safe_search);
    }
    if (job.order_by) {
      searchParams.append('order', job.order_by);
    }
    if (job.video_duration) {
      searchParams.append('videoDuration', job.video_duration);
    }
    if (job.video_definition) {
      searchParams.append('videoDefinition', job.video_definition);
    }
    if (job.video_caption) {
      searchParams.append('videoCaption', job.video_caption);
    }
    if (job.video_embeddable !== null && job.video_embeddable !== undefined) {
      searchParams.append('videoEmbeddable', String(job.video_embeddable));
    }
    if (job.video_license) {
      searchParams.append('videoLicense', job.video_license);
    }
    if (job.event_type) {
      searchParams.append('eventType', job.event_type);
    }

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;

    // Wrap YouTube API call with retry logic
    const data: YouTubeSearchResponse = await retryFetch(
      async () => {
        const response = await fetch(searchUrl);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
      },
      logger,
      { retries: 3 }
    );

    logger.info({ videoCount: data.items?.length || 0 }, 'Found videos from YouTube API');

    // Step 3: Сохранение результатов в youtube_videos
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const videoId = item.id.videoId;
        const snippet = item.snippet;

        await db
          .insert(schema.youtubeVideos)
          .values({
            youtubeId: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: snippet.title,
            description: snippet.description || null,
            publishedAt: snippet.publishedAt,
            channelTitle: snippet.channelTitle || null,
            thumbnails: snippet.thumbnails || null,
            liveBroadcastContent: snippet.liveBroadcastContent || null,
            createdAt: new Date() as any,
            updatedAt: new Date() as any,
          } as any)
          .onConflictDoUpdate({
            target: schema.youtubeVideos.youtubeId as any,
            set: {
              title: snippet.title,
              description: snippet.description || null,
              channelTitle: snippet.channelTitle || null,
              thumbnails: snippet.thumbnails || null,
              liveBroadcastContent: snippet.liveBroadcastContent || null,
              updatedAt: new Date() as any,
            } as any,
          });
      }
    }

    // Step 4: Завершение задачи
    await db
      .update(schema.ingestJobQueue)
      .set({
        status: 'completed' as any,
        updatedAt: new Date() as any,
      } as any)
      .where(sql`${schema.ingestJobQueue.id} = ${job.id}`);

    logger.info({ jobId: job.id }, 'Job completed successfully');

    return job.id;

  } catch (error) {
    // Step 5: Обработка ошибок
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({ err: error, jobId: job.id }, 'Job failed');

    await db
      .update(schema.ingestJobQueue)
      .set({
        status: 'failed' as any,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.ingestJobQueue.id} = ${job.id}`);

    return null;
  }
}



async function main() {
  logger.info('Starting worker');
  logger.info({
    youtubeApiKey: !!process.env.YOUTUBE_API_KEY,
    databaseUrl: !!process.env.DATABASE_URL
  }, 'Environment configuration');

  while (true) {
    try {
      const jobId = await processIngestJob();

      if (!jobId) {
        // Нет задач, ждем 10 секунд
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        // Задача обработана, можем сразу проверить следующую
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error({ err: error }, 'Unexpected error in main loop');
      // В случае критической ошибки, ждем перед повтором
      await new Promise(resolve => setTimeout(resolve, 5000));
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
