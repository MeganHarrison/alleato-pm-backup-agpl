-- Read-only cutover gate for Alleato Brain.
--
-- A final project-container retirement is allowed only after:
--   1. every Brain branch has an approved owner;
--   2. Finance has at least one explicit active member;
--   3. the parallel run has been observed for 14 days; and
--   4. no legacy-only writes have appeared for 7 consecutive days.

WITH migration AS (
  SELECT completed_at
  FROM public.business_area_migration_runs
  WHERE run_key = 'all-11-parallel-scope-20260729'
    AND status = 'completed'
),
mapped AS (
  SELECT project_id, business_area_id
  FROM public.business_area_project_map
),
legacy_only_writes AS (
  SELECT 'document'::text AS record_type, record.id::text AS record_id, record.created_at
  FROM public.document_metadata AS record
  JOIN mapped ON mapped.project_id = record.project_id
  CROSS JOIN migration
  WHERE record.business_area_id IS NULL
    AND record.created_at >= migration.completed_at

  UNION ALL

  SELECT 'meeting', record.id::text, record.created_at
  FROM public.meetings AS record
  JOIN mapped ON mapped.project_id = record.project_id
  CROSS JOIN migration
  WHERE record.business_area_id IS NULL
    AND record.created_at >= migration.completed_at

  UNION ALL

  SELECT 'task', record.id::text, record.created_at
  FROM public.tasks AS record
  JOIN mapped ON mapped.project_id = record.project_id
  CROSS JOIN migration
  WHERE record.business_area_id IS NULL
    AND record.created_at >= migration.completed_at

  UNION ALL

  SELECT 'file', record.id::text, record.created_at
  FROM public.files AS record
  JOIN mapped ON mapped.project_id = record.project_id
  CROSS JOIN migration
  WHERE record.business_area_id IS NULL
    AND record.created_at >= migration.completed_at
),
gates AS (
  SELECT
    (SELECT completed_at FROM migration) AS parallel_run_completed_at,
    (
      SELECT count(*)
      FROM public.business_areas
      WHERE owner_person_id IS NULL
    ) AS branches_missing_owner,
    (
      SELECT count(*)
      FROM public.business_area_memberships AS membership
      JOIN public.business_areas AS area
        ON area.id = membership.business_area_id
      WHERE area.key = 'finance'
        AND membership.status = 'active'
    ) AS active_finance_members,
    (SELECT count(*) FROM legacy_only_writes) AS legacy_only_write_count,
    (SELECT max(created_at) FROM legacy_only_writes) AS latest_legacy_only_write
)
SELECT jsonb_build_object(
  'checked_at', now(),
  'parallel_run_completed_at', parallel_run_completed_at,
  'parallel_run_age_days',
    floor(extract(epoch FROM (now() - parallel_run_completed_at)) / 86400),
  'branches_missing_owner', branches_missing_owner,
  'active_finance_members', active_finance_members,
  'legacy_only_write_count', legacy_only_write_count,
  'latest_legacy_only_write', latest_legacy_only_write,
  'days_since_latest_legacy_only_write',
    CASE
      WHEN latest_legacy_only_write IS NULL
        THEN floor(extract(epoch FROM (now() - parallel_run_completed_at)) / 86400)
      ELSE floor(extract(epoch FROM (now() - latest_legacy_only_write)) / 86400)
    END,
  'cutover_ready',
    branches_missing_owner = 0
    AND active_finance_members > 0
    AND now() >= parallel_run_completed_at + interval '14 days'
    AND (
      latest_legacy_only_write IS NULL
      OR now() >= latest_legacy_only_write + interval '7 days'
    )
) AS cutover_readiness
FROM gates;
