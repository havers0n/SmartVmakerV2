import dotenv from 'dotenv';
import path from 'path';

// Загружаем переменные из корневого .env файла
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Убедимся, что NODE_ENV установлен (cross-env должен это сделать, но проверим)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

console.log('[Analysis Worker] NODE_ENV:', process.env.NODE_ENV);

if (process.env.DRIZZLE_DATABASE_URL) {
  console.log('[Analysis Worker] Using DRIZZLE_DATABASE_URL (Pooler)...');

  // Remove sslmode parameter from the connection string to avoid conflict with Pool SSL options
  let databaseUrl = process.env.DRIZZLE_DATABASE_URL;
  if (databaseUrl && databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/\?sslmode=[^&]*&?/, '?').replace(/&sslmode=[^&]*$/, '').replace(/&sslmode=[^&]*/, '');
    databaseUrl = databaseUrl.replace(/\?$/, ''); // Remove trailing ? if no params left
  }

  // Also update DRIZZLE_DATABASE_URL itself to ensure client.ts picks it up without sslmode
  process.env.DRIZZLE_DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;

  console.log('[Analysis Worker] Cleaned database URL (sslmode removed)');
}

import { getDrizzleClient, schema, sql } from '@scrimspec/db';
import { eq } from 'drizzle-orm';

/**
 * Gemini API response interface
 */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Expected structure of analysis result from Gemini
 */
interface AnalysisResult {
  hook_text: string;
  emotion_tags: string[];
  beats: Array<{
    time_s: number;
    desc: string;
    emotion: string;
  }>;
  payoff: string;
  moral: string;
}

/**
 * Asserts that the configured Gemini model exists and is accessible
 * This is a fail-fast check to prevent the worker from starting with invalid configuration
 */
