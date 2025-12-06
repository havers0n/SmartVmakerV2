CREATE TABLE "generation_pipeline"."generation_animation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scene_index" integer NOT NULL,
	"provider" text DEFAULT 'minimax' NOT NULL,
	"model" text NOT NULL,
	"minimax_task_id" text,
	"minimax_file_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"resolution" text,
	"duration_sec" integer,
	"video_url" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_pipeline"."generation_animation_jobs" ADD CONSTRAINT "generation_animation_jobs_project_id_generation_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "generation_pipeline"."generation_projects"("id") ON DELETE cascade ON UPDATE no action;