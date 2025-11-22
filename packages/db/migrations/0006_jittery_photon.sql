CREATE TYPE "public"."job_stage" AS ENUM('init', 'checking_dupes', 'submitting', 'waiting_external', 'downloading', 'uploading', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD COLUMN "stage" text DEFAULT 'init' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_anim_project_scene" ON "jobs"."animation_job_queue" USING btree ("project_id","scene_index");