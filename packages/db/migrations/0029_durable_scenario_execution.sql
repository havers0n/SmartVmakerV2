-- Durable scenario execution: immutable Run -> append-only Attempts -> validated Artifact.

ALTER TABLE "generation_pipeline"."generation_runs"
  DROP CONSTRAINT "generation_runs_status_check";
ALTER TABLE "generation_pipeline"."generation_runs"
  ADD CONSTRAINT "generation_runs_status_check"
  CHECK ("status" IN ('draft', 'active', 'queued', 'running', 'succeeded', 'failed', 'cancelled'));

CREATE TABLE "generation_pipeline"."scenario_generation_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "generation_pipeline"."generation_runs"("id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "provider" text NOT NULL,
  "model_id" text NOT NULL,
  "correlation_id" uuid NOT NULL,
  "idempotency_key" text NOT NULL,
  "provider_request_id" text,
  "finish_reason" text,
  "usage" jsonb,
  "validation_result" jsonb,
  "error_code" text,
  "error_message" text,
  "diagnostic_payload" jsonb,
  "queued_at" timestamp with time zone NOT NULL DEFAULT now(),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "scenario_attempts_run_number_unique" UNIQUE ("run_id", "attempt_number"),
  CONSTRAINT "scenario_attempts_run_idempotency_unique" UNIQUE ("run_id", "idempotency_key"),
  CONSTRAINT "scenario_attempts_number_check" CHECK ("attempt_number" > 0),
  CONSTRAINT "scenario_attempts_status_check" CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT "scenario_attempts_provider_check" CHECK (length(trim("provider")) BETWEEN 1 AND 100),
  CONSTRAINT "scenario_attempts_model_check" CHECK (length(trim("model_id")) BETWEEN 1 AND 200),
  CONSTRAINT "scenario_attempts_idempotency_check" CHECK (length("idempotency_key") BETWEEN 1 AND 200),
  CONSTRAINT "scenario_attempts_usage_check" CHECK ("usage" IS NULL OR jsonb_typeof("usage") = 'object'),
  CONSTRAINT "scenario_attempts_validation_check" CHECK ("validation_result" IS NULL OR jsonb_typeof("validation_result") = 'object'),
  CONSTRAINT "scenario_attempts_diagnostic_check" CHECK (
    "diagnostic_payload" IS NULL
    OR (jsonb_typeof("diagnostic_payload") = 'object' AND pg_column_size("diagnostic_payload") <= 16384)
  ),
  CONSTRAINT "scenario_attempts_timestamps_check" CHECK (
    ("status" = 'queued' AND "started_at" IS NULL AND "completed_at" IS NULL)
    OR ("status" = 'running' AND "started_at" IS NOT NULL AND "completed_at" IS NULL)
    OR ("status" IN ('succeeded', 'failed', 'cancelled') AND "completed_at" IS NOT NULL)
  ),
  CONSTRAINT "scenario_attempts_error_check" CHECK (
    ("status" = 'failed' AND "error_code" IS NOT NULL AND "error_message" IS NOT NULL)
    OR ("status" <> 'failed')
  )
);

CREATE TABLE "generation_pipeline"."scenario_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "generation_pipeline"."generation_runs"("id") ON DELETE CASCADE,
  "attempt_id" uuid NOT NULL REFERENCES "generation_pipeline"."scenario_generation_attempts"("id") ON DELETE CASCADE,
  "artifact_type" text NOT NULL DEFAULT 'scenario_candidates',
  "schema_version" integer NOT NULL DEFAULT 1,
  "payload" jsonb NOT NULL,
  "validation_metadata" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "scenario_artifacts_run_unique" UNIQUE ("run_id"),
  CONSTRAINT "scenario_artifacts_attempt_unique" UNIQUE ("attempt_id"),
  CONSTRAINT "scenario_artifacts_type_check" CHECK ("artifact_type" = 'scenario_candidates'),
  CONSTRAINT "scenario_artifacts_schema_check" CHECK ("schema_version" = 1),
  CONSTRAINT "scenario_artifacts_payload_check" CHECK (jsonb_typeof("payload") = 'array' AND jsonb_array_length("payload") > 0),
  CONSTRAINT "scenario_artifacts_validation_check" CHECK (jsonb_typeof("validation_metadata") = 'object')
);

