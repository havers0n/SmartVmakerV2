-- Durable Image Generation Foundation
-- Immutable Scene Plans, Image Generation Requests, Attempts, Artifacts, and Queue.

-- ============================================================
-- 1. generation_pipeline.scene_plans
-- ============================================================
CREATE TABLE "generation_pipeline"."scene_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "generation_pipeline"."generation_runs"("id") ON DELETE CASCADE,
  "revision_id" uuid NOT NULL,
  "scenes" jsonb NOT NULL,
  "production_plan" jsonb,
  "required_frames" jsonb NOT NULL DEFAULT '["first","last"]',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "scene_plans_run_revision_unique" UNIQUE ("run_id", "revision_id"),
  CONSTRAINT "scene_plans_run_id_id_unique" UNIQUE ("run_id", "id"),
  CONSTRAINT "scene_plans_run_revision_fk"
    FOREIGN KEY ("run_id", "revision_id")
    REFERENCES "generation_pipeline"."approved_scenario_revisions"("run_id", "id"),
  CONSTRAINT "scene_plans_scenes_check" CHECK (jsonb_typeof("scenes") = 'array' AND jsonb_array_length("scenes") > 0),
  CONSTRAINT "scene_plans_production_plan_check" CHECK ("production_plan" IS NULL OR jsonb_typeof("production_plan") = 'object'),
  CONSTRAINT "scene_plans_required_frames_check" CHECK (
    jsonb_typeof("required_frames") = 'array'
    AND jsonb_array_length("required_frames") > 0
    AND "required_frames" <@ '["first","last"]'::jsonb
  )
);
CREATE INDEX "scene_plans_run_created_idx" ON "generation_pipeline"."scene_plans" ("run_id", "created_at" DESC);

-- ============================================================
-- 2. generation_pipeline.image_generation_requests
-- ============================================================
CREATE TABLE "generation_pipeline"."image_generation_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "generation_pipeline"."generation_runs"("id") ON DELETE CASCADE,
  "scene_plan_id" uuid NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "targets" jsonb NOT NULL,
  "provider" text NOT NULL,
  "model_id" text NOT NULL,
  "model_catalog_revision" text,
  "settings" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "image_generation_requests_run_idempotency_unique" UNIQUE ("run_id", "idempotency_key"),
  CONSTRAINT "image_generation_requests_run_id_scene_plan_unique" UNIQUE ("run_id", "id", "scene_plan_id"),
  CONSTRAINT "image_generation_requests_run_scene_plan_fk"
    FOREIGN KEY ("run_id", "scene_plan_id")
    REFERENCES "generation_pipeline"."scene_plans"("run_id", "id"),
  CONSTRAINT "image_generation_requests_idempotency_key_check" CHECK (length("idempotency_key") BETWEEN 1 AND 200),
  CONSTRAINT "image_generation_requests_targets_check" CHECK (jsonb_typeof("targets") = 'array' AND jsonb_array_length("targets") > 0),
  CONSTRAINT "image_generation_requests_settings_check" CHECK (jsonb_typeof("settings") = 'object')
);
CREATE INDEX "image_generation_requests_run_created_idx" ON "generation_pipeline"."image_generation_requests" ("run_id", "created_at" DESC);

