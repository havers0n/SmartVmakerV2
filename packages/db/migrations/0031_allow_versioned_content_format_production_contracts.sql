-- Keep legacy rule arrays while allowing the versioned v1 production contract.
ALTER TABLE "content_formats"
  DROP CONSTRAINT IF EXISTS "content_formats_production_rules_array_check";

ALTER TABLE "content_formats"
  ADD CONSTRAINT "content_formats_production_rules_contract_v1_check"
  CHECK ((
    jsonb_typeof("production_rules") = 'array'
    OR (
      jsonb_typeof("production_rules") = 'object'
      AND jsonb_typeof("production_rules" -> 'version') = 'number'
      AND "production_rules" ->> 'version' = '1'
    )
  ) IS TRUE);
