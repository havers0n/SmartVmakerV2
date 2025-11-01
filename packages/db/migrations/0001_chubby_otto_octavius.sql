CREATE TABLE "jobs"."keyframe_job_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_index" integer NOT NULL,
	"frame_type" text NOT NULL,
	"prompt" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD CONSTRAINT "keyframe_job_queue_project_id_generation_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "generation_pipeline"."generation_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs"."keyframe_job_queue" ADD CONSTRAINT "keyframe_job_queue_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "generation_pipeline"."assets"("id") ON DELETE cascade ON UPDATE no action;