-- ============================================================
-- 3. generation_pipeline.image_attempts
-- ============================================================
CREATE TABLE "generation_pipeline"."image_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "generation_pipeline"."generation_runs"("id") ON DELETE CASCADE,
  "request_id" uuid NOT NULL,
  "scene_plan_id" uuid NOT NULL,
  "scene_index" integer NOT NULL,
  "frame_role" text NOT NULL,
  "attempt_number" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "prompt" text NOT NULL,
  "provider" text NOT NULL,
  "model_id" text NOT NULL,
  "settings" jsonb NOT NULL,
  "failure_code" text,
  "failure_summary" text,
  "internal_diagnostics" jsonb,
  "queued_at" timestamptz NOT NULL DEFAULT now(),
  "started_at" timestamptz,
  "completed_at" timestamptz,
  CONSTRAINT "image_attempts_plan_scene_role_number_unique" UNIQUE ("scene_plan_id", "scene_index", "frame_role", "attempt_number"),
  CONSTRAINT "image_attempts_run_scene_plan_fk"
    FOREIGN KEY ("run_id", "scene_plan_id")
    REFERENCES "generation_pipeline"."scene_plans"("run_id", "id"),
  CONSTRAINT "image_attempts_run_request_scene_plan_fk"
    FOREIGN KEY ("run_id", "request_id", "scene_plan_id")
    REFERENCES "generation_pipeline"."image_generation_requests"("run_id", "id", "scene_plan_id"),
  CONSTRAINT "image_attempts_frame_role_check" CHECK ("frame_role" IN ('first', 'last')),
  CONSTRAINT "image_attempts_scene_index_check" CHECK ("scene_index" >= 0),
  CONSTRAINT "image_attempts_attempt_number_check" CHECK ("attempt_number" > 0),
  CONSTRAINT "image_attempts_status_check" CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed'))
);
CREATE INDEX "image_attempts_run_status_idx" ON "generation_pipeline"."image_attempts" ("run_id", "status");
CREATE INDEX "image_attempts_request_idx" ON "generation_pipeline"."image_attempts" ("request_id");

-- Insert validation: scene_index < jsonb_array_length(scene_plans.scenes)
CREATE FUNCTION "generation_pipeline"."validate_image_attempt_insert"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE plan_row record;
BEGIN
  SELECT scenes INTO plan_row FROM generation_pipeline.scene_plans WHERE id = NEW.scene_plan_id AND run_id = NEW.run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'foreign_key_violation', MESSAGE = 'Scene plan not found for this run';
  END IF;
  IF NEW.scene_index >= jsonb_array_length(plan_row.scenes) THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'scene_index exceeds scene plan scene count';
  END IF;
  RETURN NEW;
END;
$$;

-- Status lifecycle trigger: queued->running->succeeded|failed (no other transitions)
CREATE FUNCTION "generation_pipeline"."enforce_image_attempt_status_transition"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status = 'queued' AND NEW.status = 'running' THEN
    NEW.started_at := COALESCE(NEW.started_at, now());
    RETURN NEW;
  END IF;
  IF OLD.status = 'running' AND NEW.status IN ('succeeded', 'failed') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    RETURN NEW;
  END IF;
  IF OLD.status = OLD.status AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'Invalid image attempt status transition';
END;
$$;

-- Terminal immutability: prevent updates to succeeded/failed attempts
CREATE FUNCTION "generation_pipeline"."reject_terminal_image_attempt_update"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'Terminal image attempts are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "image_attempts_validate_insert" BEFORE INSERT ON "generation_pipeline"."image_attempts"
  FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."validate_image_attempt_insert"();
CREATE TRIGGER "image_attempts_status_transition" BEFORE UPDATE ON "generation_pipeline"."image_attempts"
  FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."enforce_image_attempt_status_transition"();
CREATE TRIGGER "image_attempts_terminal_immutable" BEFORE UPDATE ON "generation_pipeline"."image_attempts"
  FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."reject_terminal_image_attempt_update"();

-- ============================================================
-- 4. generation_pipeline.image_artifacts
-- ============================================================
CREATE TABLE "generation_pipeline"."image_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_id" uuid NOT NULL UNIQUE REFERENCES "generation_pipeline"."image_attempts"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "checksum" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "image_artifacts_mime_type_check" CHECK ("mime_type" = 'image/png'),
  CONSTRAINT "image_artifacts_byte_size_check" CHECK ("byte_size" > 0),
  CONSTRAINT "image_artifacts_width_check" CHECK ("width" > 0),
  CONSTRAINT "image_artifacts_height_check" CHECK ("height" > 0),
  CONSTRAINT "image_artifacts_checksum_check" CHECK ("checksum" ~* '^[0-9a-f]{64}$')
);
CREATE INDEX "image_artifacts_attempt_idx" ON "generation_pipeline"."image_artifacts" ("attempt_id");

-- Immutable
CREATE FUNCTION "generation_pipeline"."reject_image_artifact_update"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'Image artifacts are immutable';
END;
$$;
CREATE TRIGGER "image_artifacts_immutable" BEFORE UPDATE ON "generation_pipeline"."image_artifacts"
  FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."reject_image_artifact_update"();

