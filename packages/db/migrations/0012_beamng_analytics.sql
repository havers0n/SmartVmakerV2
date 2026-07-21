-- BeamNG Analytics: youtube_channels table
CREATE TABLE IF NOT EXISTS "youtube_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_id" text NOT NULL,
	"handle" text,
	"title" text,
	"description" text,
	"country" text,
	"subscriber_count" bigint DEFAULT 0,
	"video_count" bigint DEFAULT 0,
	"view_count" bigint DEFAULT 0,
	"published_at" timestamp with time zone,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "youtube_channels_channel_id_uidx" ON "youtube_channels" ("youtube_channel_id");
CREATE INDEX IF NOT EXISTS "youtube_channels_handle_idx" ON "youtube_channels" ("handle");

-- BeamNG Analytics: import_sessions table
CREATE TABLE IF NOT EXISTS "import_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"total_channels" integer DEFAULT 0,
	"total_videos" integer DEFAULT 0,
	"error_message" text,
	"meta" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "import_sessions_source_idx" ON "import_sessions" ("source");
CREATE INDEX IF NOT EXISTS "import_sessions_status_idx" ON "import_sessions" ("status");

-- BeamNG Analytics: add channel_id FK to youtube_videos
ALTER TABLE "youtube_videos" ADD COLUMN IF NOT EXISTS "channel_id" uuid;
CREATE INDEX IF NOT EXISTS "youtube_videos_channel_id_idx" ON "youtube_videos" ("channel_id");

-- Add FK constraint (safe: no existing rows will fail)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'youtube_videos_channel_id_youtube_channels_id_fk'
  ) THEN
    ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_channel_id_youtube_channels_id_fk"
      FOREIGN KEY ("channel_id") REFERENCES "youtube_channels"("id") ON DELETE SET NULL;
  END IF;
END $$;
