-- 20260701090000_create_meetings_tool.sql
-- Procore-style Meetings tool. Transcripts stay in document_metadata (Fireflies pipeline untouched).

create table public.meeting_series (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  series_id uuid not null references public.meeting_series(id) on delete restrict,
  number integer not null default 1,
  name text not null,
  meeting_link text,
  location text,
  meeting_date date,
  timezone text not null default 'America/Indiana/Indianapolis',
  start_time time,
  end_time time,
  is_private boolean not null default false,
  is_draft boolean not null default false,
  mode text not null default 'agenda' check (mode in ('agenda','minutes')),
  overview text,
  template_id uuid, -- FK added below after meeting_templates exists
  transcript_document_id text references public.document_metadata(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (series_id, number)
);
create index meetings_project_idx on public.meetings (project_id) where deleted_at is null;
create index meetings_transcript_idx on public.meetings (transcript_document_id);

create table public.meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  is_required boolean not null default true,
  attended boolean, -- null until minutes mode marks attendance
  created_at timestamptz not null default now(),
  unique (meeting_id, person_id)
);

create table public.meeting_categories (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index meeting_categories_meeting_idx on public.meeting_categories (meeting_id, position);

create table public.meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  category_id uuid not null references public.meeting_categories(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  description text,
  official_minutes text,
  assignee_person_id uuid references public.people(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  priority text check (priority in ('low','medium','high')),
  origin_meeting_id uuid references public.meetings(id) on delete set null,
  carried_from_item_id uuid references public.meeting_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meeting_items_meeting_idx on public.meeting_items (meeting_id, category_id, position);
create index meeting_items_carried_idx on public.meeting_items (carried_from_item_id);

-- Company-level templates: NO project_id by design (Procore rule).
create table public.meeting_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  overview text,
  is_private boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.meeting_template_categories (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.meeting_templates(id) on delete cascade,
  name text not null,
  position integer not null default 0
);

create table public.meeting_template_items (
  id uuid primary key default gen_random_uuid(),
  template_category_id uuid not null references public.meeting_template_categories(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  description text,
  priority text check (priority in ('low','medium','high'))
);

alter table public.meetings
  add constraint meetings_template_fk foreign key (template_id)
  references public.meeting_templates(id) on delete set null;

-- Item -> task link (tasks.assignee_person_id already targets people.id)
alter table public.tasks add column meeting_item_id uuid references public.meeting_items(id) on delete set null;
create index tasks_meeting_item_idx on public.tasks (meeting_item_id);

-- Pattern C attachment junctions (document_metadata.id is TEXT)
create table public.meeting_documents (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  document_metadata_id text not null references public.document_metadata(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (meeting_id, document_metadata_id)
);

create table public.meeting_item_documents (
  id uuid primary key default gen_random_uuid(),
  meeting_item_id uuid not null references public.meeting_items(id) on delete cascade,
  document_metadata_id text not null references public.document_metadata(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (meeting_item_id, document_metadata_id)
);

-- RLS: same pattern as every other project entity
alter table public.meeting_series enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.meeting_categories enable row level security;
alter table public.meeting_items enable row level security;
alter table public.meeting_templates enable row level security;
alter table public.meeting_template_categories enable row level security;
alter table public.meeting_template_items enable row level security;
alter table public.meeting_documents enable row level security;
alter table public.meeting_item_documents enable row level security;

create policy meeting_series_member on public.meeting_series for all
  using (current_is_app_admin() or current_is_project_member(project_id::bigint))
  with check (current_is_app_admin() or current_is_project_member(project_id::bigint));

create policy meetings_member on public.meetings for all
  using (current_is_app_admin() or current_is_project_member(project_id::bigint))
  with check (current_is_app_admin() or current_is_project_member(project_id::bigint));

-- Child tables inherit access through the parent meeting
create policy meeting_children_attendees on public.meeting_attendees for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));
create policy meeting_children_categories on public.meeting_categories for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));
create policy meeting_children_items on public.meeting_items for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));
create policy meeting_docs_member on public.meeting_documents for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));
create policy meeting_item_docs_member on public.meeting_item_documents for all
  using (exists (select 1 from public.meeting_items i join public.meetings m on m.id = i.meeting_id
    where i.id = meeting_item_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));

