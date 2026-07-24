-- Immutable approved scenario history and its mutable per-Run pointer.
CREATE TABLE "generation_pipeline"."approved_scenario_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "generation_pipeline"."generation_runs"("id") ON DELETE CASCADE,
  "scenario_artifact_id" uuid NOT NULL REFERENCES "generation_pipeline"."scenario_artifacts"("id") ON DELETE CASCADE,
  "revision_number" integer NOT NULL,
  "source_candidate_index" integer NOT NULL,
  "selected_candidate" jsonb NOT NULL,
  "scenes" jsonb NOT NULL,
  "production_plan" jsonb,
  "idempotency_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "approved_scenario_revisions_run_revision_unique" UNIQUE ("run_id", "revision_number"),
  CONSTRAINT "approved_scenario_revisions_run_idempotency_unique" UNIQUE ("run_id", "idempotency_key"),
  CONSTRAINT "approved_scenario_revisions_run_id_id_unique" UNIQUE ("run_id", "id"),
  CONSTRAINT "approved_scenario_revisions_number_check" CHECK ("revision_number" > 0),
  CONSTRAINT "approved_scenario_revisions_candidate_index_check" CHECK ("source_candidate_index" >= 0),
  CONSTRAINT "approved_scenario_revisions_candidate_check" CHECK (jsonb_typeof("selected_candidate") = 'object'),
  CONSTRAINT "approved_scenario_revisions_scenes_check" CHECK (jsonb_typeof("scenes") = 'array' AND jsonb_array_length("scenes") > 0),
  CONSTRAINT "approved_scenario_revisions_plan_check" CHECK ("production_plan" IS NULL OR jsonb_typeof("production_plan") = 'object'),
  CONSTRAINT "approved_scenario_revisions_idempotency_check" CHECK (length("idempotency_key") BETWEEN 1 AND 200)
);
CREATE INDEX "approved_scenario_revisions_run_created_idx" ON "generation_pipeline"."approved_scenario_revisions" ("run_id", "created_at" DESC);

CREATE TABLE "generation_pipeline"."current_approved_scenario_revisions" (
  "run_id" uuid PRIMARY KEY NOT NULL REFERENCES "generation_pipeline"."generation_runs"("id") ON DELETE CASCADE,
  "revision_id" uuid NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "current_approved_scenario_revisions_same_run_fk"
    FOREIGN KEY ("run_id", "revision_id") REFERENCES "generation_pipeline"."approved_scenario_revisions"("run_id", "id")
);

CREATE FUNCTION "generation_pipeline"."validate_approved_scenario_revision_insert"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE artifact_row record;
BEGIN
  SELECT run_id INTO artifact_row FROM generation_pipeline.scenario_artifacts WHERE id = NEW.scenario_artifact_id;
  IF artifact_row.run_id IS DISTINCT FROM NEW.run_id THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'approved revision artifact must belong to its run';
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION "generation_pipeline"."reject_approved_scenario_revision_update"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'approved scenario revisions are immutable'; END;
$$;
CREATE TRIGGER "approved_scenario_revisions_validate_insert" BEFORE INSERT ON "generation_pipeline"."approved_scenario_revisions" FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."validate_approved_scenario_revision_insert"();
CREATE TRIGGER "approved_scenario_revisions_immutable" BEFORE UPDATE ON "generation_pipeline"."approved_scenario_revisions" FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."reject_approved_scenario_revision_update"();

ALTER TABLE "generation_pipeline"."approved_scenario_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_pipeline"."current_approved_scenario_revisions" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON "generation_pipeline"."approved_scenario_revisions", "generation_pipeline"."current_approved_scenario_revisions" TO authenticated;
CREATE POLICY "approved_scenario_revisions_select_own" ON "generation_pipeline"."approved_scenario_revisions" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM generation_pipeline.generation_runs run JOIN generation_pipeline.video_projects project ON project.id = run.project_id WHERE run.id = run_id AND project.owner_id = (SELECT auth.uid())));
CREATE POLICY "current_approved_scenario_revisions_select_own" ON "generation_pipeline"."current_approved_scenario_revisions" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM generation_pipeline.generation_runs run JOIN generation_pipeline.video_projects project ON project.id = run.project_id WHERE run.id = run_id AND project.owner_id = (SELECT auth.uid())));
