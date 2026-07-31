WITH mapped AS (
  SELECT
    mapping.project_id,
    mapping.business_area_id,
    area.key,
    area.name,
    area.is_restricted,
    area.owner_person_id
  FROM public.business_area_project_map AS mapping
  JOIN public.business_areas AS area
    ON area.id = mapping.business_area_id
),
table_counts AS (
  SELECT
    'document_metadata'::text AS record_type,
    mapped.project_id,
    mapped.business_area_id,
    count(*) FILTER (
      WHERE record.project_id = mapped.project_id
    ) AS legacy_project_rows,
    count(*) FILTER (
      WHERE record.business_area_id = mapped.business_area_id
    ) AS business_area_rows,
    count(*) FILTER (
      WHERE record.project_id = mapped.project_id
        AND record.business_area_id = mapped.business_area_id
    ) AS dual_scoped_rows,
    count(*) FILTER (
      WHERE record.project_id IS NULL
        AND record.business_area_id = mapped.business_area_id
    ) AS brain_only_rows,
    max(record.created_at) FILTER (
      WHERE record.project_id = mapped.project_id
    ) AS newest_legacy_write
  FROM mapped
  LEFT JOIN public.document_metadata AS record
    ON record.project_id = mapped.project_id
    OR record.business_area_id = mapped.business_area_id
  GROUP BY mapped.project_id, mapped.business_area_id

  UNION ALL

  SELECT
    'meetings',
    mapped.project_id,
    mapped.business_area_id,
    count(*) FILTER (WHERE record.project_id = mapped.project_id),
    count(*) FILTER (WHERE record.business_area_id = mapped.business_area_id),
    count(*) FILTER (
      WHERE record.project_id = mapped.project_id
        AND record.business_area_id = mapped.business_area_id
    ),
    count(*) FILTER (
      WHERE record.project_id IS NULL
        AND record.business_area_id = mapped.business_area_id
    ),
    max(record.created_at) FILTER (
      WHERE record.project_id = mapped.project_id
    )
  FROM mapped
  LEFT JOIN public.meetings AS record
    ON record.project_id = mapped.project_id
    OR record.business_area_id = mapped.business_area_id
  GROUP BY mapped.project_id, mapped.business_area_id

  UNION ALL

  SELECT
    'tasks',
    mapped.project_id,
    mapped.business_area_id,
    count(*) FILTER (WHERE record.project_id = mapped.project_id),
    count(*) FILTER (WHERE record.business_area_id = mapped.business_area_id),
    count(*) FILTER (
      WHERE record.project_id = mapped.project_id
        AND record.business_area_id = mapped.business_area_id
    ),
    count(*) FILTER (
      WHERE record.project_id IS NULL
        AND record.business_area_id = mapped.business_area_id
    ),
    max(record.created_at) FILTER (
      WHERE record.project_id = mapped.project_id
    )
  FROM mapped
  LEFT JOIN public.tasks AS record
    ON record.project_id = mapped.project_id
    OR record.business_area_id = mapped.business_area_id
  GROUP BY mapped.project_id, mapped.business_area_id

  UNION ALL

  SELECT
    'files',
    mapped.project_id,
    mapped.business_area_id,
    count(*) FILTER (WHERE record.project_id = mapped.project_id),
    count(*) FILTER (WHERE record.business_area_id = mapped.business_area_id),
    count(*) FILTER (
      WHERE record.project_id = mapped.project_id
        AND record.business_area_id = mapped.business_area_id
    ),
    count(*) FILTER (
      WHERE record.project_id IS NULL
        AND record.business_area_id = mapped.business_area_id
    ),
    max(record.created_at) FILTER (
      WHERE record.project_id = mapped.project_id
    )
  FROM mapped
  LEFT JOIN public.files AS record
    ON record.project_id = mapped.project_id
    OR record.business_area_id = mapped.business_area_id
  GROUP BY mapped.project_id, mapped.business_area_id
),
rules_by_target AS (
  SELECT
    project_id,
    business_area_id,
    status,
    count(*) AS rule_count
  FROM public.project_attribution_rules
  WHERE project_id IN (60, 89, 90, 756, 767)
    OR business_area_id IN (SELECT business_area_id FROM mapped)
  GROUP BY project_id, business_area_id, status
  ORDER BY project_id NULLS LAST, business_area_id NULLS LAST, status
)
SELECT jsonb_build_object(
  'checked_at',
  now(),
  'areas',
  (
    SELECT jsonb_agg(to_jsonb(mapped) ORDER BY mapped.business_area_id)
    FROM mapped
  ),
  'memberships',
  (
    SELECT coalesce(
      jsonb_agg(to_jsonb(membership) ORDER BY membership.business_area_id, membership.person_id),
      '[]'::jsonb
    )
    FROM (
      SELECT business_area_id, person_id, role, status
      FROM public.business_area_memberships
    ) AS membership
  ),
  'projects',
  (
    SELECT jsonb_agg(to_jsonb(project) ORDER BY project.id)
    FROM (
      SELECT id, name, phase, archived, archived_at
      FROM public.projects
      WHERE id IN (60, 89, 90, 756, 767)
    ) AS project
  ),
  'scope_counts',
  (
    SELECT jsonb_agg(
      to_jsonb(table_counts)
      ORDER BY table_counts.record_type, table_counts.project_id
    )
    FROM table_counts
  ),
  'rules',
  jsonb_build_object(
    'active_project_targets',
    (
      SELECT count(*)
      FROM public.project_attribution_rules
      WHERE status = 'active'
        AND project_id IN (60, 89, 90, 756, 767)
    ),
    'active_business_area_targets',
    (
      SELECT count(*)
      FROM public.project_attribution_rules
      WHERE status = 'active'
        AND business_area_id IN (SELECT business_area_id FROM mapped)
    ),
    'invalid_active_targets',
    (
      SELECT count(*)
      FROM public.project_attribution_rules
      WHERE status = 'active'
        AND ((project_id IS NULL) = (business_area_id IS NULL))
    ),
    'by_target',
    (
      SELECT coalesce(jsonb_agg(to_jsonb(rules_by_target)), '[]'::jsonb)
      FROM rules_by_target
    )
  ),
  'task_statuses',
  (
    SELECT coalesce(
      jsonb_agg(
        to_jsonb(task_status)
        ORDER BY task_status.project_id, task_status.business_area_id, task_status.status
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT
        project_id,
        business_area_id,
        coalesce(status, '<null>') AS status,
        count(*) AS count
      FROM public.tasks
      WHERE project_id IN (60, 89, 90, 756, 767)
        OR business_area_id IN (SELECT business_area_id FROM mapped)
      GROUP BY project_id, business_area_id, status
    ) AS task_status
  ),
  'constraints',
  (
    SELECT coalesce(
      jsonb_agg(
        to_jsonb(scope_constraint)
        ORDER BY scope_constraint.table_name, scope_constraint.constraint_name
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT
        conrelid::regclass::text AS table_name,
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS definition,
        convalidated
      FROM pg_constraint
      WHERE conrelid IN (
        'public.document_metadata'::regclass,
        'public.meetings'::regclass,
        'public.tasks'::regclass,
        'public.files'::regclass,
        'public.project_attribution_rules'::regclass
      )
        AND (
          pg_get_constraintdef(oid) ILIKE '%business_area%'
          OR conname ILIKE '%scope%'
          OR conname ILIKE '%target%'
        )
    ) AS scope_constraint
  )
) AS baseline;
