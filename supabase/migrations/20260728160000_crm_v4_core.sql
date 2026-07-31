-- Alleato CRM v4: relationship management, pipeline, reporting,
-- communication review, and won-deal conversion contracts.
--
-- This migration is intentionally additive. It does not alter ERP-owned
-- company master fields and it does not seed CRM account membership.

begin;

create or replace function public.current_has_company_module_permission(
  p_module text,
  p_required_level text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_person_id uuid;
  v_rules jsonb;
begin
  if p_module is null or p_required_level not in ('read', 'write', 'admin') then
    return false;
  end if;

  if public.current_is_app_admin() then
    return true;
  end if;

  v_person_id := public.current_person_id();
  if v_person_id is null then
    return false;
  end if;

  select pt.rules_json -> p_module
  into v_rules
  from public.person_company_templates pct
  join public.permission_templates pt on pt.id = pct.template_id
  where pct.person_id = v_person_id
  limit 1;

  return case p_required_level
    when 'read' then coalesce(v_rules ?| array['read', 'write', 'admin'], false)
    when 'write' then coalesce(v_rules ?| array['write', 'admin'], false)
    when 'admin' then coalesce(v_rules ? 'admin', false)
    else false
  end;
end;
$$;

revoke all on function public.current_has_company_module_permission(text, text)
from public, anon;
grant execute on function public.current_has_company_module_permission(text, text)
to authenticated, service_role;

update public.permission_templates
set rules_json = jsonb_set(
  coalesce(rules_json, '{}'::jsonb),
  '{crm}',
  coalesce(rules_json->'crm', '[]'::jsonb),
  true
)
where not coalesce(rules_json, '{}'::jsonb) ? 'crm';

create table public.crm_account_profiles (
  company_id uuid primary key references public.companies(id) on delete restrict,
  lifecycle_stage text not null check (
    lifecycle_stage in ('lead', 'prospect', 'active_client', 'past_client', 'dormant')
  ),
  owner_person_id uuid not null references public.people(id) on delete restrict,
  last_meaningful_activity_at timestamptz,
  health_status text not null default 'unknown' check (
    health_status in ('active', 'watch', 'stale', 'unknown')
  ),
  health_reason text not null default 'No meaningful activity has been recorded.',
  health_evaluated_at timestamptz,
  row_version integer not null default 1 check (row_version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_account_profile_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_account_profiles(company_id) on delete cascade,
  field text not null check (field in ('owner_person_id', 'lifecycle_stage', 'archived_at')),
  old_value text,
  new_value text,
  changed_by_person_id uuid references public.people(id) on delete set null,
  change_source text not null check (
    change_source in ('manual', 'system:deal_won', 'system:seed')
  ),
  reason text,
  changed_at timestamptz not null default now()
);

create table public.crm_settings (
  key text primary key,
  value jsonb not null,
  updated_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.crm_settings (key, value)
values
  ('meaningful_activity_types', '["call","email","meeting"]'::jsonb),
  ('health_thresholds', '{"active_days":14,"watch_days":30}'::jsonb),
  ('stale_deal_threshold_days', '30'::jsonb),
  ('default_reporting_timezone', '"America/Indianapolis"'::jsonb),
  ('auto_accept_enabled', 'false'::jsonb),
  ('free_email_domain_denylist', '["gmail.com","outlook.com","hotmail.com","yahoo.com","icloud.com"]'::jsonb)
on conflict (key) do nothing;

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  deal_id uuid,
  activity_type text not null check (activity_type in ('call', 'email', 'meeting', 'note')),
  subject text not null check (length(btrim(subject)) between 1 and 300),
  body text,
  occurred_at timestamptz not null,
  created_by_person_id uuid references public.people(id) on delete restrict,
  record_origin text not null default 'manual' check (record_origin in ('manual', 'auto')),
  source_system text check (source_system in ('fireflies', 'outlook', 'teams')),
  source_document_id text references public.document_metadata(id) on delete set null,
  source_external_key text,
  content_hash text,
  match_status text check (match_status is null or match_status = 'accepted'),
  match_confidence numeric(5,4) check (
    match_confidence is null or match_confidence between 0 and 1
  ),
  visibility_scope text not null default 'standard' check (
    visibility_scope in ('standard', 'restricted', 'private_source')
  ),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_activities_origin_contract check (
    (
      record_origin = 'manual'
      and created_by_person_id is not null
      and source_system is null
      and source_external_key is null
      and content_hash is null
      and match_status is null
    )
    or (
      record_origin = 'auto'
      and created_by_person_id is null
      and source_system is not null
      and source_external_key is not null
      and content_hash is not null
      and match_status = 'accepted'
    )
  ),
  constraint crm_activities_private_body check (
    visibility_scope <> 'private_source' or body is null
  )
);

create unique index crm_activities_source_active_unique
on public.crm_activities(source_system, source_external_key)
where source_external_key is not null and deleted_at is null;

create table public.crm_activity_contacts (
  activity_id uuid not null references public.crm_activities(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  participant_role text check (
    participant_role is null
    or participant_role in ('organizer', 'attendee', 'sender', 'recipient', 'mentioned')
  ),
  created_at timestamptz not null default now(),
  primary key (activity_id, person_id)
);

alter table public.tasks
  add column if not exists company_id uuid references public.companies(id) on delete restrict;

create table public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index crm_pipelines_active_name_unique
on public.crm_pipelines(lower(name)) where archived_at is null;
create unique index crm_pipelines_one_default_unique
on public.crm_pipelines(is_default) where is_default and archived_at is null;

create table public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  sort_order integer not null check (sort_order >= 0),
  stage_type text not null check (stage_type in ('open', 'won', 'lost')),
  default_probability integer not null check (default_probability between 0 and 100),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, sort_order)
);

create unique index crm_stages_one_won_unique
on public.crm_stages(pipeline_id) where stage_type = 'won' and archived_at is null;
create unique index crm_stages_one_lost_unique
on public.crm_stages(pipeline_id) where stage_type = 'lost' and archived_at is null;

create table public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 300),
  company_id uuid not null references public.companies(id) on delete restrict,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete restrict,
  stage_id uuid not null references public.crm_stages(id) on delete restrict,
  owner_person_id uuid not null references public.people(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  value_estimate numeric(14,2) not null default 0 check (value_estimate >= 0),
  currency_code text not null default 'USD' check (currency_code = 'USD'),
  probability integer not null default 0 check (probability between 0 and 100),
  expected_close_date date,
  closed_at timestamptz,
  project_id bigint unique references public.projects(id) on delete restrict,
  project_sync_status text not null default 'not_started' check (
    project_sync_status in ('not_started', 'pending', 'failed', 'linked', 'erp_synchronized')
  ),
  source text not null default 'manual' check (length(btrim(source)) > 0),
  lost_reason text,
  row_version integer not null default 1 check (row_version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_deals_closed_contract check (
    (status = 'open' and closed_at is null and lost_reason is null)
    or (status = 'won' and closed_at is not null and lost_reason is null)
    or (status = 'lost' and closed_at is not null and length(btrim(lost_reason)) > 0)
  )
);

alter table public.crm_activities
  add constraint crm_activities_deal_id_fkey
  foreign key (deal_id) references public.crm_deals(id) on delete restrict;

alter table public.tasks
  add column if not exists crm_deal_id uuid references public.crm_deals(id) on delete restrict;

create table public.crm_deal_contacts (
  deal_id uuid not null references public.crm_deals(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  role text not null check (role in ('decision_maker', 'influencer', 'champion', 'estimator', 'other')),
  is_primary boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now(),
  primary key (deal_id, person_id)
);

create unique index crm_deal_contacts_one_primary
on public.crm_deal_contacts(deal_id) where is_primary;

create table public.crm_deal_stage_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.crm_deals(id) on delete cascade,
  from_stage_id uuid references public.crm_stages(id) on delete restrict,
  to_stage_id uuid not null references public.crm_stages(id) on delete restrict,
  changed_by_person_id uuid not null references public.people(id) on delete restrict,
  changed_at timestamptz not null default now(),
  reason text
);

create table public.crm_deal_documents (
  deal_id uuid not null references public.crm_deals(id) on delete cascade,
  document_metadata_id text not null references public.document_metadata(id) on delete cascade,
  document_type text,
  attached_by_person_id uuid not null references public.people(id) on delete restrict,
  attached_at timestamptz not null default now(),
  primary key (deal_id, document_metadata_id)
);

create table public.crm_source_identity (
  id uuid primary key default gen_random_uuid(),
  canonical_communication_key uuid not null default gen_random_uuid(),
  source_system text not null check (source_system in ('fireflies', 'outlook', 'teams')),
  source_external_key text not null,
  source_document_id text references public.document_metadata(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_system, source_external_key)
);

create table public.crm_activity_candidates (
  id uuid primary key default gen_random_uuid(),
  canonical_communication_key uuid not null,
  source_system text not null check (source_system in ('fireflies', 'outlook', 'teams')),
  source_external_key text not null,
  content_hash text not null,
  source_document_id text references public.document_metadata(id) on delete set null,
  proposed_company_id uuid not null references public.companies(id) on delete restrict,
  proposed_contacts jsonb not null default '[]'::jsonb check (jsonb_typeof(proposed_contacts) = 'array'),
  match_signals jsonb not null check (jsonb_typeof(match_signals) = 'object'),
  match_confidence numeric(5,4) not null check (match_confidence between 0 and 1),
  matching_rule_version text not null,
  visibility_scope text not null check (
    visibility_scope in ('standard', 'restricted', 'private_source')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'rejected', 'superseded', 'withdrawn')
  ),
  superseded_by_candidate_id uuid references public.crm_activity_candidates(id) on delete set null,
  accepted_activity_id uuid references public.crm_activities(id) on delete set null,
  decided_by_person_id uuid references public.people(id) on delete set null,
  decided_at timestamptz,
  decision_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_external_key, content_hash),
  constraint crm_candidate_decision_contract check (
    (status = 'pending' and decided_at is null and decided_by_person_id is null)
    or (
      status in ('accepted', 'rejected')
      and decided_at is not null
      and decided_by_person_id is not null
    )
    or status in ('superseded', 'withdrawn')
  ),
  constraint crm_candidate_rejection_feedback check (
    status <> 'rejected' or length(btrim(decision_feedback)) > 0
  )
);

