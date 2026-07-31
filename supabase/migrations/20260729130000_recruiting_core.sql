-- Applicant Tracker production foundation.
-- Recruiting remains a company-wide module with a data and permission boundary
-- independent from projects, CRM, HRIS, ERP, and construction integrations.

begin;

create table public.recruiting_settings (
  key text primary key check (length(btrim(key)) between 1 and 100),
  value jsonb not null,
  updated_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.recruiting_settings (key, value)
values
  ('ai_enabled', 'false'::jsonb),
  ('public_intake_enabled', 'false'::jsonb),
  ('resume_upload_enabled', 'false'::jsonb),
  ('resume_extraction_enabled', 'false'::jsonb),
  ('provider_delivery_enabled', 'false'::jsonb),
  ('outlook_mail_verified', 'false'::jsonb),
  ('outlook_calendar_verified', 'false'::jsonb),
  ('automation_enabled', 'false'::jsonb),
  ('sms_enabled', 'false'::jsonb),
  ('sms_provider_verified', 'false'::jsonb),
  ('esignature_enabled', 'false'::jsonb),
  ('esignature_provider_verified', 'false'::jsonb),
  ('resume_scanner_verified', 'false'::jsonb),
  ('resume_extractor_verified', 'false'::jsonb),
  ('ai_evaluation_approved', 'false'::jsonb),
  ('retention_deletion_enabled', 'false'::jsonb),
  ('default_timezone', '"America/Indianapolis"'::jsonb),
  ('stale_stage_days', '7'::jsonb)
on conflict (key) do nothing;

create table public.recruiting_user_roles (
  person_id uuid primary key references public.people(id) on delete cascade,
  role text not null check (
    role in ('recruiting_admin', 'recruiter', 'hiring_manager', 'interviewer', 'executive')
  ),
  is_active boolean not null default true,
  granted_by_person_id uuid references public.people(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_requisitions (
  id uuid primary key default gen_random_uuid(),
  requisition_number text not null unique check (
    length(btrim(requisition_number)) between 1 and 50
  ),
  title text not null check (length(btrim(title)) between 1 and 200),
  department text,
  employment_type text not null default 'full_time' check (
    employment_type in ('full_time', 'part_time', 'temporary', 'intern', 'contract')
  ),
  workplace_type text not null default 'onsite' check (
    workplace_type in ('onsite', 'hybrid', 'remote')
  ),
  location_name text,
  jobsite_name text,
  hiring_manager_person_id uuid references public.people(id) on delete restrict,
  recruiter_person_id uuid references public.people(id) on delete restrict,
  headcount integer not null default 1 check (headcount between 1 and 500),
  compensation_min numeric(14,2) check (
    compensation_min is null or compensation_min >= 0
  ),
  compensation_max numeric(14,2) check (
    compensation_max is null or compensation_max >= 0
  ),
  compensation_period text check (
    compensation_period is null
    or compensation_period in ('hour', 'year', 'project')
  ),
  target_start_date date,
  description text,
  business_justification text,
  status text not null default 'draft' check (
    status in ('draft', 'pending_approval', 'approved', 'open', 'paused', 'filled', 'closed', 'canceled')
  ),
  is_confidential boolean not null default false,
  row_version integer not null default 1 check (row_version > 0),
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  updated_by_person_id uuid references public.people(id) on delete set null,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recruiting_requisition_compensation_range check (
    compensation_min is null
    or compensation_max is null
    or compensation_max >= compensation_min
  )
);

create table public.recruiting_requisition_memberships (
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  membership_role text not null check (
    membership_role in ('recruiter', 'hiring_manager', 'interviewer', 'approver', 'viewer')
  ),
  can_view_compensation boolean not null default false,
  added_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (requisition_id, person_id, membership_role)
);

create table public.recruiting_stage_definitions (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete cascade,
  stage_key text not null check (
    stage_key in ('new', 'review', 'qualified', 'interview', 'offer', 'hired', 'closed')
  ),
  label text not null check (length(btrim(label)) between 1 and 80),
  position integer not null check (position between 0 and 100),
  is_terminal boolean not null default false,
  requires_disposition boolean not null default false,
  created_at timestamptz not null default now(),
  unique (requisition_id, stage_key),
  unique (requisition_id, position)
);

create table public.recruiting_candidates (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  first_name text check (first_name is null or length(btrim(first_name)) <= 100),
  last_name text check (last_name is null or length(btrim(last_name)) <= 100),
  preferred_name text check (
    preferred_name is null or length(btrim(preferred_name)) <= 100
  ),
  current_company text,
  current_title text,
  location_text text,
  linkedin_url text,
  candidate_status text not null default 'active' check (
    candidate_status in ('active', 'prospect', 'hired', 'archived', 'merged')
  ),
  merged_into_candidate_id uuid references public.recruiting_candidates(id) on delete restrict,
  row_version integer not null default 1 check (row_version > 0),
  created_by_person_id uuid references public.people(id) on delete set null,
  updated_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recruiting_candidate_merge_contract check (
    (candidate_status = 'merged' and merged_into_candidate_id is not null)
    or (candidate_status <> 'merged' and merged_into_candidate_id is null)
  ),
  constraint recruiting_candidate_not_self_merged check (
    merged_into_candidate_id is null or merged_into_candidate_id <> id
  )
);

create table public.recruiting_candidate_contacts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  value_display text not null check (length(btrim(value_display)) between 1 and 320),
  value_normalized text not null check (
    length(btrim(value_normalized)) between 1 and 320
  ),
  value_hash text not null check (length(btrim(value_hash)) >= 32),
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  consent_status text not null default 'unknown' check (
    consent_status in ('unknown', 'allowed', 'opted_out')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_type, value_hash)
);

create unique index recruiting_candidate_primary_contact_unique
on public.recruiting_candidate_contacts(candidate_id, contact_type)
where is_primary;

create table public.recruiting_applications (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete restrict,
  candidate_id uuid not null references public.recruiting_candidates(id) on delete restrict,
  current_stage text not null default 'new' check (
    current_stage in ('new', 'review', 'qualified', 'interview', 'offer', 'hired', 'closed')
  ),
  status text not null default 'active' check (
    status in ('active', 'withdrawn', 'rejected', 'hired', 'closed')
  ),
  disposition_code text,
  disposition_reason text check (
    disposition_reason is null or length(disposition_reason) <= 2000
  ),
  applied_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  row_version integer not null default 1 check (row_version > 0),
  created_by_person_id uuid references public.people(id) on delete set null,
  updated_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requisition_id, candidate_id),
  constraint recruiting_application_terminal_contract check (
    (current_stage = 'hired' and status = 'hired')
    or (current_stage <> 'hired' and status <> 'hired')
  )
);

create index recruiting_applications_pipeline_idx
on public.recruiting_applications(requisition_id, current_stage, last_activity_at);

create table public.recruiting_application_sources (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruiting_applications(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'career_site', 'referral', 'recruiter', 'job_board', 'agency',
      'event', 'kiosk', 'manual', 'other'
    )
  ),
  source_detail text,
  referrer_person_id uuid references public.people(id) on delete set null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index recruiting_application_primary_source_unique
on public.recruiting_application_sources(application_id)
where is_primary;

create table public.recruiting_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  application_id uuid references public.recruiting_applications(id) on delete set null,
  document_type text not null check (
    document_type in ('resume', 'cover_letter', 'portfolio', 'certification', 'offer', 'other')
  ),
  storage_bucket text not null default 'recruiting-resumes',
  storage_path text not null unique check (length(btrim(storage_path)) > 0),
  original_file_name text not null check (
    length(btrim(original_file_name)) between 1 and 255
  ),
  content_type text not null check (
    content_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  sha256 text not null check (length(sha256) = 64),
  scan_status text not null default 'pending' check (
    scan_status in ('pending', 'clean', 'infected', 'failed', 'not_configured')
  ),
  extraction_status text not null default 'pending' check (
    extraction_status in ('pending', 'ready', 'failed', 'not_configured', 'not_requested')
  ),
  human_review_status text not null default 'pending' check (
    human_review_status in ('pending', 'verified', 'rejected')
  ),
  retention_status text not null default 'active' check (
    retention_status in ('active', 'hold', 'queued_for_deletion', 'deleted')
  ),
  uploaded_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_stage_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruiting_applications(id) on delete restrict,
  from_stage text,
  to_stage text not null,
  reason text check (reason is null or length(reason) <= 2000),
  actor_person_id uuid not null references public.people(id) on delete restrict,
  occurred_at timestamptz not null default now()
);

create table public.recruiting_dispositions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruiting_applications(id) on delete restrict,
  disposition_code text not null check (
    disposition_code in (
      'advance', 'hold', 'not_qualified', 'evaluate_another_role',
      'withdrawn', 'hired', 'position_closed', 'duplicate'
    )
  ),
  reason text check (reason is null or length(reason) <= 2000),
  actor_person_id uuid not null references public.people(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  constraint recruiting_disposition_reason_required check (
    disposition_code not in ('not_qualified', 'withdrawn', 'position_closed')
    or length(btrim(coalesce(reason, ''))) > 0
  )
);

create table public.recruiting_activity_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.recruiting_candidates(id) on delete restrict,
  application_id uuid references public.recruiting_applications(id) on delete restrict,
  requisition_id uuid references public.recruiting_requisitions(id) on delete restrict,
  event_type text not null check (length(btrim(event_type)) between 1 and 120),
  summary text not null check (length(btrim(summary)) between 1 and 500),
  detail jsonb not null default '{}'::jsonb,
  visibility text not null default 'standard' check (
    visibility in ('standard', 'restricted', 'system')
  ),
  actor_person_id uuid not null references public.people(id) on delete restrict,
  occurred_at timestamptz not null default now()
);

