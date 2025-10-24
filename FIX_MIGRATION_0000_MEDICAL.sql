-- ============================================================================
-- FIX: Apply missing columns to tasks table for 0000_medical migration
-- Run this in Supabase SQL Editor if MCP is in read-only mode
-- ============================================================================

-- Add missing columns to tasks table
ALTER TABLE "tasks"
ADD COLUMN IF NOT EXISTS "params" jsonb,
ADD COLUMN IF NOT EXISTS "file_id" text,
ADD COLUMN IF NOT EXISTS "error" text,
ADD COLUMN IF NOT EXISTS "batch_id" text,
ADD COLUMN IF NOT EXISTS "topic" text,
ADD COLUMN IF NOT EXISTS "lang" text;

-- Make required columns NOT NULL
ALTER TABLE "tasks"
ALTER COLUMN "kind" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "started_at" SET NOT NULL;

-- Create missing index that 0000_medical migration tries to create
CREATE INDEX IF NOT EXISTS "idx_tasks_batch" ON "tasks" ("batch_id");

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;