create table public.crm_match_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_type text not null check (alias_type in ('email', 'domain', 'name')),
  alias_value text not null check (alias_value = lower(btrim(alias_value))),
  person_id uuid references public.people(id) on delete restrict,
  company_id uuid references public.companies(id) on delete restrict,
  origin text not null check (origin in ('manual', 'decision_feedback')),
  approved_by_person_id uuid not null references public.people(id) on delete restrict,
  approved_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_alias_target_contract check (
    (alias_type in ('email', 'name') and person_id is not null and company_id is null)
    or (alias_type = 'domain' and company_id is not null and person_id is null)
  )
);

create unique index crm_match_aliases_active_unique
on public.crm_match_aliases(alias_type, alias_value)
where active;

create table public.crm_conversion_attempts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.crm_deals(id) on delete restrict,
  idempotency_key text not null unique,
  status text not null default 'pending' check (
    status in ('pending', 'project_created', 'erp_pending', 'completed', 'failed_recoverable', 'failed_permanent')
  ),
  project_id bigint references public.projects(id) on delete restrict,
  erp_external_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_message text,
  requested_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_profiles_owner_idx on public.crm_account_profiles(owner_person_id);
create index crm_profiles_lifecycle_idx on public.crm_account_profiles(lifecycle_stage);
create index crm_profiles_activity_idx on public.crm_account_profiles(last_meaningful_activity_at desc);
create index crm_profiles_active_idx on public.crm_account_profiles(health_status) where archived_at is null;
create index crm_activities_company_occurred_idx on public.crm_activities(company_id, occurred_at desc);
create index crm_activities_deal_occurred_idx on public.crm_activities(deal_id, occurred_at desc);
create index crm_activities_origin_idx on public.crm_activities(record_origin, created_at desc);
create index crm_activities_source_document_idx on public.crm_activities(source_document_id);
create index crm_deals_stage_idx on public.crm_deals(pipeline_id, stage_id) where archived_at is null;
create index crm_deals_company_status_idx on public.crm_deals(company_id, status);
create index crm_deals_owner_status_idx on public.crm_deals(owner_person_id, status);
create index crm_deals_expected_close_idx on public.crm_deals(expected_close_date) where status = 'open';
create index crm_deals_closed_idx on public.crm_deals(closed_at);
create index crm_candidates_review_idx on public.crm_activity_candidates(status, created_at);
create index crm_tasks_company_open_idx on public.tasks(company_id, due_date)
where company_id is not null and status in ('open', 'in_progress', 'blocked');

