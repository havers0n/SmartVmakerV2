CREATE TABLE IF NOT EXISTS "niches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"max_channel_age_months" integer DEFAULT 24 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "niches_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "niche_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche_id" uuid NOT NULL REFERENCES "niches"("id") ON DELETE CASCADE,
	"query" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "niche_queries_niche_query_unique" UNIQUE("niche_id", "query")
);

CREATE INDEX IF NOT EXISTS "niche_queries_niche_id_idx" ON "niche_queries" ("niche_id");

INSERT INTO "niches" ("name", "slug", "language", "max_channel_age_months")
VALUES ('BeamNG.drive', 'beamng-drive', 'en', 24)
ON CONFLICT ("slug") DO UPDATE SET
	"name" = EXCLUDED."name",
	"language" = EXCLUDED."language",
	"max_channel_age_months" = EXCLUDED."max_channel_age_months",
	"updated_at" = now();

INSERT INTO "niche_queries" ("niche_id", "query")
SELECT "id", query
FROM "niches"
CROSS JOIN (VALUES
	('BeamNG.drive'),
	('BeamNG crashes'),
	('BeamNG police chase'),
	('BeamNG realistic crashes'),
	('BeamNG shorts')
) AS defaults(query)
WHERE "slug" = 'beamng-drive'
ON CONFLICT ("niche_id", "query") DO NOTHING;
