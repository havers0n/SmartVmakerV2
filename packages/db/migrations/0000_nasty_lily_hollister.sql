CREATE SCHEMA "aes_core";
--> statement-breakpoint
CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE SCHEMA "generation_pipeline";
--> statement-breakpoint
CREATE SCHEMA "jobs";
--> statement-breakpoint
CREATE SCHEMA "studio";
--> statement-breakpoint
CREATE TYPE "public"."aal_level" AS ENUM('aal1', 'aal2', 'aal3');--> statement-breakpoint
CREATE TYPE "public"."action" AS ENUM('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."app_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."buckettype" AS ENUM('STANDARD', 'ANALYTICS');--> statement-breakpoint
CREATE TYPE "public"."code_challenge_method" AS ENUM('s256', 'plain');--> statement-breakpoint
CREATE TYPE "public"."contrast_enum" AS ENUM('small_vs_big', 'slow_vs_fast', 'alone_vs_together', 'sad_vs_happy', 'problem_vs_solution', 'before_vs_after');--> statement-breakpoint
CREATE TYPE "public"."emotion_enum" AS ENUM('joy', 'sadness', 'surprise', 'anticipation', 'tension', 'relief', 'empathy', 'curiosity', 'humor', 'awe');--> statement-breakpoint
CREATE TYPE "public"."equality_op" AS ENUM('eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in');--> statement-breakpoint
CREATE TYPE "public"."factor_status" AS ENUM('unverified', 'verified');--> statement-breakpoint
CREATE TYPE "public"."factor_type" AS ENUM('totp', 'webauthn', 'phone');--> statement-breakpoint
CREATE TYPE "public"."oauth_authorization_status" AS ENUM('pending', 'approved', 'denied', 'expired');--> statement-breakpoint
CREATE TYPE "public"."oauth_client_type" AS ENUM('public', 'confidential');--> statement-breakpoint
CREATE TYPE "public"."oauth_registration_type" AS ENUM('dynamic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."oauth_response_type" AS ENUM('code');--> statement-breakpoint
CREATE TYPE "public"."one_time_token_type" AS ENUM('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token');--> statement-breakpoint
CREATE TYPE "public"."phase_enum" AS ENUM('HOOK', 'BUILD', 'PAYOFF', 'RESOLUTION');--> statement-breakpoint
CREATE TABLE "jobs"."analysis_job_queue" (
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
CREATE TABLE "analysis_results" (
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
CREATE TABLE "generation_pipeline"."assets" (
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
CREATE TABLE "audit_log" (
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
CREATE TABLE "batches" (
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
CREATE TABLE "aes_core"."beats" (
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
CREATE TABLE "aes_core"."characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"style_presets" jsonb DEFAULT '{}'::jsonb,
	"reference_image_urls" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_task_id" text NOT NULL,
	"beat_id" text,
	"public_url" text,
	"duration_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"task_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips_with_legacy" (
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
CREATE TABLE "generation_events" (
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
CREATE TABLE "jobs"."generation_job_queue" (
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
CREATE TABLE "generation_pipeline"."generation_projects" (
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
CREATE TABLE "id_uuid_mapping" (
	"table_name" text NOT NULL,
	"legacy_id" text NOT NULL,
	"uuid_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "id_uuid_mapping_pkey" PRIMARY KEY("table_name","legacy_id")
);
--> statement-breakpoint
CREATE TABLE "jobs"."ingest_job_queue" (
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
CREATE TABLE "json_schemas" (
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
CREATE TABLE "legacy_tasks" (
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
CREATE TABLE "aes_core"."story_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" text[],
	"target_duration_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "v_generation_costs_by_user" (
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
CREATE TABLE "youtube_videos" (
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
	"thumbnails" jsonb,
	"live_broadcast_content" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs"."analysis_job_queue" ADD CONSTRAINT "analysis_job_queue_video_id_youtube_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."youtube_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_video_id_youtube_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."youtube_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_pipeline"."assets" ADD CONSTRAINT "assets_generation_project_id_generation_projects_id_fk" FOREIGN KEY ("generation_project_id") REFERENCES "generation_pipeline"."generation_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_pipeline"."assets" ADD CONSTRAINT "assets_beat_id_beats_id_fk" FOREIGN KEY ("beat_id") REFERENCES "aes_core"."beats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aes_core"."beats" ADD CONSTRAINT "beats_template_id_story_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "aes_core"."story_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_task_id_legacy_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."legacy_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_events" ADD CONSTRAINT "generation_events_chosen_first_asset_id_assets_id_fk" FOREIGN KEY ("chosen_first_asset_id") REFERENCES "generation_pipeline"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_events" ADD CONSTRAINT "generation_events_chosen_last_asset_id_assets_id_fk" FOREIGN KEY ("chosen_last_asset_id") REFERENCES "generation_pipeline"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs"."generation_job_queue" ADD CONSTRAINT "generation_job_queue_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "generation_pipeline"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_pipeline"."generation_projects" ADD CONSTRAINT "generation_projects_template_id_story_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "aes_core"."story_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_tasks" ADD CONSTRAINT "legacy_tasks_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_video_analysis_analyzer" ON "analysis_results" USING btree ("analyzer");--> statement-breakpoint
CREATE UNIQUE INDEX "content_hash_idx" ON "generation_pipeline"."assets" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_audit_log_table_name" ON "audit_log" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_audit_log_record_id" ON "audit_log" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_user_id" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_table_record" ON "audit_log" USING btree ("record_id","table_name");--> statement-breakpoint
CREATE INDEX "idx_batches_deleted_at" ON "batches" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_clips_task_id" ON "clips" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_clips_task_legacy_id" ON "clips" USING btree ("legacy_task_id");--> statement-breakpoint
CREATE INDEX "idx_clips_task_id_fk" ON "clips" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_clips_task" ON "clips" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_gen_events_scenario_gin" ON "generation_events" USING btree ("scenario");--> statement-breakpoint
CREATE INDEX "idx_gen_events_candidates_gin" ON "generation_events" USING btree ("candidates");--> statement-breakpoint
CREATE INDEX "idx_gen_events_deleted_at" ON "generation_events" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_generation_events_user" ON "generation_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_generation_events_status" ON "generation_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_generation_events_first_asset" ON "generation_events" USING btree ("chosen_first_asset_id");--> statement-breakpoint
CREATE INDEX "idx_generation_events_last_asset" ON "generation_events" USING btree ("chosen_last_asset_id");--> statement-breakpoint
CREATE INDEX "idx_generation_events_first_asset_legacy" ON "generation_events" USING btree ("chosen_first_asset_legacy_id");--> statement-breakpoint
CREATE INDEX "idx_generation_events_last_asset_legacy" ON "generation_events" USING btree ("chosen_last_asset_legacy_id");--> statement-breakpoint
CREATE INDEX "idx_generation_events_asset_ids" ON "generation_events" USING btree ("chosen_first_asset_id","chosen_last_asset_id");--> statement-breakpoint
CREATE INDEX "idx_generation_events_first_asset_fk" ON "generation_events" USING btree ("chosen_first_asset_id");--> statement-breakpoint
CREATE INDEX "idx_generation_events_last_asset_fk" ON "generation_events" USING btree ("chosen_last_asset_id");--> statement-breakpoint
CREATE INDEX "idx_id_uuid_mapping_uuid" ON "id_uuid_mapping" USING btree ("table_name","uuid_id");--> statement-breakpoint
CREATE INDEX "idx_json_schemas_name" ON "json_schemas" USING btree ("schema_name");--> statement-breakpoint
CREATE INDEX "idx_tasks_params_gin" ON "legacy_tasks" USING btree ("params");--> statement-breakpoint
CREATE INDEX "idx_tasks_deleted_at" ON "legacy_tasks" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_batch" ON "legacy_tasks" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "youtube_videos_url_uidx" ON "youtube_videos" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_youtube_videos_published_at" ON "youtube_videos" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_youtube_videos_created_at" ON "youtube_videos" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "youtube_videos_youtube_id_partial_uidx" ON "youtube_videos" USING btree ("youtube_id");--> statement-breakpoint
CREATE INDEX "youtube_videos_published_at_idx" ON "youtube_videos" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "youtube_videos_channel_title_idx" ON "youtube_videos" USING btree ("channel_title");--> statement-breakpoint
CREATE UNIQUE INDEX "youtube_videos_youtube_id_uidx" ON "youtube_videos" USING btree ("youtube_id");