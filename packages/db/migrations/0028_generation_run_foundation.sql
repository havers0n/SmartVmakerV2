-- Canonical, additive Project -> Generation Run foundation.
-- Legacy generation_pipeline.generation_projects remains the active production pipeline.

CREATE TABLE "generation_pipeline"."video_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "title" text NOT NULL,
  "idea" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "content_format_id" uuid REFERENCES "content_formats"("id") ON DELETE RESTRICT,
  "story_template_id" uuid REFERENCES "aes_core"."story_templates"("id") ON DELETE SET NULL,
  "project_defaults" jsonb NOT NULL DEFAULT '{"schemaVersion":1,"production":{},"models":{}}'::jsonb,
  "promoted_run_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "video_projects_title_check" CHECK (length(trim("title")) BETWEEN 1 AND 200),
  CONSTRAINT "video_projects_idea_check" CHECK (length(trim("idea")) BETWEEN 1 AND 10000),
  CONSTRAINT "video_projects_status_check" CHECK ("status" IN ('draft', 'active', 'archived')),
  CONSTRAINT "video_projects_defaults_check" CHECK (
    jsonb_typeof("project_defaults") = 'object'
    AND "project_defaults" @> '{"schemaVersion":1}'::jsonb
  )
);

CREATE TABLE "generation_pipeline"."generation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "generation_pipeline"."video_projects"("id") ON DELETE CASCADE,
  "run_number" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "stage" text NOT NULL DEFAULT 'scenario',
  "input_snapshot" jsonb NOT NULL,
  "project_snapshot" jsonb NOT NULL,
  "content_format_snapshot" jsonb,
  "story_template_snapshot" jsonb,
  "model_snapshot" jsonb NOT NULL,
  "prompt_snapshot" jsonb NOT NULL,
  "source_snapshot" jsonb,
  "schema_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "failed_stage" text,
  "error_code" text,
  "error_message" text,
  CONSTRAINT "generation_runs_project_number_unique" UNIQUE ("project_id", "run_number"),
  CONSTRAINT "generation_runs_project_id_id_unique" UNIQUE ("project_id", "id"),
  CONSTRAINT "generation_runs_number_check" CHECK ("run_number" > 0),
  CONSTRAINT "generation_runs_status_check" CHECK ("status" IN ('draft', 'queued', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT "generation_runs_stage_check" CHECK ("stage" IN ('scenario', 'keyframes', 'clips', 'composition')),
  CONSTRAINT "generation_runs_failed_stage_check" CHECK ("failed_stage" IS NULL OR "failed_stage" IN ('scenario', 'keyframes', 'clips', 'composition')),
  CONSTRAINT "generation_runs_schema_version_check" CHECK ("schema_version" = 1),
  CONSTRAINT "generation_runs_input_snapshot_check" CHECK (jsonb_typeof("input_snapshot") = 'object'),
  CONSTRAINT "generation_runs_project_snapshot_check" CHECK (jsonb_typeof("project_snapshot") = 'object'),
  CONSTRAINT "generation_runs_content_format_snapshot_check" CHECK ("content_format_snapshot" IS NULL OR jsonb_typeof("content_format_snapshot") = 'object'),
  CONSTRAINT "generation_runs_story_template_snapshot_check" CHECK ("story_template_snapshot" IS NULL OR jsonb_typeof("story_template_snapshot") = 'object'),
  CONSTRAINT "generation_runs_model_snapshot_check" CHECK (jsonb_typeof("model_snapshot") = 'object'),
  CONSTRAINT "generation_runs_prompt_snapshot_check" CHECK (jsonb_typeof("prompt_snapshot") = 'object'),
  CONSTRAINT "generation_runs_source_snapshot_check" CHECK ("source_snapshot" IS NULL OR jsonb_typeof("source_snapshot") = 'object')
);

ALTER TABLE "generation_pipeline"."video_projects"
  ADD CONSTRAINT "video_projects_promoted_run_same_project_fk"
  FOREIGN KEY ("id", "promoted_run_id")
  REFERENCES "generation_pipeline"."generation_runs"("project_id", "id")
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "video_projects_owner_updated_idx"
  ON "generation_pipeline"."video_projects" ("owner_id", "updated_at" DESC);
CREATE INDEX "video_projects_content_format_idx"
  ON "generation_pipeline"."video_projects" ("content_format_id");
CREATE INDEX "video_projects_story_template_idx"
  ON "generation_pipeline"."video_projects" ("story_template_id");
CREATE INDEX "generation_runs_project_created_idx"
  ON "generation_pipeline"."generation_runs" ("project_id", "created_at" DESC);
CREATE INDEX "generation_runs_status_stage_idx"
  ON "generation_pipeline"."generation_runs" ("status", "stage");

CREATE FUNCTION "generation_pipeline"."enforce_generation_run_snapshot_immutability"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.run_number IS DISTINCT FROM OLD.run_number
    OR NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot
    OR NEW.project_snapshot IS DISTINCT FROM OLD.project_snapshot
    OR NEW.content_format_snapshot IS DISTINCT FROM OLD.content_format_snapshot
    OR NEW.story_template_snapshot IS DISTINCT FROM OLD.story_template_snapshot
    OR NEW.model_snapshot IS DISTINCT FROM OLD.model_snapshot
    OR NEW.prompt_snapshot IS DISTINCT FROM OLD.prompt_snapshot
    OR NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot
    OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'generation run snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "generation_runs_snapshot_immutable"
BEFORE UPDATE ON "generation_pipeline"."generation_runs"
FOR EACH ROW
EXECUTE FUNCTION "generation_pipeline"."enforce_generation_run_snapshot_immutability"();

ALTER TABLE "generation_pipeline"."video_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_pipeline"."generation_runs" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "generation_pipeline" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "generation_pipeline"."video_projects" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "generation_pipeline"."generation_runs" TO authenticated;

CREATE POLICY "video_projects_select_own"
  ON "generation_pipeline"."video_projects" FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "video_projects_insert_own"
  ON "generation_pipeline"."video_projects" FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "video_projects_update_own"
  ON "generation_pipeline"."video_projects" FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "video_projects_delete_own"
  ON "generation_pipeline"."video_projects" FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "generation_runs_select_own"
  ON "generation_pipeline"."generation_runs" FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "generation_pipeline"."video_projects" project
    WHERE project.id = project_id AND project.owner_id = (SELECT auth.uid())
  ));
CREATE POLICY "generation_runs_insert_own"
  ON "generation_pipeline"."generation_runs" FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM "generation_pipeline"."video_projects" project
    WHERE project.id = project_id AND project.owner_id = (SELECT auth.uid())
  ));
CREATE POLICY "generation_runs_update_own"
  ON "generation_pipeline"."generation_runs" FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "generation_pipeline"."video_projects" project
    WHERE project.id = project_id AND project.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "generation_pipeline"."video_projects" project
    WHERE project.id = project_id AND project.owner_id = (SELECT auth.uid())
  ));