create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.crm_set_versioned_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.row_version := old.row_version + 1;
  return new;
end;
$$;

create trigger crm_profiles_touch before update on public.crm_account_profiles
for each row execute function public.crm_set_versioned_updated_at();
create trigger crm_settings_touch before update on public.crm_settings
for each row execute function public.crm_set_updated_at();
create trigger crm_activities_touch before update on public.crm_activities
for each row execute function public.crm_set_updated_at();
create trigger crm_pipelines_touch before update on public.crm_pipelines
for each row execute function public.crm_set_updated_at();
create trigger crm_stages_touch before update on public.crm_stages
for each row execute function public.crm_set_updated_at();
create trigger crm_deals_touch before update on public.crm_deals
for each row execute function public.crm_set_versioned_updated_at();
create trigger crm_candidates_touch before update on public.crm_activity_candidates
for each row execute function public.crm_set_updated_at();
create trigger crm_aliases_touch before update on public.crm_match_aliases
for each row execute function public.crm_set_updated_at();
create trigger crm_conversion_touch before update on public.crm_conversion_attempts
for each row execute function public.crm_set_updated_at();

create or replace function public.crm_validate_internal_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.people p
    where p.id = new.owner_person_id
      and p.auth_user_id is not null
      and p.status = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'CRM owner must be an active internal user.';
  end if;
  return new;
