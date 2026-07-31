-- ALL-11 parallel-run data migration.
-- Reversible: every changed PM App row is recorded before mutation.

BEGIN;

INSERT INTO public.business_area_migration_runs (
  run_key,
  phase,
  status,
  source_snapshot,
  rollback_status
)
SELECT
  'all-11-parallel-scope-20260729',
  'parallel_scope',
  'running',
  jsonb_build_object(
    'captured_at', now(),
    'active_legacy_rules', (
      SELECT count(*)
      FROM public.project_attribution_rules
      WHERE status = 'active'
        AND project_id IN (60, 89, 90, 756, 767)
    ),
    'legacy_documents', (
      SELECT count(*)
      FROM public.document_metadata
      WHERE project_id IN (60, 89, 90, 756, 767)
    ),
    'legacy_meetings', (
      SELECT count(*)
      FROM public.meetings
      WHERE project_id IN (60, 89, 90, 756, 767)
    ),
    'legacy_tasks', (
      SELECT count(*)
      FROM public.tasks
      WHERE project_id IN (60, 89, 90, 756, 767)
    ),
    'legacy_files', (
      SELECT count(*)
      FROM public.files
      WHERE project_id IN (60, 89, 90, 756, 767)
    )
  ),
  'available'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.business_area_migration_runs
  WHERE run_key = 'all-11-parallel-scope-20260729'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.business_area_migration_runs
    WHERE run_key = 'all-11-parallel-scope-20260729'
      AND status NOT IN ('running', 'completed')
  ) THEN
    RAISE EXCEPTION 'ALL_11_RUN_NOT_APPLICABLE';
  END IF;
END
$$;

WITH migration_run AS (
  SELECT id
  FROM public.business_area_migration_runs
  WHERE run_key = 'all-11-parallel-scope-20260729'
),
mapped_rules AS (
  SELECT rule.*, mapping.business_area_id AS target_business_area_id
  FROM public.project_attribution_rules AS rule
  JOIN public.business_area_project_map AS mapping
    ON mapping.project_id = rule.project_id
  WHERE rule.status = 'active'
)
INSERT INTO public.business_area_migration_items (
  run_id,
  source_database,
  record_type,
  record_id,
  old_project_id,
  old_business_area_id,
  new_business_area_id,
  record_snapshot,
  result,
  rollback_state,
  applied_at
)
SELECT
  migration_run.id,
  'pm_app',
  'attribution_rule',
  mapped_rules.id::text,
  mapped_rules.project_id,
  NULL,
  mapped_rules.target_business_area_id,
  to_jsonb(mapped_rules),
  'pending',
  'available',
  NULL
FROM mapped_rules
CROSS JOIN migration_run
ON CONFLICT DO NOTHING;

WITH mapped_rules AS (
  SELECT rule.*, mapping.business_area_id AS target_business_area_id
  FROM public.project_attribution_rules AS rule
  JOIN public.business_area_project_map AS mapping
    ON mapping.project_id = rule.project_id
  WHERE rule.status = 'active'
)
INSERT INTO public.project_attribution_rules (
  business_area_id,
  project_id,
  rule_type,
  pattern,
  pattern_normalized,
  confidence,
  priority,
  source,
  notes,
  status,
  created_at,
  updated_at
)
SELECT
  target_business_area_id,
  NULL,
  rule_type,
  pattern,
  pattern_normalized,
  confidence,
  priority,
  'alleato_brain_all_11',
  concat_ws(
    E'\n',
    notes,
    'Cloned from mapped container-project rule ' || id::text
  ),
  'active',
  now(),
  now()
FROM mapped_rules
ON CONFLICT (
  business_area_id,
  rule_type,
  pattern_normalized
) WHERE business_area_id IS NOT NULL
DO UPDATE SET
  pattern = EXCLUDED.pattern,
  confidence = EXCLUDED.confidence,
  priority = EXCLUDED.priority,
  source = EXCLUDED.source,
  notes = EXCLUDED.notes,
  status = 'active',
  updated_at = now();

UPDATE public.project_attribution_rules
SET
  status = 'inactive',
  notes = concat_ws(
    E'\n',
    notes,
    'Retired by ALL-11 after typed Business Area clone.'
  ),
  updated_at = now()
WHERE status = 'active'
  AND project_id IN (60, 89, 90, 756, 767);

