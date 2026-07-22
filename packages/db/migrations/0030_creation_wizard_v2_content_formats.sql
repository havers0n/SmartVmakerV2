-- Additive Content Format metadata required by Creation Wizard V2.
ALTER TABLE "content_formats"
  ADD COLUMN "example_output" text,
  ADD COLUMN "input_schema" jsonb NOT NULL DEFAULT '{"type":"object","properties":{},"required":[],"additionalProperties":false}'::jsonb,
  ADD COLUMN "production_defaults" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "production_rules" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "content_formats"
  ADD CONSTRAINT "content_formats_input_schema_object_check"
    CHECK (jsonb_typeof("input_schema") = 'object'),
  ADD CONSTRAINT "content_formats_production_defaults_object_check"
    CHECK (jsonb_typeof("production_defaults") = 'object'),
  ADD CONSTRAINT "content_formats_production_rules_array_check"
    CHECK (jsonb_typeof("production_rules") = 'array');

ALTER TABLE "generation_pipeline"."video_projects"
  ADD COLUMN "client_submission_id" text;

ALTER TABLE "generation_pipeline"."video_projects"
  ADD CONSTRAINT "video_projects_owner_submission_unique"
  UNIQUE ("owner_id", "client_submission_id"),
  ADD CONSTRAINT "video_projects_submission_id_check"
  CHECK ("client_submission_id" IS NULL OR length("client_submission_id") BETWEEN 1 AND 200);

ALTER TABLE "generation_pipeline"."generation_runs"
  ADD COLUMN "client_submission_id" text;

ALTER TABLE "generation_pipeline"."generation_runs"
  ADD CONSTRAINT "generation_runs_project_submission_unique"
  UNIQUE ("project_id", "client_submission_id"),
  ADD CONSTRAINT "generation_runs_submission_id_check"
  CHECK ("client_submission_id" IS NULL OR length("client_submission_id") BETWEEN 1 AND 200);

CREATE OR REPLACE FUNCTION "generation_pipeline"."enforce_generation_run_snapshot_immutability"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.client_submission_id IS DISTINCT FROM OLD.client_submission_id
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
