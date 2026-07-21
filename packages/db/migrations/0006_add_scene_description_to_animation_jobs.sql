-- Add scene_description column to animation_job_queue table
ALTER TABLE jobs.animation_job_queue
ADD COLUMN scene_description TEXT NOT NULL DEFAULT '';

-- Add comment for documentation
COMMENT ON COLUMN jobs.animation_job_queue.scene_description IS 'Scene description for contextual animation generation';