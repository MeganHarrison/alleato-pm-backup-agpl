-- SCRM731: model CRM-native leads as people, not ERP company placeholders.
begin;

alter table public.crm_leads
  rename column organization_name to prospect_company_name;
alter table public.crm_leads
  rename column contact_name to full_name;
alter table public.crm_leads
  rename column contact_email to email;
alter table public.crm_leads
  rename column contact_phone to phone;

do $$
begin
  if exists (select 1 from public.crm_leads where full_name is null) then
    raise exception 'CRM person-level migration requires every existing lead to have a contact name.';
  end if;
end;
$$;

alter table public.crm_leads
  alter column full_name set not null;

alter table public.crm_leads
  add column job_title text check (
    job_title is null or length(btrim(job_title)) between 1 and 200
  ),
  add column website_url text check (
    website_url is null or length(btrim(website_url)) between 8 and 2048
  ),
  add column linkedin_url text check (
    linkedin_url is null or length(btrim(linkedin_url)) between 8 and 2048
  ),
  add column facebook_url text check (
    facebook_url is null or length(btrim(facebook_url)) between 8 and 2048
  ),
  add column x_url text check (
    x_url is null or length(btrim(x_url)) between 8 and 2048
  ),
  add column photo_storage_path text check (
    photo_storage_path is null
    or photo_storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'
  );

alter table public.crm_leads
  add constraint crm_leads_website_url_https check (website_url is null or website_url ~* '^https://[^[:space:]]+$'),
  add constraint crm_leads_linkedin_url_https check (linkedin_url is null or linkedin_url ~* '^https://[^[:space:]]+$'),
  add constraint crm_leads_facebook_url_https check (facebook_url is null or facebook_url ~* '^https://[^[:space:]]+$'),
  add constraint crm_leads_x_url_https check (x_url is null or x_url ~* '^https://[^[:space:]]+$');

alter table public.crm_leads
  drop constraint if exists crm_leads_converted_company_id_key;

grant insert (
  full_name,
  prospect_company_name,
  job_title,
  email,
  phone,
  website_url,
  linkedin_url,
  facebook_url,
  x_url,
  source,
  notes,
  owner_person_id
) on public.crm_leads to authenticated;
grant update (
  full_name,
  prospect_company_name,
  job_title,
  email,
  phone,
  website_url,
  linkedin_url,
  facebook_url,
  x_url,
  source,
  notes,
  owner_person_id
) on public.crm_leads to authenticated;

drop index if exists public.crm_leads_name_idx;
create index crm_leads_person_name_idx
  on public.crm_leads(lower(full_name))
  where archived_at is null;
create index crm_leads_prospect_company_idx
  on public.crm_leads(lower(prospect_company_name))
  where archived_at is null;
create index crm_leads_email_idx
  on public.crm_leads(lower(email))
  where archived_at is null and email is not null;
create index crm_leads_converted_company_idx
  on public.crm_leads(converted_company_id)
  where converted_company_id is not null;
create index crm_activities_lead_email_history_idx
  on public.crm_activities(lead_id, occurred_at desc)
  where lead_id is not null
    and activity_type = 'email'
    and source_system = 'outlook'
    and deleted_at is null;
alter table public.crm_ai_artifacts
  add column if not exists suggestions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(suggestions) = 'object');

alter table public.crm_ai_artifacts
  drop constraint if exists crm_ai_artifacts_artifact_type_check;
alter table public.crm_ai_artifacts
  add constraint crm_ai_artifacts_artifact_type_check check (
    artifact_type in (
      'deal_summary',
      'account_summary',
      'meeting_prep',
      'task_extraction',
      'follow_up_draft',
      'next_best_action',
      'natural_language_answer',
      'lead_research'
    )
  );
alter table public.crm_ai_artifacts
  add constraint crm_ai_artifacts_lead_research_contract check (
    artifact_type <> 'lead_research'
    or (
      lead_id is not null
      and company_id is null
      and deal_id is null
      and jsonb_array_length(citations) > 0
      and suggestions <> '{}'::jsonb
      and suggestions - array['prospect_company_name', 'job_title', 'website_url'] = '{}'::jsonb
      and not jsonb_path_exists(suggestions, '$.* ? (@.type() != "string")')
    )
  );
create index crm_ai_artifacts_lead_research_idx
  on public.crm_ai_artifacts(lead_id, created_at desc)
  where artifact_type = 'lead_research';

revoke insert on public.crm_ai_artifacts from authenticated;

