import dotenv from 'dotenv';
import path from 'path';

// Загружаем переменные из корневого .env файла
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

if (process.env.DRIZZLE_DATABASE_URL) {
  console.log('[Ingest Worker] Using DRIZZLE_DATABASE_URL (Pooler)...');
  
  // Remove sslmode parameter from the connection string to avoid conflict with Pool SSL options
  let databaseUrl = process.env.DRIZZLE_DATABASE_URL;
  if (databaseUrl && databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/\?sslmode=[^&]*&?/, '?').replace(/&sslmode=[^&]*$/, '');
    databaseUrl = databaseUrl.replace(/\?$/, ''); // Remove trailing ? if no params left
  }
  
  process.env.DATABASE_URL = databaseUrl;
}

import { getDrizzleClient, schema } from '@scrimspec/db';
import { sql } from 'drizzle-orm';

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

  // Step 1: Захват задачи с использованием SELECT FOR UPDATE SKIP LOCKED
  const jobs = await (db as any).execute(
    sql`
      SELECT * FROM jobs.ingest_job_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ` as any
  );

  if (!jobs.rows || jobs.rows.length === 0) {
    // Нет задач для обработки
    return null;
  }

  const job = jobs.rows[0] as any;

  try {
    // Step 2: Обновление статуса на 'processing'
    await db
      .update(schema.ingestJobQueue)
      .set({
        status: 'processing' as any,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.ingestJobQueue.id} = ${job.id}` as any);

    console.log(`[Ingest Worker] Processing job ${job.id}: query="${job.query}"`);

    // Step 3: Формирование и выполнение запроса к YouTube API
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

    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: YouTubeSearchResponse = await response.json();

    console.log(`[Ingest Worker] Found ${data.items?.length || 0} videos`);

    // Step 4: Сохранение результатов в youtube_videos
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

    // Step 5: Завершение задачи
    await db
      .update(schema.ingestJobQueue)
      .set({
        status: 'completed' as any,
        updatedAt: new Date() as any,
      } as any)
      .where(sql`${schema.ingestJobQueue.id} = ${job.id}` as any);

    console.log(`[Ingest Worker] Job ${job.id} completed successfully`);

    return job.id;

  } catch (error) {
    // Step 6: Обработка ошибок
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[Ingest Worker] Job ${job.id} failed:`, errorMessage);

    await db
      .update(schema.ingestJobQueue)
      .set({
        status: 'failed' as any,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.ingestJobQueue.id} = ${job.id}` as any);

    return null;
  }
}

async function main() {
  console.log('[Ingest Worker] Starting...');
  console.log('[Ingest Worker] YouTube API Key:', process.env.YOUTUBE_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('[Ingest Worker] Database URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');

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
      console.error('[Ingest Worker] Unexpected error in main loop:', error);
      // В случае критической ошибки, ждем перед повтором
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Ingest Worker] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Ingest Worker] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
main().catch((error) => {
  console.error('[Ingest Worker] Fatal error:', error);
  process.exit(1);
});
