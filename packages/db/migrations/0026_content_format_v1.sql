CREATE TABLE "content_formats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL, "slug" text NOT NULL UNIQUE, "description" text,
  "status" text NOT NULL DEFAULT 'draft', "format_type" text NOT NULL DEFAULT 'mixed',
  "hook_pattern" text, "structure_pattern" text, "visual_pattern" text, "pacing_pattern" text,
  "target_duration_min_seconds" integer, "target_duration_max_seconds" integer, "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "content_formats_status_check" CHECK ("status" IN ('draft','active','archived')),
  CONSTRAINT "content_formats_type_check" CHECK ("format_type" IN ('long_form','short_form','mixed')),
  CONSTRAINT "content_formats_duration_check" CHECK (("target_duration_min_seconds" IS NULL OR "target_duration_min_seconds" >= 0) AND ("target_duration_max_seconds" IS NULL OR "target_duration_max_seconds" >= 0) AND ("target_duration_min_seconds" IS NULL OR "target_duration_max_seconds" IS NULL OR "target_duration_min_seconds" <= "target_duration_max_seconds"))
);
CREATE TABLE "content_format_videos" (
  "content_format_id" uuid NOT NULL REFERENCES "content_formats"("id") ON DELETE CASCADE, "video_id" uuid NOT NULL REFERENCES "youtube_videos"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'supporting', "source" text NOT NULL DEFAULT 'manual', "confidence" numeric(3,2), "note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "content_format_videos_pk" PRIMARY KEY ("content_format_id","video_id"),
  CONSTRAINT "content_format_videos_role_check" CHECK ("role" IN ('exemplar','supporting','counterexample')),
  CONSTRAINT "content_format_videos_source_check" CHECK ("source" IN ('manual','discovery','transcript','ai','import')),
  CONSTRAINT "content_format_videos_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);
CREATE TABLE "content_format_channels" (
  "content_format_id" uuid NOT NULL REFERENCES "content_formats"("id") ON DELETE CASCADE, "channel_id" uuid NOT NULL REFERENCES "youtube_channels"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'occasional', "source" text NOT NULL DEFAULT 'manual', "confidence" numeric(3,2), "note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "content_format_channels_pk" PRIMARY KEY ("content_format_id","channel_id"),
  CONSTRAINT "content_format_channels_role_check" CHECK ("role" IN ('primary','frequent','occasional','reference')),
  CONSTRAINT "content_format_channels_source_check" CHECK ("source" IN ('manual','discovery','transcript','ai','import')),
  CONSTRAINT "content_format_channels_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);
CREATE TABLE "content_format_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "content_format_id" uuid NOT NULL REFERENCES "content_formats"("id") ON DELETE CASCADE,
  "video_id" uuid REFERENCES "youtube_videos"("id") ON DELETE SET NULL, "channel_id" uuid REFERENCES "youtube_channels"("id") ON DELETE SET NULL,
  "evidence_type" text NOT NULL, "statement" text NOT NULL, "source" text NOT NULL DEFAULT 'manual', "confidence" numeric(3,2), "provenance" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "content_format_evidence_type_check" CHECK ("evidence_type" IN ('title_pattern','thumbnail_pattern','hook','structure','visual_style','pacing','audience_promise','topic_independence','performance','other')),
  CONSTRAINT "content_format_evidence_source_check" CHECK ("source" IN ('manual','metadata','discovery','transcript','ai')),
  CONSTRAINT "content_format_evidence_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  CONSTRAINT "content_format_evidence_statement_check" CHECK (length(trim("statement")) > 0)
);
CREATE INDEX "content_formats_status_idx" ON "content_formats" ("status"); CREATE INDEX "content_formats_updated_at_idx" ON "content_formats" ("updated_at");
CREATE INDEX "content_format_videos_format_idx" ON "content_format_videos" ("content_format_id"); CREATE INDEX "content_format_videos_video_idx" ON "content_format_videos" ("video_id");
CREATE INDEX "content_format_channels_format_idx" ON "content_format_channels" ("content_format_id"); CREATE INDEX "content_format_channels_channel_idx" ON "content_format_channels" ("channel_id");
CREATE INDEX "content_format_evidence_format_idx" ON "content_format_evidence" ("content_format_id"); CREATE INDEX "content_format_evidence_video_idx" ON "content_format_evidence" ("video_id"); CREATE INDEX "content_format_evidence_channel_idx" ON "content_format_evidence" ("channel_id");