create table public.crm_lead_research_limits (
  requester_person_id uuid not null references public.people(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  last_requested_at timestamptz not null default now(),
  primary key (requester_person_id, lead_id)
);
alter table public.crm_lead_research_limits enable row level security;
revoke all on public.crm_lead_research_limits from public, anon, authenticated;
grant all on public.crm_lead_research_limits to service_role;

create or replace function public.crm_reserve_lead_research(p_lead_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_person_id uuid := public.current_person_id();
  v_owner_person_id uuid;
  v_reserved_at timestamptz;
begin
  if v_person_id is null
     or not public.current_has_company_module_permission('crm', 'write') then
    raise exception 'CRM write permission is required.';
  end if;
  select owner_person_id into v_owner_person_id
  from public.crm_leads
  where id = p_lead_id and archived_at is null;
  if not found then raise exception 'CRM lead was not found.'; end if;
  if v_owner_person_id <> v_person_id
     and not public.current_has_company_module_permission('crm', 'admin') then
    raise exception 'Only the lead owner or a CRM admin can research this lead.';
  end if;

  insert into public.crm_lead_research_limits (requester_person_id, lead_id, last_requested_at)
  values (v_person_id, p_lead_id, now())
  on conflict (requester_person_id, lead_id) do update
    set last_requested_at = excluded.last_requested_at
    where crm_lead_research_limits.last_requested_at <= now() - interval '5 minutes'
  returning last_requested_at into v_reserved_at;

  if v_reserved_at is null then
    raise exception 'Wait five minutes before researching this lead again.' using errcode = 'P0001';
  end if;
  return v_reserved_at;
end;
$$;
revoke all on function public.crm_reserve_lead_research(uuid) from public, anon;
grant execute on function public.crm_reserve_lead_research(uuid) to authenticated;

create or replace function public.crm_apply_lead_research(
  p_lead_id uuid,
  p_artifact_id uuid,
  p_expected_lead_row_version integer
)
returns public.crm_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_person_id uuid := public.current_person_id();
  v_artifact public.crm_ai_artifacts%rowtype;
  v_lead public.crm_leads%rowtype;
  v_suggestions jsonb;
begin
  if v_person_id is null then
    raise exception 'CRM lead research requires an authenticated person.';
  end if;
  if not public.current_has_company_module_permission('crm', 'write') then
    raise exception 'CRM write permission is required.';
  end if;

  select * into v_artifact
  from public.crm_ai_artifacts
  where id = p_artifact_id
    and lead_id = p_lead_id
    and artifact_type = 'lead_research'
    and review_status = 'draft'
  for update;

  if not found then
    raise exception 'Lead research draft was not found or was already reviewed.';
  end if;

  select * into v_lead
  from public.crm_leads
  where id = v_artifact.lead_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'CRM lead was not found.';
  end if;
  if v_lead.row_version <> p_expected_lead_row_version then
    raise exception 'CRM lead changed. Refresh before applying research.';
  end if;
  if v_lead.owner_person_id <> v_person_id
     and not public.current_has_company_module_permission('crm', 'admin') then
    raise exception 'Only the lead owner or a CRM admin can apply research.';
  end if;

  v_suggestions := v_artifact.suggestions;
  if jsonb_array_length(v_artifact.citations) = 0
     or v_suggestions = '{}'::jsonb
     or v_suggestions - array['prospect_company_name', 'job_title', 'website_url'] <> '{}'::jsonb
     or jsonb_path_exists(v_suggestions, '$.* ? (@.type() != "string")') then
    raise exception 'Lead research draft is malformed and cannot be applied.';
  end if;
  update public.crm_leads set
    prospect_company_name = coalesce(nullif(btrim(v_suggestions->>'prospect_company_name'), ''), prospect_company_name),
    job_title = coalesce(nullif(btrim(v_suggestions->>'job_title'), ''), job_title),
    website_url = coalesce(nullif(btrim(v_suggestions->>'website_url'), ''), website_url)
  where id = v_lead.id
  returning * into v_lead;

  update public.crm_ai_artifacts set
    review_status = 'applied',
    reviewed_by_person_id = v_person_id,
    reviewed_at = now()
  where id = v_artifact.id;

  return v_lead;
end;
$$;

revoke all on function public.crm_apply_lead_research(uuid, uuid, integer) from public, anon;
grant execute on function public.crm_apply_lead_research(uuid, uuid, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-lead-photos',
  'crm-lead-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.crm_leads is
'CRM-owned person-level leads. Multiple people may share a prospect company name without creating an ERP company.';
comment on column public.crm_ai_artifacts.suggestions is
'Whitelisted structured draft fields. AI research never mutates a lead until crm_apply_lead_research is explicitly invoked.';

commit;