async function assertModelExists(): Promise<void> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL;
  
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  
  if (!geminiModel) {
    throw new Error('GEMINI_MODEL environment variable is not set');
  }

  const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;
  
  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const modelsResponse = await response.json();
    const models = modelsResponse.models || [];
    
    const modelExists = models.some((model: any) => model.name && model.name.endsWith(`/${geminiModel}`));
    
    if (!modelExists) {
      throw new Error(`Configured GEMINI_MODEL '${geminiModel}' is not available in the list of accessible models`);
    }
    
    console.log(`[Analysis Worker] Verified Gemini model '${geminiModel}' is accessible`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Model validation failed: ${error.message}`);
    }
    throw new Error('Model validation failed due to unknown error');
  }
}

/**
 * Извлекает JSON из текста, даже если он обернут в Markdown блоки
 *
 * Примеры поддерживаемых форматов:
 * - Простой JSON: {"key": "value"}
 * - Markdown блок: ```json\n{"key": "value"}\n```
 * - Markdown блок без языка: ```\n{"key": "value"}\n```
 *
 * @param text Text that may contain JSON
 * @returns Extracted JSON string
 */
function extractJsonFromText(text: string): string {
  // Попробуем найти JSON в markdown блоке ```json ... ```
  const markdownJsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (markdownJsonMatch) {
    return markdownJsonMatch[1].trim();
  }

  // Попробуем найти JSON напрямую (ищем { ... })
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  // Если ничего не нашли, возвращаем исходный текст
  return text.trim();
}

/**
 * Обрабатывает одну задачу анализа
 */
async function processAnalysisJob() {
  const db = getDrizzleClient();

  // Step 1: Атомарный захват задачи с использованием транзакции и FOR UPDATE SKIP LOCKED
  const job = await db.transaction(async (tx) => {
    // Используем сырой SQL для FOR UPDATE SKIP LOCKED
    const result = await tx.execute(
      sql`
        SELECT * FROM jobs.analysis_job_queue
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
    await tx
      .update(schema.analysisJobQueue)
      .set({
        status: 'processing' as any,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.analysisJobQueue.id} = ${selectedJob.id}`);

    return selectedJob;
  });

  if (!job) {
    // Нет задач для обработки
    return null;
  }

  try {
    console.log(`[Analysis Worker] Processing job ${job.id} for video ${job.video_id}`);

    // Step 2: Двойная проверка - проверяем, не был ли уже проанализирован этот видео
    const existingAnalysis = await db
      .select()
      .from(schema.analysisResults)
      .where(eq(schema.analysisResults.videoId, job.video_id))
      .limit(1);

    if (existingAnalysis.length > 0) {
      console.log(`[Analysis Worker] Video ${job.video_id} already analyzed. Skipping.`);

      // Помечаем задачу как завершенную (дубликат)
      await db
        .update(schema.analysisJobQueue)
        .set({
          status: 'completed' as any,
          updatedAt: new Date() as any,
        })
        .where(sql`${schema.analysisJobQueue.id} = ${job.id}`);

      return job.id;
    }

    // Step 3: Подготовка данных - получаем URL видео
    const videoData = await db
      .select({
        url: schema.youtubeVideos.url,
        title: schema.youtubeVideos.title,
        youtubeId: schema.youtubeVideos.youtubeId,
      })
      .from(schema.youtubeVideos)
      .where(eq(schema.youtubeVideos.id, job.video_id))
      .limit(1);

    if (videoData.length === 0) {
      throw new Error(`Video not found: ${job.video_id}`);
    }

    const video = videoData[0];
    console.log(`[Analysis Worker] Analyzing video: "${video.title}"`);

    // Step 4: Формирование запроса к Gemini
    const prompt = `Analyze this YouTube Shorts video and output ONLY JSON with keys: hook_text, emotion_tags (5 strings), beats (array of {time_s:number, desc, emotion}), payoff, moral. JSON only, no extra text. Video: ${video.url}`;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL;
    
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    
    if (!geminiModel) {
      throw new Error('GEMINI_MODEL environment variable is not set');
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        // Adding responseSchema to enforce strict JSON structure
        responseSchema: {
          type: "OBJECT",
          properties: {
            hook_text: { type: "STRING" },
            emotion_tags: { type: "ARRAY", items: { type: "STRING" } },
            beats: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  time_s: { type: "NUMBER" },
                  desc: { type: "STRING" },
                  emotion: { type: "STRING" }
                },
                required: ["time_s", "desc", "emotion"]
              }
            },
            payoff: { type: "STRING" },
            moral: { type: "STRING" }
          },
          required: ["hook_text", "emotion_tags", "beats", "payoff", "moral"]
        }
      },
    };

    console.log(`[Analysis Worker] Sending request to Gemini API...`);

    // Step 5: Выполнение запроса к Gemini
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const geminiResponse: GeminiResponse = await response.json();

    // Проверяем на ошибки в ответе
    if (geminiResponse.error) {
      throw new Error(
        `Gemini API returned error: ${geminiResponse.error.message} (${geminiResponse.error.status})`
      );
    }

    // Извлекаем текст ответа
    const responseText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Gemini API returned empty response');
    }

    console.log(`[Analysis Worker] Received response from Gemini API`);

    // Step 6: Парсинг ответа - теперь Gemini должен возвращать чистый JSON
    let analysisResult: AnalysisResult;
    try {
      // Прямая попытка парсинга JSON (основной путь)
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      // Только если прямой парсинг не удался, используем страховочный extractJsonFromText
      console.warn('[Analysis Worker] Direct JSON parsing failed, trying fallback extraction method...');
      const jsonText = extractJsonFromText(responseText);
      try {
        analysisResult = JSON.parse(jsonText);
      } catch (fallbackError) {
        console.error('[Analysis Worker] Failed to parse JSON with fallback method:', jsonText);
        throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }

    // Валидация структуры ответа
    if (!analysisResult.hook_text || !Array.isArray(analysisResult.emotion_tags)) {
      throw new Error('Invalid analysis result structure: missing required fields');
    }

    console.log(`[Analysis Worker] Successfully parsed analysis result`);
    console.log(`[Analysis Worker] Hook: ${analysisResult.hook_text.substring(0, 50)}...`);
    console.log(`[Analysis Worker] Emotions: ${analysisResult.emotion_tags.join(', ')}`);
    console.log(`[Analysis Worker] Beats: ${analysisResult.beats?.length || 0}`);

    // Step 7: Сохранение результата в базу данных
    await db.insert(schema.analysisResults).values({
      videoId: job.video_id,
      analyzer: job.analyzer || 'gemini-pro',
      analysisUrl: video.url,
      aesBreakdown: analysisResult as any, // Сохраняем весь результат в JSONB поле
      emotionalTags: analysisResult.emotion_tags as any,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } as any);

    console.log(`[Analysis Worker] Saved analysis result to database`);

    // Step 8: Обновление статуса задачи на 'completed'
    await db
      .update(schema.analysisJobQueue)
      .set({
        status: 'completed' as any,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.analysisJobQueue.id} = ${job.id}`);

    console.log(`[Analysis Worker] Job ${job.id} completed successfully`);

    return job.id;

  } catch (error) {
    // Step 9: Обработка ошибок
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[Analysis Worker] Job ${job.id} failed:`, errorMessage);

    // Обновляем статус задачи на 'failed' с сообщением об ошибке
    await db
      .update(schema.analysisJobQueue)
      .set({
        status: 'failed' as any,
        error: errorMessage,
        errorMessage: errorMessage,
        updatedAt: new Date() as any,
      })
      .where(sql`${schema.analysisJobQueue.id} = ${job.id}`);

    return null;
  }
}

/**
 * Основной цикл воркера
 */
async function main() {
  console.log('[Analysis Worker] Starting...');
  console.log('[Analysis Worker] Gemini API Key:', process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('[Analysis Worker] Database URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');
  console.log('');
  console.log('[Analysis Worker] This worker analyzes videos using Gemini AI');
  console.log('  - Fetches analysis jobs from jobs.analysis_job_queue');
  console.log('  - Checks for duplicate analysis');
  console.log('  - Calls Gemini API for video analysis');
  console.log('  - Saves results to analysis_results table');
  console.log('');

  // Fail-fast model validation
  try {
    await assertModelExists();
  } catch (error) {
    console.error('[Analysis Worker] Failed to validate Gemini model configuration:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  while (true) {
    try {
      const jobId = await processAnalysisJob();

      if (!jobId) {
        // Нет задач, ждем 30 секунд
        console.log('[Analysis Worker] No pending jobs. Waiting 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      } else {
        // Задача обработана, небольшая пауза перед следующей
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('[Analysis Worker] Unexpected error in main loop:', error);
      // В случае критической ошибки, ждем перед повтором
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Analysis Worker] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Analysis Worker] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
main().catch((error) => {
  console.error('[Analysis Worker] Fatal error:', error);
  process.exit(1);
});