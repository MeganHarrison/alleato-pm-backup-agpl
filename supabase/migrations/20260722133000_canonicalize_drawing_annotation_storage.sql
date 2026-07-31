-- Drawing annotations are now exclusively page-percent JSON payloads. Do not
-- coerce or delete unexpected historic payloads: fail the migration so those
-- rows can be reconciled with their original coordinate system first.
BEGIN;

LOCK TABLE drawing_annotations IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM drawing_annotations
    WHERE data IS NULL
      OR jsonb_typeof(data) <> 'object'
      OR NOT (data @> '{"page_percent": true}'::jsonb)
      OR data ? 'viewport_percent'
      OR storage_format <> 'legacy_image'
      OR annotation_id IS NOT NULL
      OR xfdf IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'drawing_annotations contains noncanonical payloads; reconcile them before removing retired storage fields';
  END IF;
END
$$;

ALTER TABLE drawing_annotations
  DROP CONSTRAINT IF EXISTS drawing_annotations_storage_format_check,
  DROP CONSTRAINT IF EXISTS drawing_annotations_payload_check;

DROP INDEX IF EXISTS drawing_annotations_xfdf_id_key;

ALTER TABLE drawing_annotations
  ALTER COLUMN data SET NOT NULL,
  DROP COLUMN storage_format,
  DROP COLUMN annotation_id,
  DROP COLUMN xfdf,
  ADD CONSTRAINT drawing_annotations_page_percent_payload_check
    CHECK (
      jsonb_typeof(data) = 'object'
      AND data @> '{"page_percent": true}'::jsonb
    );

COMMIT;
