-- Fail migration application if the project creation ledger ever omits a
-- current project or hides a known historical attribution gap.

begin;

do $$
declare
  missing_current_projects text;
  mislabeled_legacy_projects text;
begin
  select string_agg(project_id::text, ', ' order by project_id)
  into missing_current_projects
  from (
    select project.id as project_id
    from public.projects as project
    where not exists (
      select 1
      from public.project_creation_audit_log as creation_event
      where creation_event.project_id = project.id
        and creation_event.project_exists = true
    )
    order by project.id
    limit 10
  ) as missing;

  if missing_current_projects is not null then
    raise exception using
      errcode = '23514',
      message = 'Project creation ledger is missing current projects',
      detail = 'Missing project IDs: ' || missing_current_projects,
      hint = 'Restore the current-project branch of public.project_creation_audit_log before applying this migration.';
  end if;

  select string_agg(project_id::text, ', ' order by project_id)
  into mislabeled_legacy_projects
  from (
    select project.id as project_id
    from public.projects as project
    where project.created_via = 'legacy_unknown'
      and not exists (
        select 1
        from public.project_creation_audit_log as creation_event
        where creation_event.project_id = project.id
          and creation_event.project_exists = true
          and creation_event.attribution_status = 'legacy_gap'
      )
    order by project.id
    limit 10
  ) as mislabeled;

  if mislabeled_legacy_projects is not null then
    raise exception using
      errcode = '23514',
      message = 'Project creation ledger hides historical attribution gaps',
      detail = 'Mislabeled project IDs: ' || mislabeled_legacy_projects,
      hint = 'Legacy projects must remain visible with attribution_status=legacy_gap.';
  end if;
end
$$;

commit;
