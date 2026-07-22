BEGIN;

DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE generation_pipeline.generation_projects
  SET
    status = 'failed',
    stage = 'scenario_generation_failed',
    error_message = 'Stored scenario payload is corrupted',
    meta = (meta - 'scenarios') || jsonb_build_object(
      'scenarioGenerationFailure',
      jsonb_build_object(
        'code', 'SCENARIO_PAYLOAD_CORRUPTED',
        'detectedAt', now(),
        'rawPayload', meta->'scenarios',
        'rawPayloadLength', length(meta->>'scenarios')
      )
    ),
    updated_at = now()
  WHERE id = '1af3bf84-d5cc-48d7-a02a-0bb4083ab7c2'
    AND jsonb_typeof(meta->'scenarios') = 'string';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'beamngtest1 was not updated: project missing or scenarios is no longer a string';
  END IF;
END $$;

COMMIT;