CREATE TABLE "jobs"."scenario_generation_job_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_id" uuid NOT NULL REFERENCES "generation_pipeline"."scenario_generation_attempts"("id") ON DELETE CASCADE,
  "event_key" text NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_at" timestamp with time zone,
  "locked_by" uuid,
  "completed_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "scenario_jobs_attempt_unique" UNIQUE ("attempt_id"),
  CONSTRAINT "scenario_jobs_event_unique" UNIQUE ("event_key"),
  CONSTRAINT "scenario_jobs_status_check" CHECK ("status" IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT "scenario_jobs_event_key_check" CHECK (length("event_key") BETWEEN 1 AND 200),
  CONSTRAINT "scenario_jobs_timestamps_check" CHECK (
    ("status" = 'queued' AND "locked_at" IS NULL AND "locked_by" IS NULL AND "completed_at" IS NULL)
    OR ("status" = 'processing' AND "locked_at" IS NOT NULL AND "locked_by" IS NOT NULL AND "completed_at" IS NULL)
    OR ("status" IN ('completed', 'failed', 'cancelled') AND "completed_at" IS NOT NULL)
  )
);

CREATE INDEX "scenario_attempts_run_created_idx"
  ON "generation_pipeline"."scenario_generation_attempts" ("run_id", "attempt_number" DESC);
CREATE INDEX "scenario_attempts_status_idx"
  ON "generation_pipeline"."scenario_generation_attempts" ("status", "queued_at");
CREATE INDEX "scenario_jobs_claim_idx"
  ON "jobs"."scenario_generation_job_queue" ("status", "available_at", "created_at");

CREATE FUNCTION "generation_pipeline"."enforce_scenario_attempt_lifecycle"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.run_id IS DISTINCT FROM OLD.run_id
    OR NEW.attempt_number IS DISTINCT FROM OLD.attempt_number
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.model_id IS DISTINCT FROM OLD.model_id
    OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.queued_at IS DISTINCT FROM OLD.queued_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'scenario attempt identity is immutable';
  END IF;
  IF NOT (
    (OLD.status = 'queued' AND NEW.status IN ('running', 'cancelled'))
    OR (OLD.status = 'running' AND NEW.status IN ('succeeded', 'failed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'invalid scenario attempt status transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "scenario_attempts_lifecycle"
BEFORE UPDATE ON "generation_pipeline"."scenario_generation_attempts"
FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."enforce_scenario_attempt_lifecycle"();

CREATE FUNCTION "generation_pipeline"."validate_scenario_artifact_insert"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE attempt_row record;
BEGIN
  SELECT run_id, status INTO attempt_row
  FROM generation_pipeline.scenario_generation_attempts
  WHERE id = NEW.attempt_id;
  IF attempt_row.run_id IS DISTINCT FROM NEW.run_id OR attempt_row.status <> 'running' THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'scenario artifact requires the matching running attempt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "generation_pipeline"."reject_scenario_artifact_update"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'scenario artifacts are immutable';
END;
$$;

CREATE TRIGGER "scenario_artifacts_validate_insert"
BEFORE INSERT ON "generation_pipeline"."scenario_artifacts"
FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."validate_scenario_artifact_insert"();
CREATE TRIGGER "scenario_artifacts_immutable"
BEFORE UPDATE ON "generation_pipeline"."scenario_artifacts"
FOR EACH ROW EXECUTE FUNCTION "generation_pipeline"."reject_scenario_artifact_update"();

CREATE FUNCTION "jobs"."enforce_scenario_job_lifecycle"()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
    OR NEW.event_key IS DISTINCT FROM OLD.event_key
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'scenario queue event identity is immutable';
  END IF;
  IF NOT (
    (OLD.status = 'queued' AND NEW.status IN ('processing', 'cancelled'))
    OR (OLD.status = 'processing' AND NEW.status IN ('completed', 'failed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = 'invalid scenario queue status transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "scenario_jobs_lifecycle"
BEFORE UPDATE ON "jobs"."scenario_generation_job_queue"
FOR EACH ROW EXECUTE FUNCTION "jobs"."enforce_scenario_job_lifecycle"();

ALTER TABLE "generation_pipeline"."scenario_generation_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_pipeline"."scenario_artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs"."scenario_generation_job_queue" ENABLE ROW LEVEL SECURITY;

GRANT SELECT (
  "id", "run_id", "attempt_number", "status", "provider", "model_id",
  "correlation_id", "idempotency_key", "provider_request_id", "finish_reason",
  "usage", "validation_result", "error_code", "error_message",
  "queued_at", "started_at", "completed_at", "created_at"
) ON "generation_pipeline"."scenario_generation_attempts" TO authenticated;
GRANT SELECT ON "generation_pipeline"."scenario_artifacts" TO authenticated;

CREATE POLICY "scenario_attempts_select_own" ON "generation_pipeline"."scenario_generation_attempts"
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM generation_pipeline.generation_runs run
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE run.id = run_id AND project.owner_id = (SELECT auth.uid())
  ));
CREATE POLICY "scenario_artifacts_select_own" ON "generation_pipeline"."scenario_artifacts"
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM generation_pipeline.generation_runs run
    JOIN generation_pipeline.video_projects project ON project.id = run.project_id
    WHERE run.id = run_id AND project.owner_id = (SELECT auth.uid())
  ));

-- Queue rows are intentionally service-only. No authenticated grants or policies.
