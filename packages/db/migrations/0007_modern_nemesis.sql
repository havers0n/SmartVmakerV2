ALTER TABLE "jobs"."analysis_job_queue" ADD COLUMN "stage" text DEFAULT 'init' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."analysis_job_queue" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "jobs"."analysis_job_queue" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "jobs"."generation_job_queue" ADD COLUMN "stage" text DEFAULT 'init' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."generation_job_queue" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "jobs"."generation_job_queue" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "jobs"."ingest_job_queue" ADD COLUMN "stage" text DEFAULT 'init' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."ingest_job_queue" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "jobs"."ingest_job_queue" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD COLUMN "stage" text DEFAULT 'init' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_analysis_video" ON "jobs"."analysis_job_queue" USING btree ("video_id","analyzer");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_generation_asset_provider" ON "jobs"."generation_job_queue" USING btree ("asset_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ingest_query" ON "jobs"."ingest_job_queue" USING btree ("query");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_keyframe_project_scene" ON "jobs"."keyframe_job_queue" USING btree ("project_id","scene_index","frame_type");