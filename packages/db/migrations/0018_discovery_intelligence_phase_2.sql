ALTER TABLE "discovery_runs" ADD COLUMN IF NOT EXISTS "ai_summary" text;

CREATE TABLE IF NOT EXISTS "discovery_clusters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "discovery_runs"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "summary" text NOT NULL,
  "research_score" numeric(6,4) NOT NULL,
  "video_count" integer NOT NULL,
  "channel_count" integer NOT NULL,
  "median_views_per_day" numeric(14,2) NOT NULL,
  "small_channel_count" integer NOT NULL,
  "representative_titles" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "discovery_clusters_run_score_idx"
  ON "discovery_clusters" ("run_id", "research_score" DESC);

CREATE TABLE IF NOT EXISTS "discovery_cluster_videos" (
  "run_id" uuid NOT NULL REFERENCES "discovery_runs"("id") ON DELETE CASCADE,
  "video_id" uuid NOT NULL REFERENCES "youtube_videos"("id") ON DELETE CASCADE,
  "cluster_id" uuid NOT NULL REFERENCES "discovery_clusters"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "discovery_cluster_videos_pk" PRIMARY KEY ("run_id", "video_id")
);

CREATE INDEX IF NOT EXISTS "discovery_cluster_videos_cluster_idx"
  ON "discovery_cluster_videos" ("cluster_id");

ALTER TABLE "discovery_clusters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discovery_cluster_videos" ENABLE ROW LEVEL SECURITY;
