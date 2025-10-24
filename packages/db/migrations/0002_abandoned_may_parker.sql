ALTER TABLE "hwar_scenarios" ALTER COLUMN "tags" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "hwar_scenarios" ADD CONSTRAINT "hwar_scenarios_duration_check" CHECK ("duration_sec" BETWEEN 5 AND 300);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hwar_harvests_created_at_idx" ON "hwar_harvests" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hwar_scenarios_created_at_idx" ON "hwar_scenarios" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hwar_scenarios_topic_idx" ON "hwar_scenarios" ("topic");