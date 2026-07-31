-- Make project creation attribution explicit, immutable, and queryable.
--
-- The generic audit trigger records auth.uid(), but project creation currently
-- happens through service-role clients and backend integrations. In those
-- contexts auth.uid() is null, so actor/source context must be written as part
-- of the project row before the audit trigger captures the INSERT.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

alter table public.projects
  add column if not exists created_by uuid,
  add column if not exists created_via text,
  add column if not exists creation_request_id text,
  add column if not exists creation_run_id text;

comment on column public.projects.created_by is
  'Historical auth user UUID responsible for project creation. Intentionally not a foreign key so account deletion cannot erase audit evidence.';
comment on column public.projects.created_via is
  'Immutable creation channel: web_app, api, test_bootstrap, acumatica_sync, import, automation, direct_database, or legacy_unknown.';
comment on column public.projects.creation_request_id is
  'Immutable request correlation ID for request-driven project creation.';
comment on column public.projects.creation_run_id is
  'Immutable run correlation ID for integration, import, or automation-driven project creation.';

alter table public.projects
  drop constraint if exists projects_created_via_check,
  add constraint projects_created_via_check check (
    created_via in (
      'web_app',
      'api',
      'test_bootstrap',
      'acumatica_sync',
      'import',
      'automation',
      'direct_database',
      'legacy_unknown'
    )
  ) not valid,
  drop constraint if exists projects_creation_request_id_not_blank,
  add constraint projects_creation_request_id_not_blank check (
    creation_request_id is null or btrim(creation_request_id) <> ''
  ) not valid,
  drop constraint if exists projects_creation_run_id_not_blank,
  add constraint projects_creation_run_id_not_blank check (
    creation_run_id is null or btrim(creation_run_id) <> ''
  ) not valid;

-- Recover the best attribution available for existing projects from their
-- earliest project INSERT audit row. A null audit actor is preserved as an
-- explicit legacy gap instead of being guessed.
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
)
update public.projects as project
set
  created_by = audit.changed_by,
  created_via = case
    when coalesce(audit.new_data ->> 'erp_system', '') = 'acumatica'
      or nullif(audit.new_data ->> 'acumatica_project_id', '') is not null
      then 'acumatica_sync'
    when audit.changed_by is not null then 'api'
    else 'legacy_unknown'
  end,
  creation_run_id = 'legacy-audit:' || audit.id::text
from earliest_insert as audit
where project.id::text = audit.record_id
  and project.created_via is null;

update public.projects
set created_via = 'legacy_unknown'
where created_via is null;

alter table public.projects
  alter column created_via set not null,
  validate constraint projects_created_via_check,
  validate constraint projects_creation_request_id_not_blank,
  validate constraint projects_creation_run_id_not_blank;

create index if not exists idx_projects_created_by
  on public.projects (created_by)
  where created_by is not null;

create index if not exists idx_projects_created_via
  on public.projects (created_via, created_at desc);

create or replace function public.enforce_project_creation_attribution()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if row(
      new.created_by,
      new.created_via,
      new.creation_request_id,
      new.creation_run_id
    ) is distinct from row(
      old.created_by,
      old.created_via,
      old.creation_request_id,
      old.creation_run_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Project creation attribution is immutable',
        detail = format('Project %s creation attribution cannot be changed after insert.', old.id),
        hint = 'Create a corrective audit event instead of rewriting project creation history.';
    end if;

    return new;
  end if;

  if new.created_via is null or new.created_via = 'legacy_unknown' then
    raise exception using
      errcode = '23514',
      message = 'Project creation source is required',
      detail = 'New projects cannot use a null or legacy_unknown creation source.',
      hint = 'Set created_via and the matching request or run correlation ID.';
  end if;

  if new.created_via in ('web_app', 'api', 'test_bootstrap') then
    if new.created_by is null then
      raise exception using
        errcode = '23514',
        message = 'Project creator is required for request-driven creation',
        hint = 'Set created_by to the authenticated user UUID.';
    end if;

    if nullif(btrim(new.creation_request_id), '') is null then
      raise exception using
        errcode = '23514',
        message = 'Project creation request ID is required',
        hint = 'Set creation_request_id to the API request correlation ID.';
    end if;
  else
    if nullif(btrim(new.creation_run_id), '') is null then
      raise exception using
        errcode = '23514',
        message = 'Project creation run ID is required',
        hint = 'Set creation_run_id to the integration, import, or automation run ID.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_project_creation_attribution() is
  'Fails closed when a new project omits actor/source correlation and prevents later attribution rewrites.';

drop trigger if exists trg_enforce_project_creation_attribution on public.projects;
create trigger trg_enforce_project_creation_attribution
  before insert or update of created_by, created_via, creation_request_id, creation_run_id
  on public.projects
  for each row
  execute function public.enforce_project_creation_attribution();

-- A service-role-only projection keeps the frontend API away from raw audit
-- JSON while retaining rows for deleted projects and explicit legacy gaps.
create or replace view public.project_creation_audit_log
with (security_invoker = true)
as
select
  audit.id,
  coalesce(
    project.id::bigint,
    case
      when audit.record_id ~ '^[0-9]{1,18}$' then audit.record_id::bigint
      else null
    end
  ) as project_id,
  coalesce(project.name, audit.new_data ->> 'name') as project_name,
  coalesce(
    project.project_number,
    project."job number",
    audit.new_data ->> 'project_number',
    audit.new_data ->> 'job number'
  ) as project_number,
  coalesce(
    project.created_by,
    case
      when audit.new_data ->> 'created_by' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (audit.new_data ->> 'created_by')::uuid
      else audit.changed_by
    end
  ) as created_by,
  coalesce(
    project.created_via,
    nullif(audit.new_data ->> 'created_via', ''),
    case
      when coalesce(audit.new_data ->> 'erp_system', '') = 'acumatica'
        or nullif(audit.new_data ->> 'acumatica_project_id', '') is not null
        then 'acumatica_sync'
      when audit.changed_by is not null then 'api'
      else 'legacy_unknown'
    end
  ) as created_via,
  coalesce(project.creation_request_id, nullif(audit.new_data ->> 'creation_request_id', ''))
    as creation_request_id,
  coalesce(project.creation_run_id, nullif(audit.new_data ->> 'creation_run_id', ''))
    as creation_run_id,
  audit.changed_at as created_at,
  case
    when coalesce(project.created_via, audit.new_data ->> 'created_via', 'legacy_unknown') <> 'legacy_unknown'
      and coalesce(
        project.creation_request_id,
        project.creation_run_id,
        nullif(audit.new_data ->> 'creation_request_id', ''),
        nullif(audit.new_data ->> 'creation_run_id', '')
      ) is not null
      then 'complete'
    else 'legacy_gap'
  end as attribution_status,
  project.id is not null as project_exists
from public.db_audit_log as audit
left join public.projects as project
  on project.id::text = audit.record_id
where audit.table_name = 'projects'
  and audit.operation = 'INSERT';

comment on view public.project_creation_audit_log is
  'Service-role-only project creation ledger derived from immutable project attribution and INSERT audit events.';

revoke all on public.project_creation_audit_log from public, anon, authenticated;
grant select on public.project_creation_audit_log to service_role;

commit;
