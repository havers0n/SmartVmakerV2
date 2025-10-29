CREATE SCHEMA IF NOT EXISTS "aes_core";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "analytics";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "generation_pipeline";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "jobs";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "studio";
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "aal_level" AS ENUM('aal1', 'aal2', 'aal3');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "action" AS ENUM('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ERROR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "app_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "buckettype" AS ENUM('STANDARD', 'ANALYTICS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "code_challenge_method" AS ENUM('s256', 'plain');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "contrast_enum" AS ENUM('small_vs_big', 'slow_vs_fast', 'alone_vs_together', 'sad_vs_happy', 'problem_vs_solution', 'before_vs_after');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "emotion_enum" AS ENUM('joy', 'sadness', 'surprise', 'anticipation', 'tension', 'relief', 'empathy', 'curiosity', 'humor', 'awe');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "equality_op" AS ENUM('eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "factor_status" AS ENUM('unverified', 'verified');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "factor_type" AS ENUM('totp', 'webauthn', 'phone');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "oauth_authorization_status" AS ENUM('pending', 'approved', 'denied', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "oauth_client_type" AS ENUM('public', 'confidential');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "oauth_registration_type" AS ENUM('dynamic', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "oauth_response_type" AS ENUM('code');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "one_time_token_type" AS ENUM('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "phase_enum" AS ENUM('HOOK', 'BUILD', 'PAYOFF', 'RESOLUTION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs"."analysis_job_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"analyzer" text NOT NULL,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analyzer" text NOT NULL,
	"analysis_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"aes_breakdown" jsonb,
	"overall_score" numeric(5, 2),
	"emotional_tags" jsonb,
	"analyzer_name" text,
	"version" integer DEFAULT 1 NOT NULL,
	"video_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_pipeline"."assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_project_id" uuid NOT NULL,
	"beat_id" uuid,
	"asset_type" text NOT NULL,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	"storage_url" text NOT NULL,
	"storage_bucket" text,
	"storage_path" text,
	"minimax_job_id" text,
	"content_hash" text,
	"api_cost_usd" numeric(10, 4) DEFAULT '0',
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"action" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"changed_fields" text[],
	"user_id" uuid,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_path" text,
	"total" integer DEFAULT 0 NOT NULL,
	"ok" integer DEFAULT 0 NOT NULL,
	"fail" integer DEFAULT 0 NOT NULL,
	"avg_time_ms" integer,
	"quality_score" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aes_core"."beats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"phase" "phase_enum" NOT NULL,
	"duration_seconds" numeric NOT NULL,
	"description" text NOT NULL,
	"action_prompt" text,
	"emotion" "emotion_enum" NOT NULL,
	"contrast" "contrast_enum",
	"intended_impact" text,
	"meta" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_task_id" text NOT NULL,
	"beat_id" text,
	"public_url" text,
	"duration_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"task_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clips_with_legacy" (
	"id" uuid,
	"task_id" uuid,
	"task_legacy_id" text,
	"beat_id" text,
	"public_url" text,
	"duration_s" integer,
	"created_at" timestamp with time zone,
	"task_text_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"user_id" text,
	"topic" text,
	"duration_category" text,
	"scenario" jsonb,
	"candidates" jsonb,
	"chosen_index" integer,
	"compose_job_id" text,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	"deleted_at" timestamp with time zone,
	"chosen_first_asset_legacy_id" text,
	"chosen_last_asset_legacy_id" text,
	"aes_score" numeric,
	"hook_strength" numeric,
	"emotional_curve" text[],
	"evaluator" text,
	"chosen_first_asset_id" uuid,
	"chosen_last_asset_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs"."generation_job_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_pipeline"."generation_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"template_id" uuid,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	"final_video_url" text,
	"api_cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"channel_id" text,
	"error_message" text,
	"minimax_cost" numeric,
	"upload_status" text,
	"youtube_video_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "id_uuid_mapping" (
	"table_name" text NOT NULL,
	"legacy_id" text NOT NULL,
	"uuid_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "id_uuid_mapping_pkey" PRIMARY KEY("table_name","legacy_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs"."ingest_job_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"published_after" timestamp with time zone,
	"duration" integer,
	"error" text,
	"error_message" text,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"max_results" integer DEFAULT 25,
	"region_code" text,
	"relevance_language" text,
	"safe_search" text DEFAULT 'moderate',
	"order_by" text DEFAULT 'date',
	"search_type" text DEFAULT 'video',
	"video_duration" text,
	"video_definition" text,
	"video_caption" text,
	"video_embeddable" boolean,
	"video_license" text,
	"event_type" text,
	"last_checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "json_schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_name" text NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"schema_def" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "json_schemas_schema_name_key" UNIQUE("schema_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_tasks" (
	"legacy_id" text NOT NULL,
	"kind" text NOT NULL,
	"prompt" text,
	"public_url" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"params" jsonb,
	"file_id" text,
	"error" text,
	"batch_id" uuid,
	"topic" text,
	"lang" text,
	"deleted_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	CONSTRAINT "tasks_legacy_id_uniq" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aes_core"."story_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" text[],
	"target_duration_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "v_generation_costs_by_user" (
	"owner_id" uuid,
	"total_shorts" bigint,
	"total_assets" bigint,
	"total_shorts_cost" numeric,
	"total_assets_cost" numeric,
	"total_cost" numeric,
	"first_short_at" timestamp with time zone,
	"last_short_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "youtube_videos" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"youtube_id" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thumbnails" jsonb,
	"live_broadcast_content" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_video_analysis_analyzer" ON "analysis_results" ("analyzer");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_hash_idx" ON "generation_pipeline"."assets" ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_table_name" ON "audit_log" ("table_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_record_id" ON "audit_log" ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_action" ON "audit_log" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_user_id" ON "audit_log" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_created_at" ON "audit_log" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_table_record" ON "audit_log" ("record_id","table_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_batches_deleted_at" ON "batches" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clips_task_id" ON "clips" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clips_task_legacy_id" ON "clips" ("legacy_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clips_task_id_fk" ON "clips" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clips_task" ON "clips" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_events_scenario_gin" ON "generation_events" ("scenario");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_events_candidates_gin" ON "generation_events" ("candidates");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_events_deleted_at" ON "generation_events" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_user" ON "generation_events" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_status" ON "generation_events" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_first_asset" ON "generation_events" ("chosen_first_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_last_asset" ON "generation_events" ("chosen_last_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_first_asset_legacy" ON "generation_events" ("chosen_first_asset_legacy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_last_asset_legacy" ON "generation_events" ("chosen_last_asset_legacy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_asset_ids" ON "generation_events" ("chosen_first_asset_id","chosen_last_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_first_asset_fk" ON "generation_events" ("chosen_first_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_generation_events_last_asset_fk" ON "generation_events" ("chosen_last_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_id_uuid_mapping_uuid" ON "id_uuid_mapping" ("table_name","uuid_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_json_schemas_name" ON "json_schemas" ("schema_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_params_gin" ON "legacy_tasks" ("params");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_deleted_at" ON "legacy_tasks" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_batch" ON "legacy_tasks" ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "youtube_videos_url_uidx" ON "youtube_videos" ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_youtube_videos_published_at" ON "youtube_videos" ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_youtube_videos_created_at" ON "youtube_videos" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "youtube_videos_youtube_id_partial_uidx" ON "youtube_videos" ("youtube_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "youtube_videos_published_at_idx" ON "youtube_videos" ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "youtube_videos_channel_title_idx" ON "youtube_videos" ("channel_title");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "youtube_videos_youtube_id_uidx" ON "youtube_videos" ("youtube_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs"."analysis_job_queue" ADD CONSTRAINT "analysis_job_queue_video_id_youtube_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "youtube_videos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_video_id_youtube_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "youtube_videos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_pipeline"."assets" ADD CONSTRAINT "assets_generation_project_id_generation_projects_id_fk" FOREIGN KEY ("generation_project_id") REFERENCES "generation_pipeline"."generation_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_pipeline"."assets" ADD CONSTRAINT "assets_beat_id_beats_id_fk" FOREIGN KEY ("beat_id") REFERENCES "aes_core"."beats"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aes_core"."beats" ADD CONSTRAINT "beats_template_id_story_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "aes_core"."story_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clips" ADD CONSTRAINT "clips_task_id_legacy_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "legacy_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_events" ADD CONSTRAINT "generation_events_chosen_first_asset_id_assets_id_fk" FOREIGN KEY ("chosen_first_asset_id") REFERENCES "generation_pipeline"."assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_events" ADD CONSTRAINT "generation_events_chosen_last_asset_id_assets_id_fk" FOREIGN KEY ("chosen_last_asset_id") REFERENCES "generation_pipeline"."assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs"."generation_job_queue" ADD CONSTRAINT "generation_job_queue_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "generation_pipeline"."assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_pipeline"."generation_projects" ADD CONSTRAINT "generation_projects_template_id_story_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "aes_core"."story_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "legacy_tasks" ADD CONSTRAINT "legacy_tasks_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
