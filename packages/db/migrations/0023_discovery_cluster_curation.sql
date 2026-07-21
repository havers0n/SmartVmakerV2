-- Manual Discovery curation only. This does not affect clustering or scoring.
ALTER TABLE "discovery_cluster_videos"
  ADD COLUMN IF NOT EXISTS "is_excluded" boolean NOT NULL DEFAULT false;
