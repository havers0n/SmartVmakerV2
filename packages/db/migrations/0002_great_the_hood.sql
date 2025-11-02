CREATE TABLE "jobs"."animation_job_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_index" integer NOT NULL,
	"asset_id_first_frame" uuid NOT NULL,
	"asset_id_last_frame" uuid NOT NULL,
	"status" "app_job_status" DEFAULT 'pending' NOT NULL,
	"halu_task_id" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD CONSTRAINT "animation_job_queue_project_id_generation_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "generation_pipeline"."generation_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD CONSTRAINT "animation_job_queue_asset_id_first_frame_assets_id_fk" FOREIGN KEY ("asset_id_first_frame") REFERENCES "generation_pipeline"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs"."animation_job_queue" ADD CONSTRAINT "animation_job_queue_asset_id_last_frame_assets_id_fk" FOREIGN KEY ("asset_id_last_frame") REFERENCES "generation_pipeline"."assets"("id") ON DELETE cascade ON UPDATE no action;