ALTER TABLE "jobs"."analysis_job_queue" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."analysis_job_queue" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."analysis_job_queue" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "jobs"."analysis_job_queue" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."generation_job_queue" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."generation_job_queue" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."generation_job_queue" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "jobs"."generation_job_queue" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."ingest_job_queue" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."ingest_job_queue" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."ingest_job_queue" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "jobs"."ingest_job_queue" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD COLUMN "next_retry_at" timestamp with time zone;