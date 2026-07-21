ALTER TABLE "aes_core"."ai_models" ADD COLUMN "request_defaults" jsonb;--> statement-breakpoint
ALTER TABLE "aes_core"."ai_models" ADD COLUMN "response_adapter" jsonb;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD COLUMN "scene_description" text NOT NULL;