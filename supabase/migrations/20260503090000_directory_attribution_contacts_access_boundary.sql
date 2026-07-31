-- Directory attribution contacts and explicit project-access helper.
--
-- This is the first safe slice of the directory RLS hardening plan:
-- - Create a separate attribution/reference table for email/file/project matching.
-- - Seed a visible "No Access" project permission template.
-- - Add current_has_project_access() so future RLS policies can distinguish
--   real app access from directory/reference-only contact rows.
--
-- This migration intentionally does not flip RLS on the existing core
-- directory tables. Those policies should be tightened only after the new
-- access boundary is in place and verified.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.project_contact_references (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  reference_type text not null check (
    reference_type in (
      'email_sender',
      'email_recipient',
      'meeting_participant',
      'attachment_sender',
      'invoice_contact',
      'permit_contact',
      'manual_reference'
    )
  ),
  source_system text,
  source_document_metadata_id text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'active' check (status in ('active', 'inactive', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, person_id, reference_type, source_document_metadata_id)
);

comment on table public.project_contact_references is
  'Project-scoped references used for email, meeting, attachment, invoice, and permit attribution. These rows do not grant app access.';

comment on column public.project_contact_references.reference_type is
  'Why this person is associated with the project for attribution. This is not a permission role.';

create index if not exists idx_project_contact_references_project_status
  on public.project_contact_references (project_id, status);

create index if not exists idx_project_contact_references_person
  on public.project_contact_references (person_id);

create index if not exists idx_project_contact_references_company
  on public.project_contact_references (company_id)
  where company_id is not null;

create index if not exists idx_project_contact_references_source_doc
  on public.project_contact_references (source_document_metadata_id)
  where source_document_metadata_id is not null;

with document_identities as (
  select
    dm.project_id::integer as project_id,
    dm.id as source_document_metadata_id,
    coalesce(dm.source_system, dm.source, dm.category, dm.type) as source_system,
    case
      when lower(coalesce(dm.category, dm.type, '')) like '%meeting%' then 'meeting_participant'
      else 'email_sender'
    end as reference_type,
    public.normalize_comms_contact_email(dm.organizer_email) as email
  from public.document_metadata dm
  where dm.project_id is not null
    and dm.organizer_email is not null

  union all

  select
    dm.project_id::integer as project_id,
    dm.id as source_document_metadata_id,
    coalesce(dm.source_system, dm.source, dm.category, dm.type) as source_system,
    case
      when lower(coalesce(dm.category, dm.type, '')) like '%meeting%' then 'meeting_participant'
      else 'email_sender'
    end as reference_type,
    public.normalize_comms_contact_email(dm.host_email) as email
  from public.document_metadata dm
  where dm.project_id is not null
    and dm.host_email is not null

  union all

  select
    dm.project_id::integer as project_id,
    dm.id as source_document_metadata_id,
    coalesce(dm.source_system, dm.source, dm.category, dm.type) as source_system,
    case
      when lower(coalesce(dm.category, dm.type, '')) like '%meeting%' then 'meeting_participant'
      else 'email_recipient'
    end as reference_type,
    public.normalize_comms_contact_email(raw_participant) as email
  from public.document_metadata dm
  cross join lateral regexp_split_to_table(dm.participants, '\s*,\s*') as raw_participant
  where dm.project_id is not null
    and dm.participants is not null

  union all

  select
    dm.project_id::integer as project_id,
    dm.id as source_document_metadata_id,
    coalesce(dm.source_system, dm.source, dm.category, dm.type) as source_system,
    case
      when lower(coalesce(dm.category, dm.type, '')) like '%meeting%' then 'meeting_participant'
      else 'email_recipient'
    end as reference_type,
    public.normalize_comms_contact_email(raw_participant) as email
  from public.document_metadata dm
  cross join lateral unnest(dm.participants_array) as raw_participant
  where dm.project_id is not null
    and dm.participants_array is not null

  union all

  select
    dm.project_id::integer as project_id,
    dm.id as source_document_metadata_id,
    coalesce(dm.source_system, dm.source, dm.category, dm.type) as source_system,
    'meeting_participant' as reference_type,
    public.normalize_comms_contact_email(coalesce(
      attendee ->> 'email',
      attendee ->> 'mail',
      attendee ->> 'userPrincipalName'
    )) as email
  from public.document_metadata dm
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(dm.meeting_attendees) = 'array' then dm.meeting_attendees
      else '[]'::jsonb
    end
  ) as attendee
  where dm.project_id is not null
    and dm.meeting_attendees is not null
),
matched_people as (
  select distinct on (
    di.project_id,
    p.id,
    di.reference_type,
    di.source_document_metadata_id
  )
    di.project_id,
    p.id as person_id,
    p.company_id,
    di.reference_type,
    di.source_system,
    di.source_document_metadata_id
  from document_identities di
  join public.projects pr on pr.id = di.project_id
  join public.people p on lower(p.email) = di.email
  where di.email is not null
)
insert into public.project_contact_references (
  project_id,
  person_id,
  company_id,
  reference_type,
  source_system,
  source_document_metadata_id,
  confidence,
  status
)
select
  project_id,
  person_id,
  company_id,
  reference_type,
  source_system,
  source_document_metadata_id,
  0.86,
  'active'