end;
$$;

create trigger crm_profiles_owner_guard
before insert or update of owner_person_id on public.crm_account_profiles
for each row execute function public.crm_validate_internal_owner();
create trigger crm_deals_owner_guard
before insert or update of owner_person_id on public.crm_deals
for each row execute function public.crm_validate_internal_owner();

create or replace function public.crm_evaluate_account(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last timestamptz;
  v_overdue date;
  v_active_days integer := 14;
  v_watch_days integer := 30;
  v_status text;
  v_reason text;
begin
  select coalesce(nullif(value->>'active_days', '')::integer, v_active_days),
         coalesce(nullif(value->>'watch_days', '')::integer, v_watch_days)
  into v_active_days, v_watch_days
  from public.crm_settings where key = 'health_thresholds';

  select max(a.occurred_at)
  into v_last
  from public.crm_activities a
  where a.company_id = p_company_id
    and a.deleted_at is null
    and a.occurred_at <= now()
    and (
      a.record_origin = 'manual'
      or (a.record_origin = 'auto' and a.match_status = 'accepted')
    )
    and exists (
      select 1 from public.crm_settings s
      where s.key = 'meaningful_activity_types'
        and s.value ? a.activity_type
    );

  select min(t.due_date)
  into v_overdue
  from public.tasks t
  where t.company_id = p_company_id
    and t.status in ('open', 'in_progress', 'blocked')
    and t.due_date < current_date;

  if v_overdue is not null then
    v_status := 'stale';
    v_reason := format('Follow-up overdue by %s day(s).', current_date - v_overdue);
  elsif v_last is null then
    v_status := 'unknown';
    v_reason := 'No meaningful activity has been recorded.';
  elsif v_last >= now() - make_interval(days => v_active_days) then
    v_status := 'active';
    v_reason := format('Meaningful activity recorded within %s days.', v_active_days);
  elsif v_last >= now() - make_interval(days => v_watch_days) then
    v_status := 'watch';
    v_reason := format('No meaningful activity in %s days.', extract(day from now() - v_last)::integer);
  else
    v_status := 'stale';
    v_reason := format('No meaningful activity in %s days.', extract(day from now() - v_last)::integer);
  end if;

  update public.crm_account_profiles
  set last_meaningful_activity_at = v_last,
      health_status = v_status,
      health_reason = v_reason,
      health_evaluated_at = now()
  where company_id = p_company_id;
end;
$$;

revoke all on function public.crm_evaluate_account(uuid) from public, anon, authenticated;
grant execute on function public.crm_evaluate_account(uuid) to service_role;

create or replace function public.crm_activity_health_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.crm_evaluate_account(old.company_id);
    return old;
  end if;
  perform public.crm_evaluate_account(new.company_id);
  if tg_op = 'UPDATE' and old.company_id is distinct from new.company_id then
    perform public.crm_evaluate_account(old.company_id);
  end if;
  return new;
end;
$$;

create trigger crm_activity_health_after_write
after insert or update or delete on public.crm_activities
for each row execute function public.crm_activity_health_trigger();

create or replace function public.crm_task_health_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.company_id is not null then
      perform public.crm_evaluate_account(old.company_id);
    end if;
    return old;
  end if;
  if new.company_id is not null then
    perform public.crm_evaluate_account(new.company_id);
  end if;
  if tg_op = 'UPDATE' and old.company_id is distinct from new.company_id and old.company_id is not null then
    perform public.crm_evaluate_account(old.company_id);
  end if;
  return new;
end;
$$;

create trigger crm_task_health_after_write
after insert or update or delete on public.tasks
for each row execute function public.crm_task_health_trigger();

create or replace function public.crm_transition_deal(
  p_deal_id uuid,
  p_to_stage_id uuid,
  p_expected_row_version integer,
  p_changed_by_person_id uuid,
  p_reason text default null
)
returns public.crm_deals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.crm_deals;
  v_stage public.crm_stages;
  v_from_stage_id uuid;
begin
  select * into v_deal from public.crm_deals where id = p_deal_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CRM deal was not found.';
  end if;
  if v_deal.row_version <> p_expected_row_version then
    raise exception using errcode = '40001', message = 'CRM deal changed; refresh before moving it.';
  end if;
  if v_deal.owner_person_id <> p_changed_by_person_id
     and not public.current_has_company_module_permission('crm', 'admin') then
    raise exception using errcode = '42501', message = 'Only the deal owner or a CRM admin can move this deal.';
  end if;

  select * into v_stage from public.crm_stages
  where id = p_to_stage_id and archived_at is null;
  if not found or v_stage.pipeline_id <> v_deal.pipeline_id then
    raise exception using errcode = '23514', message = 'Target stage does not belong to this deal pipeline.';
  end if;
  if v_deal.status in ('won', 'lost') and v_stage.stage_type = 'open' then
    if nullif(btrim(p_reason), '') is null then
      raise exception using errcode = '23514', message = 'A reason is required to reopen a closed deal.';
    end if;
    if v_deal.project_id is not null then
      raise exception using errcode = '23514', message = 'Sever the project link before reopening this deal.';
    end if;
  end if;
  if v_stage.stage_type = 'lost' and nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '23514', message = 'A loss reason is required.';
  end if;

  v_from_stage_id := v_deal.stage_id;
  update public.crm_deals
  set stage_id = v_stage.id,
      status = v_stage.stage_type,
      probability = v_stage.default_probability,
      closed_at = case when v_stage.stage_type = 'open' then null else now() end,
      lost_reason = case when v_stage.stage_type = 'lost' then btrim(p_reason) else null end
  where id = v_deal.id
  returning * into v_deal;

  insert into public.crm_deal_stage_events (
    deal_id, from_stage_id, to_stage_id, changed_by_person_id, reason
  ) values (
    v_deal.id, v_from_stage_id, v_stage.id, p_changed_by_person_id, p_reason
  );

  if v_stage.stage_type = 'won' then
    insert into public.crm_account_profile_events (
      company_id,
      field,
      old_value,
      new_value,
      changed_by_person_id,
      change_source,
      reason
    )
    select
      p.company_id,
      'lifecycle_stage',
      p.lifecycle_stage,
      'active_client',
      p_changed_by_person_id,
      'system:deal_won',
      format('Deal %s moved to Won.', v_deal.name)
    from public.crm_account_profiles p
    where p.company_id = v_deal.company_id
      and p.lifecycle_stage <> 'active_client';

    update public.crm_account_profiles
    set lifecycle_stage = 'active_client'
    where company_id = v_deal.company_id
      and lifecycle_stage <> 'active_client';
  end if;

  perform public.crm_evaluate_account(v_deal.company_id);
  return v_deal;
end;
$$;

revoke all on function public.crm_transition_deal(uuid, uuid, integer, uuid, text)
from public, anon, authenticated;
grant execute on function public.crm_transition_deal(uuid, uuid, integer, uuid, text)
to service_role;

insert into public.crm_pipelines (name, is_default)
values ('Alleato Business Development', true)
on conflict do nothing;

insert into public.crm_stages (pipeline_id, name, sort_order, stage_type, default_probability)
select p.id, seed.name, seed.sort_order, seed.stage_type, seed.probability
from public.crm_pipelines p
cross join (
  values
    ('Lead', 10, 'open', 10),
    ('Qualified', 20, 'open', 30),
    ('Proposal / Bid', 30, 'open', 55),
    ('Negotiation', 40, 'open', 75),
    ('Won', 50, 'won', 100),
    ('Lost', 60, 'lost', 0)
) as seed(name, sort_order, stage_type, probability)
where p.name = 'Alleato Business Development'
on conflict (pipeline_id, sort_order) do nothing;

alter table public.crm_account_profiles enable row level security;
alter table public.crm_account_profile_events enable row level security;
alter table public.crm_settings enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_activity_contacts enable row level security;
alter table public.crm_pipelines enable row level security;
alter table public.crm_stages enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_deal_contacts enable row level security;
alter table public.crm_deal_stage_events enable row level security;
alter table public.crm_deal_documents enable row level security;
alter table public.crm_source_identity enable row level security;
alter table public.crm_activity_candidates enable row level security;
alter table public.crm_match_aliases enable row level security;
alter table public.crm_conversion_attempts enable row level security;

create policy crm_profiles_read on public.crm_account_profiles
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_profiles_insert on public.crm_account_profiles
for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'write')
  and owner_person_id = public.current_person_id()
);
create policy crm_profiles_update on public.crm_account_profiles
for update to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    public.current_has_company_module_permission('crm', 'write')
    and owner_person_id = public.current_person_id()
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or owner_person_id = public.current_person_id()
);

