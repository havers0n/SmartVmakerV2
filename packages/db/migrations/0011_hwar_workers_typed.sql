-- 0011_hwar_workers_typed.sql
-- Create/upgrade hwar_workers with enums + heartbeat + config

-- 1) ENUMs (idempotent)
DO $$ BEGIN
  CREATE TYPE public.hwar_worker_type AS ENUM (
    'ingest','analysis','keyframe','animation','enrichment','cleanup'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.hwar_worker_status AS ENUM (
    'idle','running','paused','error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Ensure table exists (THIS fixes your 42P01)
CREATE TABLE IF NOT EXISTS public.hwar_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3) Add new columns (idempotent)
ALTER TABLE public.hwar_workers
  ADD COLUMN IF NOT EXISTS type public.hwar_worker_type,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concurrency integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS daily_limit_usd numeric NOT NULL DEFAULT 0;

-- 4) Backfill type (must happen before NOT NULL)
UPDATE public.hwar_workers
SET type = 'ingest'
WHERE type IS NULL;

-- 5) Convert status to enum only if it's not already hwar_worker_status
DO $$
DECLARE
  udt text;
BEGIN
  SELECT udt_name INTO udt
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='hwar_workers'
    AND column_name='status';

  -- status is enum already -> udt_name == 'hwar_worker_status'
  IF udt IS DISTINCT FROM 'hwar_worker_status' THEN
    -- create temp column
    ALTER TABLE public.hwar_workers
      ADD COLUMN IF NOT EXISTS status_new public.hwar_worker_status;

    -- fill temp column (map legacy text -> enum)
    UPDATE public.hwar_workers
    SET status_new = CASE
      WHEN lower(status::text) IN ('paused','pause') THEN 'paused'::public.hwar_worker_status
      WHEN lower(status::text) IN ('running','processing','busy','active','work','working') THEN 'running'::public.hwar_worker_status
      WHEN lower(status::text) IN ('error','failed','fatal') THEN 'error'::public.hwar_worker_status
      ELSE 'idle'::public.hwar_worker_status
    END
    WHERE status_new IS NULL;

    -- drop old + rename
    ALTER TABLE public.hwar_workers DROP COLUMN status;
    ALTER TABLE public.hwar_workers RENAME COLUMN status_new TO status;
  END IF;
END $$;

-- 6) Constraints / defaults
ALTER TABLE public.hwar_workers
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'idle'::public.hwar_worker_status;

-- 7) Indexes
CREATE INDEX IF NOT EXISTS hwar_workers_type_idx ON public.hwar_workers(type);
CREATE INDEX IF NOT EXISTS hwar_workers_last_seen_idx ON public.hwar_workers(last_seen_at);