from matched_people
on conflict (project_id, person_id, reference_type, source_document_metadata_id) do update
set company_id = excluded.company_id,
    source_system = excluded.source_system,
    confidence = greatest(coalesce(public.project_contact_references.confidence, 0), excluded.confidence),
    status = 'active',
    updated_at = now();

drop trigger if exists update_project_contact_references_updated_at on public.project_contact_references;
create trigger update_project_contact_references_updated_at
before update on public.project_contact_references
for each row
execute function public.update_updated_at_column();

alter table public.project_contact_references enable row level security;

drop policy if exists project_contact_references_select on public.project_contact_references;
drop policy if exists project_contact_references_insert on public.project_contact_references;
drop policy if exists project_contact_references_update on public.project_contact_references;
drop policy if exists project_contact_references_delete on public.project_contact_references;
drop policy if exists service_role_all_project_contact_references on public.project_contact_references;

create or replace function public.current_has_project_access(p_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with current_person as (
    select p.id
    from public.people p
    where p.id = public.current_person_id()
      and p.person_type = 'user'
  )
  select exists (
    select 1
    from current_person cp
    join public.person_company_templates pct on pct.person_id = cp.id
    join public.permission_templates pt on pt.id = pct.template_id
    where pt.scope = 'company'
      and exists (
        select 1
        from jsonb_each(pt.rules_json) as module_rules(module, levels)
        where levels ? 'read'
           or levels ? 'write'
           or levels ? 'admin'
      )
  )
  or exists (
    select 1
    from current_person cp
    join public.project_directory_memberships m on m.person_id = cp.id
    join public.permission_templates pt on pt.id = m.permission_template_id
    where m.project_id = p_project_id
      and m.status = 'active'
      and pt.scope in ('project', 'global')
      and exists (
        select 1
        from jsonb_each(pt.rules_json) as module_rules(module, levels)
        where levels ? 'read'
           or levels ? 'write'
           or levels ? 'admin'
      )
  );
$$;

comment on function public.current_has_project_access(bigint) is
  'Returns true only for auth-linked user people with company-wide access or an active project membership assigned to an access-bearing project/global template.';

revoke all on function public.current_has_project_access(bigint) from public;
grant execute on function public.current_has_project_access(bigint) to authenticated, service_role;

create policy project_contact_references_select
  on public.project_contact_references
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_access(project_id)
  );

create policy project_contact_references_insert
  on public.project_contact_references
  for insert
  to authenticated
  with check (
    public.current_is_app_admin()
    or public.current_has_project_access(project_id)
  );

create policy project_contact_references_update
  on public.project_contact_references
  for update
  to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_access(project_id)
  )
  with check (
    public.current_is_app_admin()
    or public.current_has_project_access(project_id)
  );

create policy project_contact_references_delete
  on public.project_contact_references
  for delete
  to authenticated
  using (public.current_is_app_admin());

create policy service_role_all_project_contact_references
  on public.project_contact_references
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.project_contact_references to authenticated;
grant all on public.project_contact_references to service_role;

insert into public.permission_templates (
  name,
  description,
  scope,
  is_system,
  rules_json,
  granular_flags
)
values (
  'No Access',
  'Known project contact or reference. Does not grant app access to any project tool.',
  'project',
  true,
  '{
    "directory": ["none"],
    "budget": ["none"],
    "contracts": ["none"],
    "documents": ["none"],
    "schedule": ["none"],
    "submittals": ["none"],
    "rfis": ["none"],
    "change_orders": ["none"]
  }'::jsonb,
  '{}'::text[]
)
on conflict (scope, name) do update
set description = excluded.description,
    is_system = true,
    rules_json = excluded.rules_json,
    granular_flags = excluded.granular_flags,
    updated_at = now();

commit;