WITH migration_run AS (
  SELECT id
  FROM public.business_area_migration_runs
  WHERE run_key = 'all-11-parallel-scope-20260729'
),
finance_candidates AS (
  SELECT document.*, area.id AS target_business_area_id
  FROM public.document_metadata AS document
  JOIN public.business_areas AS area
    ON area.key = 'finance'
  WHERE document.business_area_id = area.id
    AND document.access_level IS DISTINCT FROM 'restricted'
)
INSERT INTO public.business_area_migration_items (
  run_id,
  source_database,
  record_type,
  record_id,
  old_project_id,
  old_business_area_id,
  new_business_area_id,
  record_snapshot,
  result,
  rollback_state
)
SELECT
  migration_run.id,
  'pm_app',
  'document',
  finance_candidates.id::text,
  finance_candidates.project_id,
  finance_candidates.business_area_id,
  finance_candidates.target_business_area_id,
  to_jsonb(finance_candidates) - 'target_business_area_id',
  'pending',
  'available'
FROM finance_candidates
CROSS JOIN migration_run
ON CONFLICT DO NOTHING;

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
        WITH migration_run AS (
          SELECT id
          FROM public.business_area_migration_runs
          WHERE run_key = 'all-11-parallel-scope-20260729'
        ),
        candidates AS (
          SELECT record.*, mapping.business_area_id AS target_business_area_id
          FROM public.%I AS record
          JOIN public.business_area_project_map AS mapping
            ON mapping.project_id = record.project_id
          WHERE record.business_area_id IS DISTINCT FROM mapping.business_area_id
        )
        INSERT INTO public.business_area_migration_items (
          run_id,
          source_database,
          record_type,
          record_id,
          old_project_id,
          old_business_area_id,
          new_business_area_id,
          record_snapshot,
          result,
          rollback_state
        )
        SELECT
          migration_run.id,
          'pm_app',
          %L,
          candidates.id::text,
          candidates.project_id,
          candidates.business_area_id,
          candidates.target_business_area_id,
          to_jsonb(candidates) - 'target_business_area_id',
          'pending',
          'available'
        FROM candidates
        CROSS JOIN migration_run
        ON CONFLICT DO NOTHING
      $sql$,
      table_name,
      record_type
    );

    EXECUTE format(
      $sql$
        UPDATE public.%I AS record
        SET business_area_id = mapping.business_area_id
        FROM public.business_area_project_map AS mapping
        WHERE record.project_id = mapping.project_id
          AND record.business_area_id IS DISTINCT FROM mapping.business_area_id
      $sql$,
      table_name
    );
  END LOOP;
END
$$;

UPDATE public.document_metadata AS document
SET access_level = 'restricted'
FROM public.business_areas AS area
WHERE area.key = 'finance'
  AND document.business_area_id = area.id
  AND document.access_level IS DISTINCT FROM 'restricted';

WITH migration_run AS (
  SELECT id
  FROM public.business_area_migration_runs
  WHERE run_key = 'all-11-parallel-scope-20260729'
)
UPDATE public.business_area_migration_items AS item
SET
  result = 'applied',
  applied_at = now(),
  updated_at = now()
FROM migration_run
WHERE item.run_id = migration_run.id
  AND item.result = 'pending';

UPDATE public.business_area_migration_runs
SET
  status = 'completed',
  completed_at = now(),
  result_summary = jsonb_build_object(
    'active_business_area_rules', (
      SELECT count(*)
      FROM public.project_attribution_rules
      WHERE status = 'active'
        AND business_area_id IN (
          SELECT business_area_id
          FROM public.business_area_project_map
        )
    ),
    'retired_project_rules', (
      SELECT count(*)
      FROM public.project_attribution_rules
      WHERE status = 'inactive'
        AND project_id IN (60, 89, 90, 756, 767)
    ),
    'ledger_items', (
      SELECT count(*)
      FROM public.business_area_migration_items AS item
      WHERE item.run_id = public.business_area_migration_runs.id
    )
  ),
  updated_at = now()
WHERE run_key = 'all-11-parallel-scope-20260729';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.project_attribution_rules
    WHERE status = 'active'
      AND project_id IN (60, 89, 90, 756, 767)
  ) THEN
    RAISE EXCEPTION 'ALL_11_ACTIVE_LEGACY_RULES_REMAIN';
  END IF;

  IF (
    SELECT count(*)
    FROM public.project_attribution_rules
    WHERE status = 'active'
      AND business_area_id IN (
        SELECT business_area_id
        FROM public.business_area_project_map
      )
  ) < 50 THEN
    RAISE EXCEPTION 'ALL_11_BUSINESS_AREA_RULE_CLONE_INCOMPLETE';
  END IF;
END
$$;

COMMIT;
