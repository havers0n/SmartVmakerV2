-- Discovery-only semantic clustering metadata and reusable title embeddings.
CREATE TABLE IF NOT EXISTS "discovery_video_embeddings" (
  "video_id" uuid PRIMARY KEY REFERENCES "youtube_videos"("id") ON DELETE CASCADE,
  "content_hash" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "embedding" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "discovery_clusters"
  ADD COLUMN IF NOT EXISTS "content_format" text NOT NULL DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS "audience" text NOT NULL DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS "suggested_queries" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "why_researchable" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "semantic_cohesion" numeric(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "repeated_format_evidence" numeric(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_outlier" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "raw_token_label" text;

ALTER TABLE "discovery_video_embeddings" ENABLE ROW LEVEL SECURITY;
