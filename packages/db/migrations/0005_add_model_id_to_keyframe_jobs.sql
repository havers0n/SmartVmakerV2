-- Add modelId column to keyframe_job_queue table
ALTER TABLE jobs.keyframe_job_queue
ADD COLUMN model_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN jobs.keyframe_job_queue.model_id IS 'AI model ID for keyframe generation (references ai_models.id)';