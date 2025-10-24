CREATE TABLE IF NOT EXISTS "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"prompt" text,
	"aspect_ratio" text,
	"model" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_path" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"ok" integer DEFAULT 0 NOT NULL,
	"fail" integer DEFAULT 0 NOT NULL,
	"avg_time_ms" integer,
	"quality_score" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"beat_id" text,
	"public_url" text,
	"duration_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_pipeline.assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_id" uuid NOT NULL,
	"beat_id" text,
	"asset_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"storage_url" text,
	"api_cost_usd" real,
	"meta" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_pipeline.jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"provider" text DEFAULT 'minimax' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_pipeline.shorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"prompt" text,
	"params" jsonb,
	"file_id" text,
	"public_url" text,
	"error" text,
	"batch_id" text,
	"topic" text,
	"lang" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"analyzer" text NOT NULL,
	"analysis_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analysis_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"analyzer" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingest_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"published_after" timestamp with time zone,
	"duration" text DEFAULT 'short' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_prompt" ON "assets" ("prompt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_kind" ON "assets" ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_batches_status" ON "batches" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clips_task" ON "clips" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_short_id" ON "generation_pipeline.assets" ("short_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_status" ON "generation_pipeline.assets" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_created_at" ON "generation_pipeline.assets" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_asset_id" ON "generation_pipeline.jobs" ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "generation_pipeline.jobs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_created_at" ON "generation_pipeline.jobs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shorts_status" ON "generation_pipeline.shorts" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shorts_template_id" ON "generation_pipeline.shorts" ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shorts_created_at" ON "generation_pipeline.shorts" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_batch" ON "tasks" ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_video_analysis_video_id" ON "video_analysis" ("video_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_video_analysis_analyzer" ON "video_analysis" ("analyzer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_youtube_videos_published_at" ON "youtube_videos" ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_youtube_videos_created_at" ON "youtube_videos" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analysis_queue_video_id" ON "analysis_queue" ("video_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analysis_queue_status" ON "analysis_queue" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analysis_queue_analyzer" ON "analysis_queue" ("analyzer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analysis_queue_created_at" ON "analysis_queue" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingest_queue_status" ON "ingest_queue" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingest_queue_created_at" ON "ingest_queue" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clips" ADD CONSTRAINT "clips_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_pipeline.assets" ADD CONSTRAINT "generation_pipeline.assets_short_id_generation_pipeline.shorts_id_fk" FOREIGN KEY ("short_id") REFERENCES "generation_pipeline.shorts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_pipeline.jobs" ADD CONSTRAINT "generation_pipeline.jobs_asset_id_generation_pipeline.assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "generation_pipeline.assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
