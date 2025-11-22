-- Seed AI Providers and Models
-- This migration inserts initial data for AI providers and their models

-- ============================================
-- AI PROVIDERS
-- ============================================

INSERT INTO aes_core.ai_providers (id, name, api_base_url, authentication_type, api_key_env_var_name, metadata, created_at, updated_at)
VALUES
  (
    'google_gemini',
    'Google Gemini',
    'https://generativelanguage.googleapis.com/v1beta',
    'query_param',
    'GEMINI_API_KEY',
    '{"docs_url": "https://ai.google.dev/gemini-api/docs", "rate_limits": {"default": "60 requests per minute"}}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'minimax',
    'MiniMax',
    'https://api.minimax.io/v1',
    'bearer_token',
    'MINIMAX_API_KEY',
    '{"docs_url": "https://www.minimaxi.com/document/guides", "region": "cn", "supports_streaming": true}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- AI MODELS - Google Gemini
-- ============================================

INSERT INTO aes_core.ai_models (id, provider_id, name, type, cost_details, capabilities, is_default, is_enabled, metadata, created_at, updated_at)
VALUES
  (
    'gemini-2.0-flash-exp',
    'google_gemini',
    'Gemini 2.0 Flash (Experimental)',
    'text-to-text',
    '{"input_price_per_1m_tokens": 0, "output_price_per_1m_tokens": 0, "note": "Free during experimental phase"}'::jsonb,
    ARRAY['function_calling', 'streaming', 'multimodal', 'vision'],
    false,
    true,
    '{"context_window": 1000000, "max_output_tokens": 8192, "supports_json_mode": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'gemini-1.5-pro',
    'google_gemini',
    'Gemini 1.5 Pro',
    'text-to-text',
    '{"input_price_per_1m_tokens": 1.25, "output_price_per_1m_tokens": 5.0, "input_price_per_1m_tokens_over_128k": 2.5, "output_price_per_1m_tokens_over_128k": 10.0}'::jsonb,
    ARRAY['function_calling', 'streaming', 'multimodal', 'vision', 'long_context'],
    false,
    true,
    '{"context_window": 2000000, "max_output_tokens": 8192, "supports_json_mode": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'gemini-1.5-flash',
    'google_gemini',
    'Gemini 1.5 Flash',
    'text-to-text',
    '{"input_price_per_1m_tokens": 0.075, "output_price_per_1m_tokens": 0.3, "input_price_per_1m_tokens_over_128k": 0.15, "output_price_per_1m_tokens_over_128k": 0.6}'::jsonb,
    ARRAY['function_calling', 'streaming', 'multimodal', 'vision'],
    false,
    true,
    '{"context_window": 1000000, "max_output_tokens": 8192, "supports_json_mode": true}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'gemini-2.5-flash-image',
    'google_gemini',
    'Gemini 2.5 Flash Image',
    'text-to-image',
    '{"price_per_image": 0.04}'::jsonb,
    ARRAY['text_to_image', 'aspect_ratio_control'],
    true,
    true,
    '{"supported_aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4"], "max_images_per_request": 4, "default_image_format": "jpeg"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- AI MODELS - MiniMax
-- ============================================

INSERT INTO aes_core.ai_models (id, provider_id, name, type, cost_details, capabilities, is_default, is_enabled, metadata, created_at, updated_at)
VALUES
  (
    'minimax-m2',
    'minimax',
    'MiniMax-M2',
    'text-to-text',
    '{"input_price_per_1k_tokens": 0.001, "output_price_per_1k_tokens": 0.003, "note": "Prices in CNY, approximate USD conversion"}'::jsonb,
    ARRAY['function_calling', 'streaming', 'multimodal'],
    false,
    true,
    '{"context_window": 245000, "max_output_tokens": 16000, "supports_json_mode": true, "model_id": "MiniMax-M2"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'minimax-halu-video',
    'minimax',
    'MiniMax HALU (Video)',
    'image-to-video',
    '{"price_per_second": 0.08, "base_price": 0.4, "note": "5 seconds minimum"}'::jsonb,
    ARRAY['image_to_video', 'keyframe_animation'],
    true,
    true,
    '{"duration_range": [5, 6], "default_duration": 6, "prompt_enhancement": true, "webhook_support": true}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES (commented out)
-- ============================================

-- SELECT * FROM aes_core.ai_providers;
-- SELECT * FROM aes_core.ai_models ORDER BY provider_id, type;
--
-- -- Check which models are default
-- SELECT
--   p.name as provider,
--   m.name as model,
--   m.type,
--   m.is_default,
--   m.is_enabled
-- FROM aes_core.ai_models m
-- JOIN aes_core.ai_providers p ON m.provider_id = p.id
-- ORDER BY p.name, m.type;