create policy crm_events_read on public.crm_account_profile_events
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));

create policy crm_settings_read on public.crm_settings
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_settings_admin on public.crm_settings
for all to authenticated
using (public.current_has_company_module_permission('crm', 'admin'))
with check (public.current_has_company_module_permission('crm', 'admin'));

create policy crm_activities_read on public.crm_activities
for select to authenticated
using (
  public.current_has_company_module_permission('crm', 'read')
  and visibility_scope = 'standard'
);
create policy crm_activities_insert on public.crm_activities
for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'write')
  and record_origin = 'manual'
  and created_by_person_id = public.current_person_id()
);
create policy crm_activities_update on public.crm_activities
for update to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    record_origin = 'manual'
    and created_by_person_id = public.current_person_id()
    and public.current_has_company_module_permission('crm', 'write')
  )
)
with check (record_origin = 'manual');

create policy crm_activity_contacts_read on public.crm_activity_contacts
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_activity_contacts_write on public.crm_activity_contacts
for all to authenticated
using (public.current_has_company_module_permission('crm', 'write'))
with check (public.current_has_company_module_permission('crm', 'write'));

create policy crm_pipeline_reference_read on public.crm_pipelines
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_stage_reference_read on public.crm_stages
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_pipeline_admin on public.crm_pipelines
for all to authenticated
using (public.current_has_company_module_permission('crm', 'admin'))
with check (public.current_has_company_module_permission('crm', 'admin'));
create policy crm_stage_admin on public.crm_stages
for all to authenticated
using (public.current_has_company_module_permission('crm', 'admin'))
with check (public.current_has_company_module_permission('crm', 'admin'));

