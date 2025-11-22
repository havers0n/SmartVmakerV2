import { getDrizzleClient } from './client';
import { sql } from 'drizzle-orm';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(__dirname, '../../../.env') });

async function seed() {
  const db = getDrizzleClient();
  console.log('--- Seeding database started ---');

  console.log('Clearing existing data...');
  await db.execute(sql`DELETE FROM aes_core.ai_models;`);
  await db.execute(sql`DELETE FROM aes_core.ai_providers;`);

  console.log('Inserting providers...');
  await db.execute(sql`
    INSERT INTO aes_core.ai_providers (id, name, api_base_url, authentication_type, api_key_env_var_name) VALUES
    ('google_gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com', 'api_key_header', 'GEMINI_API_KEY'),
    ('minimax', 'MiniMax', 'https://api.minimax.io', 'bearer_token', 'MINIMAX_API_KEY');
  `);

  console.log('Inserting AI models with defaults and adapters...');
  await db.execute(sql`
    INSERT INTO aes_core.ai_models
      (id, provider_id, name, type, capabilities, is_default, is_enabled, request_defaults, response_adapter)
    VALUES
      -- Gemini image
      (
        'gemini-2.5-flash-image',
        'google_gemini',
        'Gemini 2.5 Flash Image',
        'text-to-image',
        ARRAY['fast','photorealistic','16:9'],
        false, true,
        jsonb_build_object(
          'response_format','base64'
        ),
        jsonb_build_object(
          'okPath','base_resp.status',
          'errorPath','base_resp.msg',
          'dataPaths', jsonb_build_object(
            'image_base64','data.0.image_base64',
            'url','data.0.url'
          )
        )
      ),

      -- Gemini text
      (
        'gemini-2.5-flash',
        'google_gemini',
        'Gemini 2.5 Flash',
        'text-to-text',
        ARRAY['function_calling','long_context'],
        false, true,
        NULL,
        NULL
      ),

      -- MiniMax image
      (
        'image-01',
        'minimax',
        'Hailu Image v1 (T2I/I2I)',
        'text-to-image',
        ARRAY['high-quality','16:9','subject-reference'],
        true, true,
        jsonb_build_object(
          'response_format','base64',
          'prompt_optimizer', true
        ),
        jsonb_build_object(
          'okPath','base_resp.status',
          'errorPath','base_resp.msg',
          'dataPaths', jsonb_build_object(
            'image_base64','data.0.image_base64',
            'url','data.0.url'
          )
        )
      ),

      -- MiniMax video: First & Last
      (
        'MiniMax-Hailuo-02',
        'minimax',
        'Hailuo Video (First & Last)',
        'image-to-video',
        ARRAY['video','16:9'],
        true, true,
        jsonb_build_object(
          'prompt_optimizer', true
        ),
        jsonb_build_object(
          'okPath','base_resp.status',
          'errorPath','base_resp.msg',
          'dataPaths', jsonb_build_object(
            'url','data.0.url',
            'task_id','task_id'
          )
        )
      ),

      -- MiniMax video: Subject Reference
      (
        's2v-01',
        'minimax',
        'Hailuo Video (Subject Reference)',
        'image-to-video',
        ARRAY['video','subject-reference'],
        false, true,
        jsonb_build_object(
          'prompt_optimizer', true
        ),
        jsonb_build_object(
          'okPath','base_resp.status',
          'errorPath','base_resp.msg',
          'dataPaths', jsonb_build_object(
            'url','data.0.url',
            'task_id','task_id'
          )
        )
      ),

      -- MiniMax text
      (
        'MiniMax-M2',
        'minimax',
        'MiniMax M2 (Text & Tools)',
        'text-to-text',
        ARRAY['function_calling','long_context'],
        true, true,
        NULL,
        NULL
      );
  `);

  console.log('--- Seeding database finished successfully! ---');
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
