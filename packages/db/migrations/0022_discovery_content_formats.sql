-- Discovery-only repeatable content-format evidence. No transcript or media analysis is stored.
ALTER TABLE "discovery_clusters"
  ADD COLUMN IF NOT EXISTS "format_name" text NOT NULL DEFAULT 'Repeatable Video Format',
  ADD COLUMN IF NOT EXISTS "confidence_score" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "format_summary" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "common_hooks" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "common_title_patterns" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "common_emotions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "typical_duration_range" text NOT NULL DEFAULT 'Unavailable',
  ADD COLUMN IF NOT EXISTS "likely_visual_style" text NOT NULL DEFAULT 'Unavailable',
  ADD COLUMN IF NOT EXISTS "repeatability_score" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "example_videos" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "example_channels" jsonb NOT NULL DEFAULT '[]'::jsonb;
