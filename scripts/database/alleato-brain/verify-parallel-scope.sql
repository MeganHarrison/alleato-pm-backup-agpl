WITH mapped AS (
  SELECT project_id, business_area_id
  FROM public.business_area_project_map
),
violations AS (
  SELECT 'document' AS record_type, count(*) AS count
  FROM public.document_metadata AS record
  JOIN mapped ON mapped.project_id = record.project_id
  WHERE record.business_area_id IS DISTINCT FROM mapped.business_area_id
  UNION ALL
  SELECT 'meeting', count(*)
  FROM public.meetings AS record
  JOIN mapped ON mapped.project_id = record.project_id
  WHERE record.business_area_id IS DISTINCT FROM mapped.business_area_id
  UNION ALL
  SELECT 'task', count(*)
  FROM public.tasks AS record
  JOIN mapped ON mapped.project_id = record.project_id
  WHERE record.business_area_id IS DISTINCT FROM mapped.business_area_id
  UNION ALL
  SELECT 'file', count(*)
  FROM public.files AS record
  JOIN mapped ON mapped.project_id = record.project_id
  WHERE record.business_area_id IS DISTINCT FROM mapped.business_area_id
)
SELECT jsonb_build_object(
  'checked_at', now(),
  'active_legacy_rules', (
    SELECT count(*)
    FROM public.project_attribution_rules
    WHERE status = 'active'
      AND project_id IN (SELECT project_id FROM mapped)
  ),
  'active_business_area_rules', (
    SELECT count(*)
    FROM public.project_attribution_rules
    WHERE status = 'active'
      AND business_area_id IN (SELECT business_area_id FROM mapped)
  ),
  'scope_violations', (
    SELECT jsonb_agg(to_jsonb(violations) ORDER BY record_type)
    FROM violations
  ),
  'finance_unrestricted_documents', (
    SELECT count(*)
    FROM public.document_metadata AS document
    JOIN public.business_areas AS area
      ON area.id = document.business_area_id
    WHERE area.key = 'finance'
      AND document.access_level IS DISTINCT FROM 'restricted'
  ),
  'migration_run', (
    SELECT to_jsonb(run)
    FROM public.business_area_migration_runs AS run
    WHERE run_key = 'all-11-parallel-scope-20260729'
  )
) AS verification;