-- ============================================================
-- 5. jobs.image_generation_job_queue
-- ============================================================
CREATE TABLE "jobs"."image_generation_job_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_id" uuid NOT NULL UNIQUE REFERENCES "generation_pipeline"."image_attempts"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'queued',
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "locked_at" timestamptz,
  "locked_by" uuid,
  "last_error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "image_generation_job_queue_status_check" CHECK ("status" IN ('queued', 'processing', 'completed', 'failed'))
);
CREATE INDEX "image_generation_job_queue_claim_idx" ON "jobs"."image_generation_job_queue" ("status", "available_at", "created_at");

-- ============================================================
-- Deferred constraint: succeeded Attempt must have exactly one Artifact at COMMIT
-- ============================================================
CREATE FUNCTION "generation_pipeline"."check_succeeded_attempt_has_artifact"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'succeeded' THEN
    IF NOT EXISTS (SELECT 1 FROM generation_pipeline.image_artifacts WHERE attempt_id = NEW.id) THEN
      RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'Succeeded image attempt must have exactly one artifact';
    END IF;
  END IF;
  IF OLD IS NOT NULL AND OLD.status = 'succeeded' AND NEW.status = 'succeeded' THEN
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "image_attempts_artifact_required"
  AFTER UPDATE OF status ON "generation_pipeline"."image_attempts"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.status = 'succeeded')
  EXECUTE FUNCTION "generation_pipeline"."check_succeeded_attempt_has_artifact"();

-- Artifact may only belong to a succeeded Attempt
CREATE FUNCTION "generation_pipeline"."validate_image_artifact_insert"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE attempt_status text;
BEGIN
  SELECT status INTO attempt_status FROM generation_pipeline.image_attempts WHERE id = NEW.attempt_id;
  IF attempt_status IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'Artifact may only be created for a succeeded attempt';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "image_artifacts_validate_succeeded_attempt" BEFORE INSERT ON "generation_pipeline"."image_artifacts"
  FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."validate_image_artifact_insert"();

-- ============================================================
-- RLS: follow existing generation_pipeline ownership patterns
-- ============================================================
ALTER TABLE "generation_pipeline"."scene_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_pipeline"."image_generation_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_pipeline"."image_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_pipeline"."image_artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs"."image_generation_job_queue" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON
  "generation_pipeline"."scene_plans",
  "generation_pipeline"."image_generation_requests",
  "generation_pipeline"."image_attempts",
  "generation_pipeline"."image_artifacts",
  "jobs"."image_generation_job_queue"
  TO authenticated;

-- SELECT policies: authenticated users see only their own project records
CREATE POLICY "scene_plans_select_own" ON "generation_pipeline"."scene_plans" FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM generation_pipeline.generation_runs run
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE run.id = scene_plans.run_id AND project.owner_id = (SELECT auth.uid())
  ));

CREATE POLICY "image_generation_requests_select_own" ON "generation_pipeline"."image_generation_requests" FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM generation_pipeline.generation_runs run
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE run.id = image_generation_requests.run_id AND project.owner_id = (SELECT auth.uid())
  ));

CREATE POLICY "image_attempts_select_own" ON "generation_pipeline"."image_attempts" FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM generation_pipeline.generation_runs run
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE run.id = image_attempts.run_id AND project.owner_id = (SELECT auth.uid())
  ));

CREATE POLICY "image_artifacts_select_own" ON "generation_pipeline"."image_artifacts" FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM generation_pipeline.image_attempts attempt
    JOIN generation_pipeline.generation_runs run ON run.id = attempt.run_id
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE attempt.id = image_artifacts.attempt_id AND project.owner_id = (SELECT auth.uid())
  ));

CREATE POLICY "image_generation_job_queue_select_own" ON "jobs"."image_generation_job_queue" FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM generation_pipeline.image_attempts attempt
    JOIN generation_pipeline.generation_runs run ON run.id = attempt.run_id
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE attempt.id = image_generation_job_queue.attempt_id AND project.owner_id = (SELECT auth.uid())
  ));
