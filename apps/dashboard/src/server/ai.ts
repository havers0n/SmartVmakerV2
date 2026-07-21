import { DefaultAiRouter } from '@scrimspec/hwar-core';
import { db } from '@/shared/lib/db';

/**
 * Singleton AI router configured with DB for animation persistence.
 */
export const defaultAiRouter = new DefaultAiRouter({
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
  minimaxApiKey: process.env.MINIMAX_API_KEY,
  minimaxGroupId: process.env.MINIMAX_GROUP_ID,
  db,
});

