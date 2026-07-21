ALTER TABLE "discovery_clusters"
  ADD COLUMN IF NOT EXISTS "adjusted_research_score" numeric(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "label_quality_score" numeric(5,4) NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "discovery_clusters_run_score_idx";
CREATE INDEX IF NOT EXISTS "discovery_clusters_run_score_idx"
  ON "discovery_clusters" ("run_id", "adjusted_research_score" DESC);
