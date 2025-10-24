-- ============================================================================
-- SCRIMSPEC DATABASE SETUP
-- Выполни этот файл в Supabase SQL Editor для создания всех таблиц
-- ============================================================================

-- ============================================================================
-- 1. YOUTUBE VIDEOS TABLE (основная для Analysis page)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "youtube_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone,
	"channel_title" text,
	"duration_seconds" integer,
	"view_count" bigint DEFAULT 0,
	"like_count" bigint DEFAULT 0,
	"comment_count" bigint DEFAULT 0,
	"tags" jsonb DEFAULT '[]',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_youtube_videos_published_at"
  ON "youtube_videos" ("published_at");
CREATE INDEX IF NOT EXISTS "idx_youtube_videos_created_at"
  ON "youtube_videos" ("created_at");

-- ============================================================================
-- 2. ANALYSIS QUEUE TABLE (задания на анализ видео)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "analysis_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"analyzer" text NOT NULL,
	"status" text NOT NULL DEFAULT 'pending',
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_analysis_queue_video_id"
  ON "analysis_queue" ("video_id");
CREATE INDEX IF NOT EXISTS "idx_analysis_queue_status"
  ON "analysis_queue" ("status");
CREATE INDEX IF NOT EXISTS "idx_analysis_queue_analyzer"
  ON "analysis_queue" ("analyzer");
CREATE INDEX IF NOT EXISTS "idx_analysis_queue_created_at"
  ON "analysis_queue" ("created_at");

-- ============================================================================
-- 3. VIDEO ANALYSIS TABLE (результаты анализа)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "video_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"analyzer" text NOT NULL,
	"analysis_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_video_analysis_video_id"
  ON "video_analysis" ("video_id");
CREATE INDEX IF NOT EXISTS "idx_video_analysis_analyzer"
  ON "video_analysis" ("analyzer");

-- ============================================================================
-- 4. INGEST QUEUE TABLE (задания на поиск видео)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "ingest_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"published_after" timestamp with time zone,
	"duration" text NOT NULL DEFAULT 'short',
	"status" text NOT NULL DEFAULT 'pending',
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ingest_queue_status"
  ON "ingest_queue" ("status");
CREATE INDEX IF NOT EXISTS "idx_ingest_queue_created_at"
  ON "ingest_queue" ("created_at");

-- ============================================================================
-- ТЕСТОВЫЕ ДАННЫЕ (опционально, если нужны примеры видео)
-- Раскомментируй это если хочешь добавить тестовые видео
-- ============================================================================

/*
INSERT INTO "youtube_videos"
  ("id", "url", "title", "channel_title", "duration_seconds", "view_count", "published_at")
VALUES
  ('cute_kittens_001',
   'https://www.youtube.com/watch?v=cute_kittens_001',
   'Cute Kittens Playing with Toys',
   'Pet Channel',
   180,
   50000,
   '2024-01-15T10:00:00Z'),
  ('dog_rescue_002',
   'https://www.youtube.com/watch?v=dog_rescue_002',
   'Amazing Dog Rescue Story from the Streets',
   'Animal Rescue',
   240,
   100000,
   '2024-02-20T14:30:00Z'),
  ('puppy_training_003',
   'https://www.youtube.com/watch?v=puppy_training_003',
   'How to Train Your Puppy - Complete Guide',
   'Dog Training Pro',
   420,
   75000,
   '2024-01-10T08:15:00Z'),
  ('cat_funny_004',
   'https://www.youtube.com/watch?v=cat_funny_004',
   'Funniest Cat Videos Compilation 2024',
   'Laugh With Pets',
   300,
   200000,
   '2024-02-01T16:45:00Z'),
  ('bunny_care_005',
   'https://www.youtube.com/watch?v=bunny_care_005',
   'Pet Rabbit Care - Everything You Need to Know',
   'Small Pets Guide',
   360,
   35000,
   '2024-01-25T12:00:00Z');
*/

-- ============================================================================
-- Для других таблиц (generation_pipeline, etc.), используй оригинальный migration:
-- packages/db/migrations/0000_medical_nicolaos.sql
-- ============================================================================
