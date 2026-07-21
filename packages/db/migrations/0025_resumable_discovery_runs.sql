-- Durable, resumable execution state for Discovery. Existing runs remain readable.
ALTER TABLE "discovery_runs"
  ADD COLUMN IF NOT EXISTS "cancel_requested_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "total_steps" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "request_budget" integer DEFAULT 50 NOT NULL,
  ADD COLUMN IF NOT EXISTS "external_request_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "estimated_quota_units_used" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;

ALTER TABLE "discovery_runs" DROP CONSTRAINT IF EXISTS "discovery_runs_status_check";
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_status_check"
  CHECK ("status" IN ('pending', 'queued', 'running', 'blocked', 'completed', 'completed_with_errors', 'failed', 'cancelled'));
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_request_budget_check" CHECK ("request_budget" > 0);

CREATE UNIQUE INDEX IF NOT EXISTS "discovery_runs_idempotency_key_unique"
  ON "discovery_runs" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "discovery_runs_progress_idx" ON "discovery_runs" ("status", "updated_at" DESC);

CREATE TABLE IF NOT EXISTS "discovery_run_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "discovery_runs"("id") ON DELETE CASCADE,
  "step_key" text NOT NULL,
  "step_type" text NOT NULL DEFAULT 'search',
  "query_id" uuid REFERENCES "niche_queries"("id") ON DELETE SET NULL,
  "query_snapshot" jsonb NOT NULL,
  "search_order" text,
  "status" text NOT NULL DEFAULT 'pending',
  "checkpoint" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 4,
  "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_by" text,
  "locked_at" timestamp with time zone,
  "lock_expires_at" timestamp with time zone,
  "heartbeat_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_error_code" text,
  "last_error_message" text,
  "external_request_count" integer NOT NULL DEFAULT 0,
  "estimated_quota_units_used" integer NOT NULL DEFAULT 0,
  "result_counters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "discovery_run_steps_unique_key" UNIQUE("run_id", "step_key"),
  CONSTRAINT "discovery_run_steps_status_check" CHECK ("status" IN ('pending', 'processing', 'retry_wait', 'completed', 'failed', 'cancelled', 'blocked_quota')),
  CONSTRAINT "discovery_run_steps_type_check" CHECK ("step_type" IN ('search', 'finalize')),
  CONSTRAINT "discovery_run_steps_search_order_check" CHECK ("search_order" IS NULL OR "search_order" IN ('relevance', 'viewCount', 'date'))
);

CREATE INDEX IF NOT EXISTS "discovery_run_steps_claim_idx"
  ON "discovery_run_steps" ("available_at", "created_at")
  WHERE "status" IN ('pending', 'retry_wait');
CREATE INDEX IF NOT EXISTS "discovery_run_steps_lease_idx"
  ON "discovery_run_steps" ("lock_expires_at") WHERE "status" = 'processing';
CREATE INDEX IF NOT EXISTS "discovery_run_steps_run_status_idx" ON "discovery_run_steps" ("run_id", "status");

ALTER TABLE "discovery_run_steps" ENABLE ROW LEVEL SECURITY;
