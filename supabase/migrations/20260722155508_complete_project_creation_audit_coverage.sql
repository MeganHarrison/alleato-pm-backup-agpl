-- Ensure the creation log covers every current project, including projects
-- that predate the generic db_audit_log trigger. Missing historical evidence
-- remains an explicit legacy gap.

begin;

create or replace view public.project_creation_audit_log
with (security_invoker = true)
as
with earliest_insert as (
  select distinct on (record_id)
    id,
    record_id,
    changed_by,
    changed_at,
    new_data
  from public.db_audit_log
  where table_name = 'projects'
    and operation = 'INSERT'
  order by record_id, changed_at asc, id asc
), current_projects as (
  select
    coalesce(audit.id, md5('project:' || project.id::text)::uuid) as id,
    project.id::bigint as project_id,
    project.name as project_name,
    coalesce(project.project_number, project."job number") as project_number,
    project.created_by,
    project.created_via,
    project.creation_request_id,
    project.creation_run_id,
    coalesce(audit.changed_at, project.created_at) as created_at,
    case
      when project.created_via <> 'legacy_unknown'
        and coalesce(project.creation_request_id, project.creation_run_id) is not null
        then 'complete'
      else 'legacy_gap'
    end as attribution_status,
    true as project_exists
  from public.projects as project
  left join earliest_insert as audit
    on audit.record_id = project.id::text
), deleted_projects as (
  select
    audit.id,
    case
      when audit.record_id ~ '^[0-9]{1,18}$' then audit.record_id::bigint
      else null
    end as project_id,
    audit.new_data ->> 'name' as project_name,
    coalesce(
      audit.new_data ->> 'project_number',
      audit.new_data ->> 'job number'
    ) as project_number,
    case
      when audit.new_data ->> 'created_by' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (audit.new_data ->> 'created_by')::uuid
      else audit.changed_by
    end as created_by,
    coalesce(
      nullif(audit.new_data ->> 'created_via', ''),
      case
        when coalesce(audit.new_data ->> 'erp_system', '') = 'acumatica'
          or nullif(audit.new_data ->> 'acumatica_project_id', '') is not null
          then 'acumatica_sync'
        when audit.changed_by is not null then 'api'
        else 'legacy_unknown'
      end
    ) as created_via,
    nullif(audit.new_data ->> 'creation_request_id', '') as creation_request_id,
    coalesce(
      nullif(audit.new_data ->> 'creation_run_id', ''),
      'legacy-audit:' || audit.id::text
    ) as creation_run_id,
    audit.changed_at as created_at,
    case
      when coalesce(audit.new_data ->> 'created_via', 'legacy_unknown') <> 'legacy_unknown'
        and coalesce(
          nullif(audit.new_data ->> 'creation_request_id', ''),
          nullif(audit.new_data ->> 'creation_run_id', '')
        ) is not null
        then 'complete'
      else 'legacy_gap'
    end as attribution_status,
    false as project_exists
  from earliest_insert as audit
  where not exists (
    select 1
    from public.projects as project
    where project.id::text = audit.record_id
  )
)
select * from current_projects
union all
select * from deleted_projects;

comment on view public.project_creation_audit_log is
  'Service-role-only project creation ledger covering every current project and retained INSERT evidence for deleted projects.';

revoke all on public.project_creation_audit_log from public, anon, authenticated;
grant select on public.project_creation_audit_log to service_role;

commit;
