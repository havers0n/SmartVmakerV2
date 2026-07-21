ALTER TABLE "discovery_clusters"
  ADD COLUMN IF NOT EXISTS "dominant_language" text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "language_match_score" numeric(5,4) NOT NULL DEFAULT 0;