-- Templates: everyone authenticated reads, admins write
create policy meeting_templates_read on public.meeting_templates for select using (auth.role() = 'authenticated');
create policy meeting_templates_write on public.meeting_templates for all using (current_is_app_admin());
create policy meeting_template_cats_read on public.meeting_template_categories for select using (auth.role() = 'authenticated');
create policy meeting_template_cats_write on public.meeting_template_categories for all using (current_is_app_admin());
create policy meeting_template_items_read on public.meeting_template_items for select using (auth.role() = 'authenticated');
create policy meeting_template_items_write on public.meeting_template_items for all using (current_is_app_admin());

-- Extend the shared Pattern C access helper (latest full body copied from
-- supabase/migrations/20260524020000_create_remaining_pattern_c_attachment_junctions.sql,
-- with two new branches: 'meeting' and 'meeting_item').
create or replace function public.user_can_access_entity(
  entity_type text,
  entity_id   text
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project_id integer;
  has_access   boolean;
begin
  if public.current_is_app_admin() then
    return true;
  end if;

  case entity_type

    when 'project' then
      return public.current_is_project_member(entity_id::integer);

    when 'commitment' then
      select cu.project_id into v_project_id
      from public.commitments_unified cu
      where cu.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'prime_contract' then
      select pc.project_id::integer into v_project_id
      from public.prime_contracts pc
      where pc.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'change_order' then
      select co.project_id into v_project_id
      from public.change_orders co
      where co.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'commitment_change_order' then
      select coalesce(cco.project_id, cu.project_id) into v_project_id
      from public.contract_change_orders cco
      left join public.commitments_unified cu on cu.id = cco.contract_id
      where cco.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'prime_contract_change_order' then
      select pcco.project_id::integer into v_project_id
      from public.prime_contract_change_orders pcco
      where pcco.id = entity_id::bigint;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'prime_contract_pco' then
      select pco.project_id into v_project_id
      from public.prime_contract_pcos pco
      where pco.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'change_event' then
      select ce.project_id::integer into v_project_id
      from public.change_events ce
      where ce.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'invoice' then
      select pc.project_id::integer into v_project_id
      from public.owner_invoices oi
      join public.prime_contracts pc on pc.id = oi.prime_contract_id
      where oi.id = entity_id::bigint;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'subcontractor_invoice' then
      select si.project_id into v_project_id
      from public.subcontractor_invoices si
      where si.id = entity_id::bigint;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'submittal' then
      select s.project_id into v_project_id
      from public.submittals s
      where s.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'rfi' then
      select r.project_id::integer into v_project_id
      from public.rfis r
      where r.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'drawing' then
      select d.project_id into v_project_id
      from public.drawings d
      where d.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'company' then
      has_access := (select auth.uid()) is not null;

    when 'meeting' then
      select m.project_id into v_project_id
      from public.meetings m
      where m.id::text = entity_id;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'meeting_item' then
      select m.project_id into v_project_id
      from public.meeting_items i
      join public.meetings m on m.id = i.meeting_id
      where i.id::text = entity_id;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    else
      has_access := false;

  end case;

  return coalesce(has_access, false);
end;
$$;

comment on function public.user_can_access_entity(text, text) is
  'Shared RLS helper for document junction tables. Returns true if the current user has access to the given entity.';

grant execute on function public.user_can_access_entity(text, text) to authenticated;

-- Backfill: one meetings row per existing transcript meeting.
-- NOTE: document_metadata.date is `timestamptz`, not text (verified live via
-- information_schema), so the brief's `nullif(dm.date, '')::date` (a text-cast
-- pattern) is replaced with a direct `::date` cast on the timestamptz value.
insert into public.meeting_series (project_id, name)
select distinct dm.project_id, coalesce(nullif(trim(dm.title), ''), 'Meeting')
from public.document_metadata dm
where dm.type = 'meeting' and dm.project_id is not null and dm.deleted_at is null
on conflict (project_id, name) do nothing;

insert into public.meetings (project_id, series_id, number, name, meeting_date, meeting_link, transcript_document_id, mode, created_at)
select
  dm.project_id,
  ms.id,
  row_number() over (partition by ms.id order by dm.date asc nulls last, dm.created_at asc),
  coalesce(nullif(trim(dm.title), ''), 'Meeting'),
  dm.date::date,
  coalesce(dm.meeting_link, dm.fireflies_link),
  dm.id,
  'minutes', -- transcript exists => it already happened
  dm.created_at
from public.document_metadata dm
join public.meeting_series ms
  on ms.project_id = dm.project_id and ms.name = coalesce(nullif(trim(dm.title), ''), 'Meeting')
where dm.type = 'meeting' and dm.project_id is not null and dm.deleted_at is null;
