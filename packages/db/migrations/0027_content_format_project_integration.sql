-- Content formats are archived, not deleted, so project provenance is durable.
ALTER TABLE "generation_pipeline"."generation_projects"
  ADD COLUMN IF NOT EXISTS "content_format_id" uuid;

ALTER TABLE "generation_pipeline"."generation_projects"
  ADD CONSTRAINT "generation_projects_content_format_id_content_formats_id_fk"
  FOREIGN KEY ("content_format_id") REFERENCES "content_formats"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "generation_projects_content_format_id_idx"
  ON "generation_pipeline"."generation_projects" ("content_format_id");
