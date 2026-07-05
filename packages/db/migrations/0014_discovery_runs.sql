CREATE TABLE IF NOT EXISTS "discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche_id" uuid NOT NULL REFERENCES "niches"("id"),
	"status" text DEFAULT 'pending' NOT NULL,
	"cutoff_date" timestamp with time zone,
	"search_orders" jsonb DEFAULT '["relevance","viewCount","date"]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_runs_status_check" CHECK ("status" IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS "discovery_runs_niche_created_idx"
	ON "discovery_runs" ("niche_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "video_discoveries" (
	"run_id" uuid NOT NULL REFERENCES "discovery_runs"("id") ON DELETE CASCADE,
	"video_id" uuid NOT NULL REFERENCES "youtube_videos"("id") ON DELETE CASCADE,
	"query_id" uuid NOT NULL REFERENCES "niche_queries"("id") ON DELETE CASCADE,
	"search_order" text NOT NULL,
	"result_position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_discoveries_pk" PRIMARY KEY("run_id", "video_id", "query_id", "search_order"),
	CONSTRAINT "video_discoveries_search_order_check" CHECK ("search_order" IN ('relevance', 'viewCount', 'date')),
	CONSTRAINT "video_discoveries_position_check" CHECK ("result_position" > 0)
);

CREATE INDEX IF NOT EXISTS "video_discoveries_run_idx" ON "video_discoveries" ("run_id");

ALTER TABLE "discovery_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_discoveries" ENABLE ROW LEVEL SECURITY;