create policy crm_deals_read on public.crm_deals
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_deals_insert on public.crm_deals
for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'write')
  and owner_person_id = public.current_person_id()
);
create policy crm_deals_update on public.crm_deals
for update to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    public.current_has_company_module_permission('crm', 'write')
    and owner_person_id = public.current_person_id()
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or owner_person_id = public.current_person_id()
);

create policy crm_deal_contacts_read on public.crm_deal_contacts
for select to authenticated using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_deal_contacts_write on public.crm_deal_contacts
for all to authenticated
using (public.current_has_company_module_permission('crm', 'write'))
with check (public.current_has_company_module_permission('crm', 'write'));
create policy crm_deal_events_read on public.crm_deal_stage_events
for select to authenticated using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_deal_documents_read on public.crm_deal_documents
for select to authenticated using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_deal_documents_write on public.crm_deal_documents
for all to authenticated
using (public.current_has_company_module_permission('crm', 'write'))
with check (public.current_has_company_module_permission('crm', 'write'));

create policy crm_candidates_admin_read on public.crm_activity_candidates
for select to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  and visibility_scope = 'standard'
);
create policy crm_candidates_admin_update on public.crm_activity_candidates
for update to authenticated
using (public.current_has_company_module_permission('crm', 'admin'))
with check (public.current_has_company_module_permission('crm', 'admin'));
create policy crm_candidates_service_insert on public.crm_activity_candidates
for insert to service_role with check (true);
create policy crm_source_identity_service on public.crm_source_identity
for all to service_role using (true) with check (true);
create policy crm_aliases_admin on public.crm_match_aliases
for all to authenticated
using (public.current_has_company_module_permission('crm', 'admin'))
with check (public.current_has_company_module_permission('crm', 'admin'));
create policy crm_conversion_read on public.crm_conversion_attempts
for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_conversion_service on public.crm_conversion_attempts
for all to service_role using (true) with check (true);

