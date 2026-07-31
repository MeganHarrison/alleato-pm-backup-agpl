select jsonb_build_object(
  'temporary_task_count', (
    select count(*)
    from public.schedule_tasks task
    where task.project_id = 67
      and task.name = 'E2E-P4B Project Capacity Task'
  ),
  'temporary_exception_count', (
    select count(*)
    from public.schedule_resource_capacity_exceptions capacity_exception
    where capacity_exception.project_id = 67
      and capacity_exception.reason = 'E2E project exception'
  ),
  'temporary_snapshot_count', (
    select count(*)
    from public.schedule_revision_resource_capacity_snapshots capacity_snapshot
    join public.schedule_revisions revision on revision.id = capacity_snapshot.revision_id
    where revision.project_id = 67
      and capacity_snapshot.dated_exceptions @> '[{"reason":"E2E project exception"}]'::jsonb
  )
) as phase4b_e2e_cleanup;
