CREATE TABLE "seed_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "url" text,
  "title" text NOT NULL,
  "notes" text,
  "status" text DEFAULT 'new' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "seed_sources_type_check" CHECK ("type" IN ('youtube_video', 'youtube_channel', 'manual')),
  CONSTRAINT "seed_sources_status_check" CHECK ("status" IN ('new', 'processed')),
  CONSTRAINT "seed_sources_url_check" CHECK (("type" = 'manual' AND "url" IS NULL) OR ("type" <> 'manual' AND "url" IS NOT NULL))
);

CREATE TABLE "niche_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seed_source_id" uuid NOT NULL REFERENCES "seed_sources"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'candidate' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "niche_candidates_status_check" CHECK ("status" IN ('candidate', 'approved', 'rejected'))
);

CREATE INDEX "niche_candidates_seed_source_id_idx" ON "niche_candidates" ("seed_source_id");
CREATE UNIQUE INDEX "niche_candidates_source_name_unique" ON "niche_candidates" ("seed_source_id", lower("name"));

ALTER TABLE "seed_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "niche_candidates" ENABLE ROW LEVEL SECURITY;