grant select on public.crm_account_profiles, public.crm_account_profile_events,
  public.crm_settings, public.crm_activities, public.crm_activity_contacts,
  public.crm_pipelines, public.crm_stages, public.crm_deals,
  public.crm_deal_contacts, public.crm_deal_stage_events,
  public.crm_deal_documents, public.crm_activity_candidates,
  public.crm_match_aliases, public.crm_conversion_attempts to authenticated;
grant insert, update on public.crm_account_profiles, public.crm_activities,
  public.crm_activity_contacts, public.crm_deals, public.crm_deal_contacts,
  public.crm_deal_documents to authenticated;
grant insert, update, delete on public.crm_settings, public.crm_pipelines,
  public.crm_stages, public.crm_match_aliases to authenticated;
grant all on public.crm_account_profile_events, public.crm_deal_stage_events,
  public.crm_source_identity, public.crm_activity_candidates,
  public.crm_conversion_attempts to service_role;

comment on table public.crm_account_profiles is
'One-to-one CRM-owned relationship overlay on ERP-owned companies.';
comment on table public.crm_activity_candidates is
'Review boundary for communication suggestions; candidates are not visible activities.';
comment on column public.tasks.company_id is
'CRM account provenance. Application task routes must reject direct writes.';
comment on column public.tasks.crm_deal_id is
'CRM deal provenance. Application task routes must reject direct writes.';

commit;
