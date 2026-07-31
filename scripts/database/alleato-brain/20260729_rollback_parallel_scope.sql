BEGIN;

DO $$
DECLARE
  table_name text;
  record_type text;
BEGIN
  FOR table_name, record_type IN
    VALUES
      ('document_metadata', 'document'),
      ('meetings', 'meeting'),
      ('tasks', 'task'),
      ('files', 'file')
  LOOP
    EXECUTE format(
      $sql$
        UPDATE public.%I AS record
        SET
          project_id = (item.record_snapshot->>'project_id')::bigint,
          business_area_id = (item.record_snapshot->>'business_area_id')::bigint%s
        FROM public.business_area_migration_items AS item
        JOIN public.business_area_migration_runs AS run
          ON run.id = item.run_id
        WHERE run.run_key = 'all-11-parallel-scope-20260729'
          AND item.source_database = 'pm_app'
          AND item.record_type = %L
          AND record.id::text = item.record_id
      $sql$,
      table_name,
      CASE
        WHEN table_name = 'document_metadata'
          THEN ', access_level = item.record_snapshot->>''access_level'''
        ELSE ''
      END,
      record_type
    );
  END LOOP;
END
$$;

DELETE FROM public.project_attribution_rules
WHERE source = 'alleato_brain_all_11'
  AND business_area_id IN (
    SELECT business_area_id
    FROM public.business_area_project_map
  );

UPDATE public.project_attribution_rules AS rule
SET
  status = item.record_snapshot->>'status',
  notes = item.record_snapshot->>'notes',
  updated_at = now()
FROM public.business_area_migration_items AS item
JOIN public.business_area_migration_runs AS run
  ON run.id = item.run_id
WHERE run.run_key = 'all-11-parallel-scope-20260729'
  AND item.record_type = 'attribution_rule'
  AND rule.id::text = item.record_id;

UPDATE public.business_area_migration_items AS item
SET
  result = 'rolled_back',
  rollback_state = 'completed',
  rolled_back_at = now(),
  updated_at = now()
FROM public.business_area_migration_runs AS run
WHERE run.id = item.run_id
  AND run.run_key = 'all-11-parallel-scope-20260729';

UPDATE public.business_area_migration_runs
SET
  status = 'rolled_back',
  rollback_status = 'completed',
  updated_at = now()
WHERE run_key = 'all-11-parallel-scope-20260729';

COMMIT;