create index recruiting_activity_application_idx
on public.recruiting_activity_events(application_id, occurred_at desc);

create table public.recruiting_tasks (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid references public.recruiting_requisitions(id) on delete cascade,
  candidate_id uuid references public.recruiting_candidates(id) on delete cascade,
  application_id uuid references public.recruiting_applications(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 240),
  task_type text not null default 'follow_up' check (
    task_type in (
      'review', 'follow_up', 'schedule', 'scorecard', 'approval',
      'offer', 'retention', 'provider_failure', 'other'
    )
  ),
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'completed', 'canceled')
  ),
  priority text not null default 'normal' check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  assigned_to_person_id uuid references public.people(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recruiting_task_parent check (
    requisition_id is not null or candidate_id is not null or application_id is not null
  ),
  constraint recruiting_task_completed_contract check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create index recruiting_tasks_attention_idx
on public.recruiting_tasks(assigned_to_person_id, status, due_at);

create table public.recruiting_command_receipts (
  id uuid primary key default gen_random_uuid(),
  actor_person_id uuid not null references public.people(id) on delete restrict,
  idempotency_key uuid not null,
  command_name text not null check (
    length(btrim(command_name)) between 1 and 120
  ),
  request_hash text not null check (length(btrim(request_hash)) >= 32),
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  unique (actor_person_id, idempotency_key)
);

create or replace function public.recruiting_validate_aggregate_links()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_candidate_id uuid := nullif(v_payload ->> 'candidate_id', '')::uuid;
  v_application_id uuid := nullif(v_payload ->> 'application_id', '')::uuid;
  v_requisition_id uuid := nullif(v_payload ->> 'requisition_id', '')::uuid;
  v_application public.recruiting_applications%rowtype;
begin
  if v_application_id is null then
    if v_candidate_id is not null
      and v_requisition_id is not null
      and not exists (
        select 1
        from public.recruiting_applications ra
        where ra.candidate_id = v_candidate_id
          and ra.requisition_id = v_requisition_id
      )
    then
      raise exception 'The candidate and requisition must be linked by a recruiting application.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select *
  into v_application
  from public.recruiting_applications
  where id = v_application_id;

  if not found then
    raise exception 'The linked recruiting application does not exist.'
      using errcode = '23503';
  end if;
  if v_candidate_id is not null and v_candidate_id <> v_application.candidate_id then
    raise exception 'The candidate and application must belong to the same recruiting aggregate.'
      using errcode = '23514';
  end if;
  if v_requisition_id is not null and v_requisition_id <> v_application.requisition_id then
    raise exception 'The requisition and application must belong to the same recruiting aggregate.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.current_recruiting_person_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_person_id();
$$;

create or replace function public.current_recruiting_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_is_app_admin()
    or exists (
      select 1
      from public.recruiting_user_roles rur
      where rur.person_id = public.current_person_id()
        and rur.role = 'recruiting_admin'
        and rur.is_active
    );
$$;

create or replace function public.current_recruiting_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.current_is_app_admin() then 'recruiting_admin'
    else (
      select rur.role
      from public.recruiting_user_roles rur
      where rur.person_id = public.current_person_id()
        and rur.is_active
      limit 1
    )
  end;
$$;

create or replace function public.current_can_access_recruiting_requisition(
  p_requisition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_recruiting_is_admin()
    or exists (
      select 1
      from public.recruiting_requisitions rr
      where rr.id = p_requisition_id
        and (
          (
            not rr.is_confidential
            and public.current_recruiting_role() in ('recruiter', 'executive')
          )
          or rr.recruiter_person_id = public.current_person_id()
          or rr.hiring_manager_person_id = public.current_person_id()
          or exists (
            select 1
            from public.recruiting_requisition_memberships rrm
            where rrm.requisition_id = rr.id
              and rrm.person_id = public.current_person_id()
          )
        )
    );
$$;

create or replace function public.current_can_manage_recruiting_requisition(
  p_requisition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_recruiting_is_admin()
    or exists (
      select 1
      from public.recruiting_requisitions rr
      where rr.id = p_requisition_id
        and (
          rr.recruiter_person_id = public.current_person_id()
          or (
            public.current_recruiting_role() = 'recruiter'
            and not rr.is_confidential
          )
          or exists (
            select 1
            from public.recruiting_requisition_memberships rrm
            where rrm.requisition_id = rr.id
              and rrm.person_id = public.current_person_id()
              and rrm.membership_role = 'recruiter'
          )
        )
    );
$$;

create or replace function public.current_can_access_recruiting_candidate(
  p_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_recruiting_is_admin()
    or exists (
      select 1
      from public.recruiting_applications ra
      where ra.candidate_id = p_candidate_id
        and public.current_can_access_recruiting_requisition(ra.requisition_id)
    );
$$;

create or replace function public.current_can_manage_recruiting_candidate(
  p_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_recruiting_is_admin()
    or exists (
      select 1
      from public.recruiting_applications ra
      where ra.candidate_id = p_candidate_id
        and public.current_can_manage_recruiting_requisition(ra.requisition_id)
    );
$$;

create or replace function public.current_can_access_recruiting_document(
  p_candidate_id uuid,
  p_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_application_id is not null then exists (
      select 1
      from public.recruiting_applications ra
      where ra.id = p_application_id
        and ra.candidate_id = p_candidate_id
        and public.current_can_access_recruiting_requisition(ra.requisition_id)
    )
    else (
      public.current_recruiting_role() in ('recruiting_admin', 'recruiter')
      and public.current_can_access_recruiting_candidate(p_candidate_id)
    )
  end;
$$;

create or replace function public.current_can_manage_recruiting_document(
  p_candidate_id uuid,
  p_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_recruiting_role() in ('recruiting_admin', 'recruiter')
    and case
      when p_application_id is not null then exists (
        select 1
        from public.recruiting_applications ra
        where ra.id = p_application_id
          and ra.candidate_id = p_candidate_id
          and public.current_can_manage_recruiting_requisition(ra.requisition_id)
      )
      else public.current_can_manage_recruiting_candidate(p_candidate_id)
    end;
$$;

create or replace function public.recruiting_stage_transition_allowed(
  p_from_stage text,
  p_to_stage text
)
returns boolean
language sql
immutable
as $$
  select case p_from_stage
    when 'new' then p_to_stage in ('review', 'closed')
    when 'review' then p_to_stage in ('new', 'qualified', 'closed')
    when 'qualified' then p_to_stage in ('review', 'interview', 'closed')
    when 'interview' then p_to_stage in ('qualified', 'offer', 'closed')
    when 'offer' then p_to_stage in ('interview', 'hired', 'closed')
    when 'hired' then false
    when 'closed' then p_to_stage in ('review')
    else false
  end;
$$;

create or replace function public.recruiting_seed_default_stages()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.recruiting_stage_definitions (
    requisition_id, stage_key, label, position, is_terminal, requires_disposition
  )
  values
    (new.id, 'new', 'New', 0, false, false),
    (new.id, 'review', 'Review', 1, false, false),
    (new.id, 'qualified', 'Qualified', 2, false, false),
    (new.id, 'interview', 'Interview', 3, false, false),
    (new.id, 'offer', 'Offer', 4, false, false),
    (new.id, 'hired', 'Hired', 5, true, false),
    (new.id, 'closed', 'Closed', 6, true, true);
  return new;
end;
$$;

create trigger recruiting_requisition_default_stages
after insert on public.recruiting_requisitions
for each row execute function public.recruiting_seed_default_stages();

create or replace function public.recruiting_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recruiting_requisitions_touch
before update on public.recruiting_requisitions
for each row execute function public.recruiting_touch_updated_at();
create trigger recruiting_candidates_touch
before update on public.recruiting_candidates
for each row execute function public.recruiting_touch_updated_at();
create trigger recruiting_candidate_contacts_touch
before update on public.recruiting_candidate_contacts
for each row execute function public.recruiting_touch_updated_at();
create trigger recruiting_applications_touch
before update on public.recruiting_applications
for each row execute function public.recruiting_touch_updated_at();
create trigger recruiting_documents_touch
before update on public.recruiting_documents
for each row execute function public.recruiting_touch_updated_at();
create trigger recruiting_tasks_touch
before update on public.recruiting_tasks
for each row execute function public.recruiting_touch_updated_at();
create trigger recruiting_documents_validate_aggregate
before insert or update on public.recruiting_documents
for each row execute function public.recruiting_validate_aggregate_links();
create trigger recruiting_activity_validate_aggregate
before insert or update on public.recruiting_activity_events
for each row execute function public.recruiting_validate_aggregate_links();
create trigger recruiting_tasks_validate_aggregate
before insert or update on public.recruiting_tasks
for each row execute function public.recruiting_validate_aggregate_links();

create or replace function public.recruiting_application_has_accepted_offer(
  p_application_id uuid
)
returns boolean
language sql
stable
as $$
  select false;
$$;

create or replace function public.recruiting_transition_application(
  p_application_id uuid,
  p_to_stage text,
  p_expected_row_version integer,
  p_reason text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.current_person_id();
  v_application public.recruiting_applications%rowtype;
  v_receipt public.recruiting_command_receipts%rowtype;
  v_from_stage text;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(btrim(coalesce(p_request_hash, ''))) < 32 then
    raise exception 'A valid idempotency key and request hash are required.'
      using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
  );

  select *
  into v_receipt
  from public.recruiting_command_receipts
  where actor_person_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    if v_receipt.request_hash <> p_request_hash
      or v_receipt.command_name <> 'application.transition'
    then
      raise exception 'The idempotency key was already used for a different command.'
        using errcode = '23505';
    end if;
    return v_receipt.response_body || jsonb_build_object('replayed', true);
  end if;

  select *
  into v_application
  from public.recruiting_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'The recruiting application was not found.'
      using errcode = 'P0002';
  end if;
  if not public.current_can_manage_recruiting_requisition(v_application.requisition_id) then
    raise exception 'Recruiting write access is required.'
      using errcode = '42501';
  end if;
  if v_application.row_version <> p_expected_row_version then
    raise exception 'The application changed since it was loaded. Reload and review it.'
      using errcode = '40001';
  end if;
  if not public.recruiting_stage_transition_allowed(
    v_application.current_stage,
    p_to_stage
  ) then
    raise exception 'The requested recruiting stage transition is not allowed.'
      using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.recruiting_stage_definitions rsd
    where rsd.requisition_id = v_application.requisition_id
      and rsd.stage_key = p_to_stage
  ) then
    raise exception 'The destination stage is not configured for this requisition.'
      using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.recruiting_stage_definitions rsd
    where rsd.requisition_id = v_application.requisition_id
      and rsd.stage_key = p_to_stage
      and rsd.requires_disposition
  ) then
    raise exception 'This destination requires a disposition. Use the disposition action instead.'
      using errcode = '23514';
  end if;
  if p_to_stage = 'closed' then
    raise exception 'Closing an application requires a disposition action.'
      using errcode = '23514';
  end if;
  if p_to_stage = 'hired'
    and not public.recruiting_application_has_accepted_offer(v_application.id)
  then
    raise exception 'Hiring requires an accepted offer for this application.'
      using errcode = '23514';
  end if;

  v_from_stage := v_application.current_stage;

  update public.recruiting_applications
  set
    current_stage = p_to_stage,
    status = case
      when p_to_stage = 'hired' then 'hired'
      when p_to_stage = 'closed' then 'closed'
      else 'active'
    end,
    last_activity_at = now(),
    updated_by_person_id = v_actor,
    row_version = row_version + 1
  where id = p_application_id
  returning * into v_application;

  insert into public.recruiting_stage_events (
    application_id, from_stage, to_stage, reason, actor_person_id
  )
  values (
    p_application_id,
    v_from_stage,
    p_to_stage,
    nullif(btrim(coalesce(p_reason, '')), ''),
    v_actor
  );

  -- Use the immutable activity ledger as the human-readable source of truth.
  insert into public.recruiting_activity_events (
    candidate_id,
    application_id,
    requisition_id,
    event_type,
    summary,
    detail,
    actor_person_id
  )
  values (
    v_application.candidate_id,
    v_application.id,
    v_application.requisition_id,
    'application.stage_changed',
    format('Application moved to %s.', p_to_stage),
    jsonb_build_object('toStage', p_to_stage, 'reason', p_reason),
    v_actor
  );

  v_response := jsonb_build_object(
    'applicationId', v_application.id,
    'stage', v_application.current_stage,
    'rowVersion', v_application.row_version,
    'replayed', false
  );

  insert into public.recruiting_command_receipts (
    actor_person_id,
    idempotency_key,
    command_name,
    request_hash,
    response_body
  )
  values (
    v_actor,
    p_idempotency_key,
    'application.transition',
    p_request_hash,
    v_response
  );

  return v_response;
end;
$$;

create or replace function public.recruiting_set_application_disposition(
  p_application_id uuid,
  p_disposition_code text,
  p_reason text,
  p_expected_row_version integer,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.current_person_id();
  v_application public.recruiting_applications%rowtype;
  v_receipt public.recruiting_command_receipts%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_disposition_code not in (
    'advance', 'hold', 'not_qualified', 'evaluate_another_role',
    'withdrawn', 'hired', 'position_closed', 'duplicate'
  ) then
    raise exception 'The requested recruiting disposition is not allowed.'
      using errcode = '23514';
  end if;
  if p_disposition_code in ('not_qualified', 'withdrawn', 'position_closed')
    and v_reason is null
  then
    raise exception 'A reason is required for this recruiting disposition.'
      using errcode = '23514';
  end if;
  if p_idempotency_key is null or length(btrim(coalesce(p_request_hash, ''))) < 32 then
    raise exception 'A valid idempotency key and request hash are required.'
      using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
  );

  select *
  into v_receipt
  from public.recruiting_command_receipts
  where actor_person_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    if v_receipt.request_hash <> p_request_hash
      or v_receipt.command_name <> 'application.disposition'
    then
      raise exception 'The idempotency key was already used for a different command.'
        using errcode = '23505';
    end if;
    return v_receipt.response_body || jsonb_build_object('replayed', true);
  end if;

  select *
  into v_application
  from public.recruiting_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'The recruiting application was not found.'
      using errcode = 'P0002';
  end if;
  if not public.current_can_manage_recruiting_requisition(v_application.requisition_id) then
    raise exception 'Recruiting write access is required.'
      using errcode = '42501';
  end if;
  if v_application.row_version <> p_expected_row_version then
    raise exception 'The application changed since it was loaded. Reload and review it.'
      using errcode = '40001';
  end if;
  if p_disposition_code = 'hired' and (
    v_application.current_stage <> 'offer'
    or not public.recruiting_application_has_accepted_offer(v_application.id)
  ) then
    raise exception 'Hiring requires an offer-stage application with an accepted offer.'
      using errcode = '23514';
  end if;

  update public.recruiting_applications
  set
    disposition_code = p_disposition_code,
    disposition_reason = v_reason,
    status = case p_disposition_code
      when 'withdrawn' then 'withdrawn'
      when 'not_qualified' then 'rejected'
      when 'position_closed' then 'closed'
      when 'hired' then 'hired'
      else status
    end,
    current_stage = case p_disposition_code
      when 'withdrawn' then 'closed'
      when 'not_qualified' then 'closed'
      when 'position_closed' then 'closed'
      when 'hired' then 'hired'
      else current_stage
    end,
    last_activity_at = now(),
    updated_by_person_id = v_actor,
    row_version = row_version + 1
  where id = p_application_id
  returning * into v_application;

  insert into public.recruiting_dispositions (
    application_id, disposition_code, reason, actor_person_id
  )
  values (p_application_id, p_disposition_code, v_reason, v_actor);

  insert into public.recruiting_activity_events (
    candidate_id,
    application_id,
    requisition_id,
    event_type,
    summary,
    detail,
    actor_person_id
  )
  values (
    v_application.candidate_id,
    v_application.id,
    v_application.requisition_id,
    'application.disposition_changed',
    format('Application disposition changed to %s.', p_disposition_code),
    jsonb_build_object('dispositionCode', p_disposition_code, 'reason', v_reason),
    v_actor
  );

  v_response := jsonb_build_object(
    'applicationId', v_application.id,
    'stage', v_application.current_stage,
    'status', v_application.status,
    'dispositionCode', v_application.disposition_code,
    'rowVersion', v_application.row_version,
    'replayed', false
  );

  insert into public.recruiting_command_receipts (
    actor_person_id,
    idempotency_key,
    command_name,
    request_hash,
    response_body
  )
  values (
    v_actor,
    p_idempotency_key,
    'application.disposition',
    p_request_hash,
    v_response
  );

  return v_response;
end;
$$;

create or replace function public.recruiting_create_requisition(
  p_requisition_number text,
  p_title text,
  p_department text,
  p_location text,
  p_jobsite text,
  p_headcount integer,
  p_is_confidential boolean,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.current_person_id();
  v_receipt public.recruiting_command_receipts%rowtype;
  v_requisition public.recruiting_requisitions%rowtype;
  v_response jsonb;
begin
  if v_actor is null
    or coalesce(public.current_recruiting_role(), '') not in ('recruiting_admin', 'recruiter')
  then
    raise exception 'Recruiting write access is required.' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(btrim(coalesce(p_request_hash, ''))) < 32 then
    raise exception 'A valid idempotency key and request hash are required.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_receipt
  from public.recruiting_command_receipts
  where actor_person_id = v_actor and idempotency_key = p_idempotency_key;
  if found then
    if v_receipt.request_hash <> p_request_hash or v_receipt.command_name <> 'requisition.create' then
      raise exception 'The idempotency key was already used for a different command.' using errcode = '23505';
    end if;
    return v_receipt.response_body || jsonb_build_object('replayed', true);
  end if;

  insert into public.recruiting_requisitions (
    requisition_number, title, department, location_name, jobsite_name,
    headcount, is_confidential, status, recruiter_person_id, created_by_person_id
  )
  values (
    btrim(p_requisition_number), btrim(p_title), nullif(btrim(coalesce(p_department, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_jobsite, '')), ''),
    p_headcount, p_is_confidential, 'draft', v_actor, v_actor
  )
  returning * into v_requisition;

  v_response := jsonb_build_object(
    'requisitionId', v_requisition.id,
    'requisitionNumber', v_requisition.requisition_number,
    'title', v_requisition.title,
    'status', v_requisition.status,
    'rowVersion', v_requisition.row_version,
    'replayed', false
  );
  insert into public.recruiting_command_receipts (
    actor_person_id, idempotency_key, command_name, request_hash, response_body
  ) values (v_actor, p_idempotency_key, 'requisition.create', p_request_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.recruiting_create_task(
  p_requisition_id uuid,
  p_candidate_id uuid,
  p_application_id uuid,
  p_title text,
  p_task_type text,
  p_priority text,
  p_due_at timestamptz,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.current_person_id();
  v_receipt public.recruiting_command_receipts%rowtype;
  v_task public.recruiting_tasks%rowtype;
  v_response jsonb;
begin
  if v_actor is null or not public.current_can_manage_recruiting_requisition(p_requisition_id) then
    raise exception 'Recruiting write access is required.' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(btrim(coalesce(p_request_hash, ''))) < 32 then
    raise exception 'A valid idempotency key and request hash are required.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_receipt
  from public.recruiting_command_receipts
  where actor_person_id = v_actor and idempotency_key = p_idempotency_key;
  if found then
    if v_receipt.request_hash <> p_request_hash or v_receipt.command_name <> 'task.create' then
      raise exception 'The idempotency key was already used for a different command.' using errcode = '23505';
    end if;
    return v_receipt.response_body || jsonb_build_object('replayed', true);
  end if;

  insert into public.recruiting_tasks (
    requisition_id, candidate_id, application_id, title, task_type, priority,
    due_at, status, assigned_to_person_id, created_by_person_id
  )
  values (
    p_requisition_id, p_candidate_id, p_application_id, btrim(p_title),
    p_task_type, p_priority, p_due_at, 'open', v_actor, v_actor
  )
  returning * into v_task;

  v_response := jsonb_build_object(
    'taskId', v_task.id, 'status', v_task.status, 'replayed', false
  );
  insert into public.recruiting_command_receipts (
    actor_person_id, idempotency_key, command_name, request_hash, response_body
  ) values (v_actor, p_idempotency_key, 'task.create', p_request_hash, v_response);
  return v_response;
end;
$$;

-- Row-level security is enabled before any application grants are issued.
alter table public.recruiting_settings enable row level security;
alter table public.recruiting_user_roles enable row level security;
alter table public.recruiting_requisitions enable row level security;
alter table public.recruiting_requisition_memberships enable row level security;
alter table public.recruiting_stage_definitions enable row level security;
alter table public.recruiting_candidates enable row level security;
alter table public.recruiting_candidate_contacts enable row level security;
alter table public.recruiting_applications enable row level security;
alter table public.recruiting_application_sources enable row level security;
alter table public.recruiting_documents enable row level security;
alter table public.recruiting_stage_events enable row level security;
alter table public.recruiting_dispositions enable row level security;
alter table public.recruiting_activity_events enable row level security;
alter table public.recruiting_tasks enable row level security;
alter table public.recruiting_command_receipts enable row level security;

create policy recruiting_settings_read
on public.recruiting_settings for select
to authenticated
using (public.current_recruiting_role() is not null);
create policy recruiting_settings_admin
on public.recruiting_settings for all
to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());

create policy recruiting_user_roles_read
on public.recruiting_user_roles for select
to authenticated
using (
  person_id = public.current_person_id()
  or public.current_recruiting_is_admin()
);
create policy recruiting_user_roles_admin
on public.recruiting_user_roles for all
to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());

create policy recruiting_requisitions_read
on public.recruiting_requisitions for select
to authenticated
using (public.current_can_access_recruiting_requisition(id));
create policy recruiting_requisitions_insert
on public.recruiting_requisitions for insert
to authenticated
with check (
  public.current_recruiting_is_admin()
  or (
    public.current_recruiting_role() = 'recruiter'
    and created_by_person_id = public.current_person_id()
  )
);
create policy recruiting_requisitions_update
on public.recruiting_requisitions for update
to authenticated
using (public.current_can_manage_recruiting_requisition(id))
with check (public.current_can_manage_recruiting_requisition(id));

create policy recruiting_memberships_read
on public.recruiting_requisition_memberships for select
to authenticated
using (public.current_can_access_recruiting_requisition(requisition_id));
create policy recruiting_memberships_write
on public.recruiting_requisition_memberships for all
to authenticated
using (public.current_can_manage_recruiting_requisition(requisition_id))
with check (public.current_can_manage_recruiting_requisition(requisition_id));

create policy recruiting_stages_read
on public.recruiting_stage_definitions for select
to authenticated
using (public.current_can_access_recruiting_requisition(requisition_id));
create policy recruiting_stages_write
on public.recruiting_stage_definitions for all
to authenticated
using (public.current_can_manage_recruiting_requisition(requisition_id))
with check (public.current_can_manage_recruiting_requisition(requisition_id));

create policy recruiting_candidates_read
on public.recruiting_candidates for select
to authenticated
using (public.current_can_access_recruiting_candidate(id));
create policy recruiting_candidates_insert
on public.recruiting_candidates for insert
to authenticated
with check (
  (
    public.current_recruiting_is_admin()
    or public.current_recruiting_role() = 'recruiter'
  )
  and candidate_status in ('active', 'prospect')
  and merged_into_candidate_id is null
  and row_version = 1
);
create policy recruiting_candidates_update
on public.recruiting_candidates for update
to authenticated
using (public.current_can_manage_recruiting_candidate(id))
with check (public.current_can_manage_recruiting_candidate(id));

create policy recruiting_contacts_read
on public.recruiting_candidate_contacts for select
to authenticated
using (public.current_can_access_recruiting_candidate(candidate_id));
create policy recruiting_contacts_write
on public.recruiting_candidate_contacts for insert
to authenticated
with check (
  public.current_can_manage_recruiting_candidate(candidate_id)
  and consent_status = 'unknown'
  and not is_verified
  and (
    public.current_recruiting_is_admin()
    or public.current_recruiting_role() = 'recruiter'
  )
);

create policy recruiting_applications_read
on public.recruiting_applications for select
to authenticated
using (public.current_can_access_recruiting_requisition(requisition_id));
create policy recruiting_applications_insert
on public.recruiting_applications for insert
to authenticated
with check (public.current_can_manage_recruiting_requisition(requisition_id));
create policy recruiting_applications_update
on public.recruiting_applications for update
to authenticated
using (public.current_can_manage_recruiting_requisition(requisition_id))
with check (public.current_can_manage_recruiting_requisition(requisition_id));

create policy recruiting_sources_read
on public.recruiting_application_sources for select
to authenticated
using (
  exists (
    select 1 from public.recruiting_applications ra
    where ra.id = application_id
      and public.current_can_access_recruiting_requisition(ra.requisition_id)
  )
);
create policy recruiting_sources_write
on public.recruiting_application_sources for all
to authenticated
using (
  exists (
    select 1 from public.recruiting_applications ra
    where ra.id = application_id
      and public.current_can_manage_recruiting_requisition(ra.requisition_id)
  )
)
with check (
  exists (
    select 1 from public.recruiting_applications ra
    where ra.id = application_id
      and public.current_can_manage_recruiting_requisition(ra.requisition_id)
  )
);

create policy recruiting_documents_read
on public.recruiting_documents for select
to authenticated
using (
  document_type <> 'offer'
  and public.current_can_access_recruiting_document(candidate_id, application_id)
);
create policy recruiting_documents_insert
on public.recruiting_documents for insert
to authenticated
with check (
  document_type <> 'offer'
  and scan_status = 'pending'
  and extraction_status = 'pending'
  and human_review_status = 'pending'
  and retention_status = 'active'
  and uploaded_by_person_id = public.current_person_id()
  and public.current_can_manage_recruiting_document(candidate_id, application_id)
  and exists (
    select 1 from public.recruiting_settings
    where key = 'resume_upload_enabled' and value = 'true'::jsonb
  )
  and exists (
    select 1 from public.recruiting_settings
    where key = 'resume_scanner_verified' and value = 'true'::jsonb
  )
);

create policy recruiting_stage_events_read
on public.recruiting_stage_events for select
to authenticated
using (
  exists (
    select 1 from public.recruiting_applications ra
    where ra.id = application_id
      and public.current_can_access_recruiting_requisition(ra.requisition_id)
  )
);
create policy recruiting_stage_events_insert
on public.recruiting_stage_events for insert
to authenticated
with check (
  actor_person_id = public.current_person_id()
  and exists (
    select 1 from public.recruiting_applications ra
    where ra.id = application_id
      and public.current_can_manage_recruiting_requisition(ra.requisition_id)
  )
);

create policy recruiting_dispositions_read
on public.recruiting_dispositions for select
to authenticated
using (
  exists (
    select 1 from public.recruiting_applications ra
    where ra.id = application_id
      and public.current_can_access_recruiting_requisition(ra.requisition_id)
  )
);
create policy recruiting_dispositions_insert
on public.recruiting_dispositions for insert
to authenticated
with check (
  actor_person_id = public.current_person_id()
  and exists (
    select 1 from public.recruiting_applications ra
    where ra.id = application_id
      and public.current_can_manage_recruiting_requisition(ra.requisition_id)
  )
);

create policy recruiting_activity_events_read
on public.recruiting_activity_events for select
to authenticated
using (
  (
    visibility = 'standard'
    or public.current_recruiting_role() in ('recruiting_admin', 'recruiter')
  )
  and requisition_id is not null
  and public.current_can_access_recruiting_requisition(requisition_id)
);
create policy recruiting_activity_events_insert
on public.recruiting_activity_events for insert
to authenticated
with check (
  actor_person_id = public.current_person_id()
  and requisition_id is not null
  and public.current_can_manage_recruiting_requisition(requisition_id)
);

create policy recruiting_tasks_read
on public.recruiting_tasks for select
to authenticated
using (
  assigned_to_person_id = public.current_person_id()
  or (
    requisition_id is not null
    and public.current_can_access_recruiting_requisition(requisition_id)
  )
);
create policy recruiting_tasks_write
on public.recruiting_tasks for all
to authenticated
using (
  assigned_to_person_id = public.current_person_id()
  or (
    requisition_id is not null
    and public.current_can_manage_recruiting_requisition(requisition_id)
  )
)
with check (
  assigned_to_person_id = public.current_person_id()
  or (
    requisition_id is not null
    and public.current_can_manage_recruiting_requisition(requisition_id)
  )
);

create policy recruiting_command_receipts_read
on public.recruiting_command_receipts for select
to authenticated
using (actor_person_id = public.current_person_id());
create policy recruiting_command_receipts_insert
on public.recruiting_command_receipts for insert
to authenticated
with check (actor_person_id = public.current_person_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recruiting-resumes',
  'recruiting-resumes',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy recruiting_resume_objects_read
on storage.objects for select
to authenticated
using (
  bucket_id = 'recruiting-resumes'
  and exists (
    select 1
    from public.recruiting_documents rd
    where rd.storage_bucket = bucket_id
      and rd.storage_path = name
      and rd.retention_status <> 'deleted'
      and rd.scan_status = 'clean'
      and rd.document_type <> 'offer'
      and public.current_can_access_recruiting_document(
        rd.candidate_id,
        rd.application_id
      )
  )
);

create policy recruiting_resume_objects_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'recruiting-resumes'
  and exists (
    select 1
    from public.recruiting_documents rd
    where rd.storage_bucket = bucket_id
      and rd.storage_path = name
      and rd.scan_status = 'pending'
      and rd.document_type <> 'offer'
      and exists (
        select 1 from public.recruiting_settings
        where key = 'resume_upload_enabled' and value = 'true'::jsonb
      )
      and exists (
        select 1 from public.recruiting_settings
        where key = 'resume_scanner_verified' and value = 'true'::jsonb
      )
      and public.current_can_manage_recruiting_document(
        rd.candidate_id,
        rd.application_id
      )
  )
);

create policy recruiting_resume_objects_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'recruiting-resumes'
  and exists (
    select 1
    from public.recruiting_documents rd
    where rd.storage_bucket = bucket_id
      and rd.storage_path = name
      and public.current_recruiting_is_admin()
  )
);

revoke all on function public.current_recruiting_person_id() from public, anon;
revoke all on function public.current_recruiting_is_admin() from public, anon;
revoke all on function public.current_recruiting_role() from public, anon;
revoke all on function public.current_can_access_recruiting_requisition(uuid) from public, anon;
revoke all on function public.current_can_manage_recruiting_requisition(uuid) from public, anon;
revoke all on function public.current_can_access_recruiting_candidate(uuid) from public, anon;
revoke all on function public.current_can_manage_recruiting_candidate(uuid) from public, anon;
revoke all on function public.recruiting_transition_application(uuid, text, integer, text, uuid, text) from public, anon;
revoke all on function public.recruiting_set_application_disposition(uuid, text, text, integer, uuid, text) from public, anon;
revoke all on function public.recruiting_create_requisition(text, text, text, text, text, integer, boolean, uuid, text) from public, anon;
revoke all on function public.recruiting_create_task(uuid, uuid, uuid, text, text, text, timestamptz, uuid, text) from public, anon;
revoke all on function public.current_can_access_recruiting_document(uuid, uuid) from public, anon;
revoke all on function public.current_can_manage_recruiting_document(uuid, uuid) from public, anon;
revoke all on function public.recruiting_application_has_accepted_offer(uuid) from public, anon, authenticated;

grant execute on function public.current_recruiting_person_id() to authenticated, service_role;
grant execute on function public.current_recruiting_is_admin() to authenticated, service_role;
grant execute on function public.current_recruiting_role() to authenticated, service_role;
grant execute on function public.current_can_access_recruiting_requisition(uuid) to authenticated, service_role;
grant execute on function public.current_can_manage_recruiting_requisition(uuid) to authenticated, service_role;
grant execute on function public.current_can_access_recruiting_candidate(uuid) to authenticated, service_role;
grant execute on function public.current_can_manage_recruiting_candidate(uuid) to authenticated, service_role;
grant execute on function public.recruiting_transition_application(uuid, text, integer, text, uuid, text) to authenticated, service_role;
grant execute on function public.recruiting_set_application_disposition(uuid, text, text, integer, uuid, text) to authenticated, service_role;
grant execute on function public.recruiting_create_requisition(text, text, text, text, text, integer, boolean, uuid, text) to authenticated, service_role;
grant execute on function public.recruiting_create_task(uuid, uuid, uuid, text, text, text, timestamptz, uuid, text) to authenticated, service_role;
grant execute on function public.current_can_access_recruiting_document(uuid, uuid) to authenticated, service_role;
grant execute on function public.current_can_manage_recruiting_document(uuid, uuid) to authenticated, service_role;

revoke all on table public.recruiting_settings from public, anon, authenticated;
revoke all on table public.recruiting_user_roles from public, anon, authenticated;
revoke all on table public.recruiting_requisitions from public, anon, authenticated;
revoke all on table public.recruiting_requisition_memberships from public, anon, authenticated;
revoke all on table public.recruiting_stage_definitions from public, anon, authenticated;
revoke all on table public.recruiting_candidates from public, anon, authenticated;
revoke all on table public.recruiting_candidate_contacts from public, anon, authenticated;
revoke all on table public.recruiting_applications from public, anon, authenticated;
revoke all on table public.recruiting_application_sources from public, anon, authenticated;
revoke all on table public.recruiting_documents from public, anon, authenticated;
revoke all on table public.recruiting_stage_events from public, anon, authenticated;
revoke all on table public.recruiting_dispositions from public, anon, authenticated;
revoke all on table public.recruiting_activity_events from public, anon, authenticated;
revoke all on table public.recruiting_tasks from public, anon, authenticated;
revoke all on table public.recruiting_command_receipts from public, anon, authenticated;

grant select, insert, update on public.recruiting_settings to authenticated;
grant select, insert, update, delete on public.recruiting_user_roles to authenticated;
grant select (
  id, requisition_number, title, department, employment_type, workplace_type,
  location_name, jobsite_name, hiring_manager_person_id, recruiter_person_id,
  headcount, target_start_date, description, status, is_confidential,
  row_version, created_by_person_id, updated_by_person_id, opened_at, closed_at,
  created_at, updated_at
) on public.recruiting_requisitions to authenticated;
grant select, insert, update, delete on public.recruiting_requisition_memberships to authenticated;
grant select on public.recruiting_stage_definitions to authenticated;
grant select, insert on public.recruiting_candidates to authenticated;
grant select, insert on public.recruiting_candidate_contacts to authenticated;
grant select on public.recruiting_applications to authenticated;
grant select, insert, update, delete on public.recruiting_application_sources to authenticated;
grant select, insert on public.recruiting_documents to authenticated;
grant select on public.recruiting_stage_events to authenticated;
grant select on public.recruiting_dispositions to authenticated;
grant select on public.recruiting_activity_events to authenticated;
grant select, insert, update, delete on public.recruiting_tasks to authenticated;
grant select on public.recruiting_command_receipts to authenticated;

commit;
