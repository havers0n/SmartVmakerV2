import { db } from './client';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

async function seed() {
  console.log('--- Seeding database started ---');

  // Очищаем таблицы в правильном порядке (сначала модели, потом провайдеры)
  console.log('Clearing existing data...');
  await db.execute(sql`DELETE FROM aes_core.ai_models;`);
  await db.execute(sql`DELETE FROM aes_core.ai_providers;`);

  // --- Заполняем Провайдеров ---
  console.log('Inserting providers...');
  await db.execute(sql`
    INSERT INTO aes_core.ai_providers (id, name, api_base_url, authentication_type, api_key_env_var_name) VALUES
    ('google_gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com', 'api_key_header', 'GEMINI_API_KEY'),
    ('minimax_hailu', 'MiniMax Hailuo', 'https://api.minimax.io', 'bearer_token', 'MINIMAX_API_KEY');
  `);

  // --- Заполняем Модели Gemini ---
  console.log('Inserting Gemini models...');
  await db.execute(sql`
    INSERT INTO aes_core.ai_models (id, provider_id, name, type, capabilities, is_default, is_enabled) VALUES
    ('gemini-2.5-flash-image', 'google_gemini', 'Gemini 2.5 Flash Image', 'text-to-image', ARRAY['fast', 'photorealistic', '16:9'], false, true),
    ('gemini-2.0-flash-preview-image-generation', 'google_gemini', 'Gemini 2.0 Flash Image (Preview)', 'text-to-image', ARRAY['image_generation','in:text,image,video,audio','out:image,text','batch','caching','structured_outputs'], false, false),
    ('gemini-2.5-flash', 'google_gemini', 'Gemini 2.5 Flash', 'text-to-text', ARRAY['multimodal_in:text,image,video,audio','output:text','function_calling','code_execution','batch','caching','maps_grounding'], false, true);
    -- Можно добавить остальные модели Gemini по аналогии
  `);
  
  // --- Заполняем Модели Hailu/MiniMax ---
  console.log('Inserting Hailu/MiniMax models...');
  await db.execute(sql`
    INSERT INTO aes_core.ai_models (id, provider_id, name, type, capabilities, is_default, is_enabled) VALUES
    ('image-01', 'minimax_hailu', 'Hailu Image v1 (T2I/I2I)', 'text-to-image', ARRAY['high-quality', '16:9', 'subject-reference'], true, true),
    ('MiniMax-M2', 'minimax_hailu', 'MiniMax M2 (Text & Tools)', 'text-to-text', ARRAY['function_calling', 'long_context'], true, true),
    ('MiniMax-Hailuo-02', 'minimax_hailu', 'Hailuo Video (First & Last)', 'image-to-video', ARRAY['image_to_video', 'camera_commands', '1080p', '6s_duration'], true, true),
    ('s2v-01', 'minimax_hailu', 'Hailuo Video (Subject Reference)', 'image-to-video', ARRAY['image_to_video', 'subject-reference', 'fast'], false, true);
    -- Можно добавить остальные модели Hailu по аналогии
  `);

  console.log('--- Seeding database finished successfully! ---');
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});