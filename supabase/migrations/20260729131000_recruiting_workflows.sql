-- Applicant Tracker workflow expansion: requisition approval, intake evidence,
-- communication/scheduling, interviews, scorecards, offers, talent CRM, and
-- construction qualifications. External delivery remains disabled by default.

begin;

create or replace function public.current_can_access_recruiting_application(
  p_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.recruiting_applications ra
    where ra.id = p_application_id
      and public.current_can_access_recruiting_requisition(ra.requisition_id)
  );
$$;

create or replace function public.current_can_manage_recruiting_application(
  p_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.recruiting_applications ra
    where ra.id = p_application_id
      and public.current_can_manage_recruiting_requisition(ra.requisition_id)
  );
$$;

create or replace function public.current_can_access_sensitive_recruiting_application(
  p_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (
      public.current_recruiting_role() in ('recruiting_admin', 'recruiter')
      and public.current_can_access_recruiting_application(p_application_id)
    )
    or exists (
      select 1
      from public.recruiting_applications ra
      join public.recruiting_requisitions rr on rr.id = ra.requisition_id
      where ra.id = p_application_id
        and (
          rr.hiring_manager_person_id = public.current_person_id()
          or exists (
            select 1
            from public.recruiting_requisition_memberships rrm
            where rrm.requisition_id = rr.id
              and rrm.person_id = public.current_person_id()
              and rrm.can_view_compensation
          )
        )
    );
$$;

create or replace function public.recruiting_validate_evidence_document()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_document_candidate_id uuid;
begin
  select candidate_id into v_document_candidate_id
  from public.recruiting_documents
  where id = new.document_id;
  if v_document_candidate_id is distinct from new.candidate_id then
    raise exception 'The evidence fact and document must belong to the same candidate.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.recruiting_validate_onboarding_handoff()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.recruiting_offers ro
    where ro.id = new.offer_id
      and ro.application_id = new.application_id
  ) then
    raise exception 'The onboarding handoff offer must belong to its application.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create table public.recruiting_requisition_approvals (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete cascade,
  sequence integer not null check (sequence between 1 and 20),
  approver_person_id uuid not null references public.people(id) on delete restrict,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'canceled')
  ),
  decision_reason text check (
    decision_reason is null or length(decision_reason) <= 2000
  ),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (requisition_id, sequence),
  unique (requisition_id, approver_person_id),
  constraint recruiting_requisition_approval_decision_contract check (
    (status = 'pending' and decided_at is null and decision_reason is null)
    or (status = 'approved' and decided_at is not null)
    or (
      status = 'rejected'
      and decided_at is not null
      and length(btrim(coalesce(decision_reason, ''))) > 0
    )
    or status = 'canceled'
  )
);

create table public.recruiting_consents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  application_id uuid references public.recruiting_applications(id) on delete cascade,
  consent_type text not null check (
    consent_type in ('privacy_notice', 'email', 'sms', 'talent_pool', 'recording')
  ),
  status text not null check (status in ('granted', 'denied', 'withdrawn')),
  policy_version text not null check (length(btrim(policy_version)) between 1 and 100),
  source text not null check (
    source in ('application', 'candidate_portal', 'recruiter_recorded', 'provider')
  ),
  captured_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  captured_by_person_id uuid references public.people(id) on delete set null
);

create index recruiting_consents_candidate_idx
on public.recruiting_consents(candidate_id, consent_type, captured_at desc);

create table public.recruiting_evidence_facts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.recruiting_documents(id) on delete cascade,
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  fact_type text not null check (
    fact_type in (
      'employment', 'education', 'certification', 'skill', 'location',
      'contact', 'summary', 'other'
    )
  ),
  field_name text not null check (length(btrim(field_name)) between 1 and 120),
  value_text text not null check (length(btrim(value_text)) between 1 and 4000),
  source_locator jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  review_status text not null default 'pending' check (
    review_status in ('pending', 'verified', 'corrected', 'rejected')
  ),
  reviewed_by_person_id uuid references public.people(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recruiting_duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  possible_duplicate_candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  match_reasons jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'not_duplicate', 'merge_approved', 'merged')
  ),
  reviewed_by_person_id uuid references public.people(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (candidate_id <> possible_duplicate_candidate_id),
  unique (candidate_id, possible_duplicate_candidate_id)
);

create table public.recruiting_message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 160),
  channel text not null check (channel in ('email', 'sms')),
  subject_template text,
  body_template text not null check (length(btrim(body_template)) between 1 and 20000),
  purpose text not null check (
    purpose in (
      'application_received', 'scheduling', 'follow_up', 'rejection',
      'offer', 'talent_pool', 'other'
    )
  ),
  is_active boolean not null default true,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  updated_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_messages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete restrict,
  application_id uuid references public.recruiting_applications(id) on delete set null,
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete restrict,
  template_id uuid references public.recruiting_message_templates(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text,
  body_text text not null check (length(btrim(body_text)) between 1 and 20000),
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'queued', 'sent', 'delivered', 'failed', 'canceled')
  ),
  provider_message_id text,
  approved_by_person_id uuid references public.people(id) on delete set null,
  sent_by_person_id uuid references public.people(id) on delete set null,
  sent_at timestamptz,
  created_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_provider_attempts (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete restrict,
  candidate_id uuid references public.recruiting_candidates(id) on delete restrict,
  application_id uuid references public.recruiting_applications(id) on delete restrict,
  provider_kind text not null check (
    provider_kind in ('microsoft_mail', 'microsoft_calendar', 'sms', 'esignature', 'resume_scanner', 'resume_extractor')
  ),
  operation text not null check (length(btrim(operation)) between 1 and 120),
  idempotency_key uuid not null,
  request_hash text not null check (length(btrim(request_hash)) >= 32),
  status text not null default 'pending' check (
    status in ('pending', 'claimed', 'succeeded', 'retryable_failed', 'permanent_failed', 'canceled', 'disabled')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  provider_external_id text,
  safe_error_code text,
  safe_error_message text,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_kind, idempotency_key)
);

create index recruiting_provider_dispatch_idx
on public.recruiting_provider_attempts(status, next_attempt_at, created_at);

create table public.recruiting_availability_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruiting_applications(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) >= 32),
  time_zone text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  status text not null default 'open' check (
    status in ('open', 'submitted', 'expired', 'canceled')
  ),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (window_end > window_start),
  check (expires_at > created_at)
);

create table public.recruiting_interview_plans (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  description text,
  position integer not null check (position between 0 and 100),
  is_active boolean not null default true,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requisition_id, position)
);

create table public.recruiting_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruiting_applications(id) on delete cascade,
  interview_plan_id uuid references public.recruiting_interview_plans(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  interview_type text not null check (
    interview_type in ('phone', 'video', 'onsite', 'panel', 'assessment')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'scheduling', 'scheduled', 'completed', 'canceled', 'no_show')
  ),
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text,
  location_text text,
  organizer_person_id uuid references public.people(id) on delete restrict,
  graph_event_id text,
  teams_join_url text,
  row_version integer not null default 1 check (row_version > 0),
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

create table public.recruiting_interview_participants (
  interview_id uuid not null references public.recruiting_interviews(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  participant_role text not null check (
    participant_role in ('interviewer', 'observer', 'organizer')
  ),
  scorecard_required boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (interview_id, person_id)
);

create table public.recruiting_scorecard_templates (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete cascade,
  interview_plan_id uuid references public.recruiting_interview_plans(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  criteria jsonb not null check (jsonb_typeof(criteria) = 'array'),
  is_active boolean not null default true,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_scorecard_submissions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.recruiting_interviews(id) on delete cascade,
  template_id uuid not null references public.recruiting_scorecard_templates(id) on delete restrict,
  interviewer_person_id uuid not null references public.people(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  responses jsonb not null default '[]'::jsonb check (jsonb_typeof(responses) = 'array'),
  overall_recommendation text check (
    overall_recommendation is null
    or overall_recommendation in ('strong_no', 'no', 'mixed', 'yes', 'strong_yes')
  ),
  submitted_at timestamptz,
  row_version integer not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, interviewer_person_id),
  constraint recruiting_scorecard_submit_contract check (
    (status = 'submitted' and submitted_at is not null and overall_recommendation is not null)
    or status = 'draft'
  )
);

create table public.recruiting_offer_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 160),
  body_template text not null check (length(btrim(body_template)) between 1 and 50000),
  is_active boolean not null default true,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruiting_applications(id) on delete cascade,
  template_id uuid references public.recruiting_offer_templates(id) on delete set null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (
    status in ('draft', 'pending_approval', 'approved', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'rescinded', 'superseded')
  ),
  compensation_amount numeric(14,2) not null check (compensation_amount >= 0),
  compensation_period text not null check (
    compensation_period in ('hour', 'year', 'project')
  ),
  proposed_start_date date,
  expires_at timestamptz,
  content_snapshot jsonb not null,
  esignature_external_id text,
  row_version integer not null default 1 check (row_version > 0),
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  approved_by_person_id uuid references public.people(id) on delete set null,
  sent_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, version)
);

create or replace function public.recruiting_application_has_accepted_offer(
  p_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.recruiting_offers ro
    where ro.application_id = p_application_id
      and ro.status = 'accepted'
  );
$$;

create table public.recruiting_offer_approvals (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.recruiting_offers(id) on delete cascade,
  sequence integer not null check (sequence between 1 and 20),
  approver_person_id uuid not null references public.people(id) on delete restrict,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'canceled')
  ),
  reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (offer_id, sequence),
  constraint recruiting_offer_approval_decision_contract check (
    (status = 'pending' and decided_at is null and reason is null)
    or (status = 'approved' and decided_at is not null)
    or (
      status = 'rejected'
      and decided_at is not null
      and length(btrim(coalesce(reason, ''))) > 0
    )
    or status = 'canceled'
  )
);

create table public.recruiting_offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.recruiting_offers(id) on delete restrict,
  event_type text not null check (length(btrim(event_type)) between 1 and 100),
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  occurred_at timestamptz not null default now()
);

create table public.recruiting_onboarding_handoffs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.recruiting_applications(id) on delete restrict,
  offer_id uuid not null unique references public.recruiting_offers(id) on delete restrict,
  status text not null default 'draft' check (
    status in ('draft', 'ready', 'delivered', 'acknowledged', 'canceled')
  ),
  payload_version text not null default 'v1',
  payload jsonb not null,
  delivered_to_system text,
  external_reference text,
  delivered_at timestamptz,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_talent_pools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 160),
  description text,
  is_active boolean not null default true,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_talent_pool_memberships (
  talent_pool_id uuid not null references public.recruiting_talent_pools(id) on delete cascade,
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  added_by_person_id uuid not null references public.people(id) on delete restrict,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (talent_pool_id, candidate_id)
);

create table public.recruiting_campaigns (
  id uuid primary key default gen_random_uuid(),
  talent_pool_id uuid not null references public.recruiting_talent_pools(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 160),
  channel text not null check (channel in ('email', 'sms')),
  template_id uuid not null references public.recruiting_message_templates(id) on delete restrict,
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'running', 'paused', 'completed', 'canceled')
  ),
  approved_by_person_id uuid references public.people(id) on delete set null,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_contact_suppressions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'all')),
  reason text not null check (
    reason in ('candidate_opt_out', 'invalid_contact', 'legal', 'retention', 'manual')
  ),
  suppressed_at timestamptz not null default now(),
  suppressed_by_person_id uuid references public.people(id) on delete set null,
  unique (candidate_id, channel)
);

create table public.recruiting_referrals (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  application_id uuid references public.recruiting_applications(id) on delete set null,
  referrer_person_id uuid not null references public.people(id) on delete restrict,
  relationship text,
  note text check (note is null or length(note) <= 2000),
  created_at timestamptz not null default now()
);

create table public.recruiting_certifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  certification_type text not null check (length(btrim(certification_type)) between 1 and 160),
  certification_number text,
  issuing_authority text,
  issued_on date,
  expires_on date,
  verification_status text not null default 'unverified' check (
    verification_status in ('unverified', 'verified', 'expired', 'rejected')
  ),
  verified_by_person_id uuid references public.people(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

create table public.recruiting_automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 160),
  trigger_event text not null check (length(btrim(trigger_event)) between 1 and 120),
  conditions jsonb not null default '{}'::jsonb,
  action_definition jsonb not null,
  is_enabled boolean not null default false,
  requires_human_approval boolean not null default true,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  updated_by_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiting_automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.recruiting_automation_rules(id) on delete restrict,
  requisition_id uuid references public.recruiting_requisitions(id) on delete restrict,
  application_id uuid references public.recruiting_applications(id) on delete restrict,
  trigger_event_id uuid references public.recruiting_activity_events(id) on delete restrict,
  status text not null default 'pending_approval' check (
    status in ('pending_approval', 'approved', 'running', 'succeeded', 'failed', 'canceled', 'disabled')
  ),
  result jsonb not null default '{}'::jsonb,
  approved_by_person_id uuid references public.people(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.current_can_access_recruiting_interview(
  p_interview_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.recruiting_interviews ri
    where ri.id = p_interview_id
      and (
        public.current_can_access_recruiting_application(ri.application_id)
        or exists (
          select 1
          from public.recruiting_interview_participants rip
          where rip.interview_id = ri.id
            and rip.person_id = public.current_person_id()
        )
      )
  );
$$;

-- Tables are RLS-protected before grants. Most policies delegate to the
-- recruiting aggregate access functions so the HTTP layer cannot broaden data.
alter table public.recruiting_requisition_approvals enable row level security;
alter table public.recruiting_consents enable row level security;
alter table public.recruiting_evidence_facts enable row level security;
alter table public.recruiting_duplicate_reviews enable row level security;
alter table public.recruiting_message_templates enable row level security;
alter table public.recruiting_messages enable row level security;
alter table public.recruiting_provider_attempts enable row level security;
alter table public.recruiting_availability_requests enable row level security;
alter table public.recruiting_interview_plans enable row level security;
alter table public.recruiting_interviews enable row level security;
alter table public.recruiting_interview_participants enable row level security;
alter table public.recruiting_scorecard_templates enable row level security;
alter table public.recruiting_scorecard_submissions enable row level security;
alter table public.recruiting_offer_templates enable row level security;
alter table public.recruiting_offers enable row level security;
alter table public.recruiting_offer_approvals enable row level security;
alter table public.recruiting_offer_events enable row level security;
alter table public.recruiting_onboarding_handoffs enable row level security;
alter table public.recruiting_talent_pools enable row level security;
alter table public.recruiting_talent_pool_memberships enable row level security;
alter table public.recruiting_campaigns enable row level security;
alter table public.recruiting_contact_suppressions enable row level security;
alter table public.recruiting_referrals enable row level security;
alter table public.recruiting_certifications enable row level security;
alter table public.recruiting_automation_rules enable row level security;
alter table public.recruiting_automation_runs enable row level security;

create trigger recruiting_consents_validate_aggregate
before insert or update on public.recruiting_consents
for each row execute function public.recruiting_validate_aggregate_links();
create trigger recruiting_messages_validate_aggregate
before insert or update on public.recruiting_messages
for each row execute function public.recruiting_validate_aggregate_links();
create trigger recruiting_provider_attempts_validate_aggregate
before insert or update on public.recruiting_provider_attempts
for each row execute function public.recruiting_validate_aggregate_links();
create trigger recruiting_evidence_validate_document
before insert or update on public.recruiting_evidence_facts
for each row execute function public.recruiting_validate_evidence_document();
create trigger recruiting_handoffs_validate_offer
before insert or update on public.recruiting_onboarding_handoffs
for each row execute function public.recruiting_validate_onboarding_handoff();

create policy recruiting_requisition_approvals_read
on public.recruiting_requisition_approvals for select to authenticated
using (
  approver_person_id = public.current_person_id()
  or public.current_can_access_recruiting_requisition(requisition_id)
);
create policy recruiting_requisition_approvals_insert
on public.recruiting_requisition_approvals for insert to authenticated
with check (
  public.current_can_manage_recruiting_requisition(requisition_id)
  and status = 'pending'
  and decided_at is null
  and decision_reason is null
);
create policy recruiting_requisition_approvals_update
on public.recruiting_requisition_approvals for update to authenticated
using (approver_person_id = public.current_person_id())
with check (approver_person_id = public.current_person_id());
create policy recruiting_consents_read
on public.recruiting_consents for select to authenticated
using (public.current_can_access_recruiting_candidate(candidate_id));
create policy recruiting_consents_write
on public.recruiting_consents for all to authenticated
using (public.current_can_manage_recruiting_candidate(candidate_id))
with check (
  public.current_can_manage_recruiting_candidate(candidate_id)
  and (
    public.current_recruiting_is_admin()
    or public.current_recruiting_role() = 'recruiter'
  )
);

create policy recruiting_evidence_facts_read
on public.recruiting_evidence_facts for select to authenticated
using (public.current_can_access_recruiting_candidate(candidate_id));
create policy recruiting_evidence_facts_write
on public.recruiting_evidence_facts for all to authenticated
using (public.current_can_manage_recruiting_candidate(candidate_id))
with check (
  public.current_can_manage_recruiting_candidate(candidate_id)
  and (
    public.current_recruiting_is_admin()
    or public.current_recruiting_role() = 'recruiter'
  )
);

create policy recruiting_duplicate_reviews_read
on public.recruiting_duplicate_reviews for select to authenticated
using (public.current_can_access_recruiting_candidate(candidate_id));
create policy recruiting_duplicate_reviews_write
on public.recruiting_duplicate_reviews for all to authenticated
using (public.current_can_manage_recruiting_candidate(candidate_id))
with check (
  public.current_can_manage_recruiting_candidate(candidate_id)
  and (
    public.current_recruiting_is_admin()
    or public.current_recruiting_role() = 'recruiter'
  )
);

create policy recruiting_templates_read
on public.recruiting_message_templates for select to authenticated
using (public.current_recruiting_role() is not null);
create policy recruiting_templates_admin
on public.recruiting_message_templates for all to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());

create policy recruiting_messages_read
on public.recruiting_messages for select to authenticated
using (
  public.current_recruiting_role() in ('recruiting_admin', 'recruiter')
  and public.current_can_access_recruiting_requisition(requisition_id)
);
create policy recruiting_messages_write
on public.recruiting_messages for all to authenticated
using (public.current_can_manage_recruiting_requisition(requisition_id))
with check (public.current_can_manage_recruiting_requisition(requisition_id));

create policy recruiting_provider_attempts_read
on public.recruiting_provider_attempts for select to authenticated
using (public.current_can_access_recruiting_requisition(requisition_id));
create policy recruiting_provider_attempts_write
on public.recruiting_provider_attempts for all to authenticated
using (public.current_can_manage_recruiting_requisition(requisition_id))
with check (public.current_can_manage_recruiting_requisition(requisition_id));

create policy recruiting_availability_read
on public.recruiting_availability_requests for select to authenticated
using (public.current_can_access_recruiting_application(application_id));
create policy recruiting_availability_write
on public.recruiting_availability_requests for all to authenticated
using (public.current_can_manage_recruiting_application(application_id))
with check (public.current_can_manage_recruiting_application(application_id));

create policy recruiting_interview_plans_read
on public.recruiting_interview_plans for select to authenticated
using (public.current_can_access_recruiting_requisition(requisition_id));
create policy recruiting_interview_plans_write
on public.recruiting_interview_plans for all to authenticated
using (public.current_can_manage_recruiting_requisition(requisition_id))
with check (public.current_can_manage_recruiting_requisition(requisition_id));

create policy recruiting_interviews_read
on public.recruiting_interviews for select to authenticated
using (public.current_can_access_recruiting_interview(id));
create policy recruiting_interviews_write
on public.recruiting_interviews for all to authenticated
using (public.current_can_manage_recruiting_application(application_id))
with check (public.current_can_manage_recruiting_application(application_id));

create policy recruiting_interview_participants_read
on public.recruiting_interview_participants for select to authenticated
using (
  person_id = public.current_person_id()
  or public.current_can_access_recruiting_interview(interview_id)
);
create policy recruiting_interview_participants_write
on public.recruiting_interview_participants for all to authenticated
using (
  exists (
    select 1
    from public.recruiting_interviews ri
    where ri.id = interview_id
      and public.current_can_manage_recruiting_application(ri.application_id)
  )
)
with check (
  exists (
    select 1
    from public.recruiting_interviews ri
    where ri.id = interview_id
      and public.current_can_manage_recruiting_application(ri.application_id)
  )
);

create policy recruiting_scorecard_templates_read
on public.recruiting_scorecard_templates for select to authenticated
using (public.current_can_access_recruiting_requisition(requisition_id));
create policy recruiting_scorecard_templates_write
on public.recruiting_scorecard_templates for all to authenticated
using (public.current_can_manage_recruiting_requisition(requisition_id))
with check (public.current_can_manage_recruiting_requisition(requisition_id));

create policy recruiting_scorecards_read
on public.recruiting_scorecard_submissions for select to authenticated
using (
  interviewer_person_id = public.current_person_id()
  or (
    status = 'submitted'
    and exists (
      select 1
      from public.recruiting_interviews ri
      where ri.id = interview_id
        and public.current_can_manage_recruiting_application(ri.application_id)
    )
  )
);
create policy recruiting_scorecards_insert
on public.recruiting_scorecard_submissions for insert to authenticated
with check (
  interviewer_person_id = public.current_person_id()
  and status = 'draft'
  and submitted_at is null
  and overall_recommendation is null
  and row_version = 1
  and exists (
    select 1
    from public.recruiting_interview_participants rip
    where rip.interview_id = interview_id
      and rip.person_id = public.current_person_id()
      and rip.scorecard_required
  )
);

create policy recruiting_offer_templates_read
on public.recruiting_offer_templates for select to authenticated
using (public.current_recruiting_role() in ('recruiting_admin', 'recruiter'));
create policy recruiting_offer_templates_admin
on public.recruiting_offer_templates for all to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());

create policy recruiting_offers_read
on public.recruiting_offers for select to authenticated
using (
  public.current_can_access_sensitive_recruiting_application(application_id)
  or exists (
    select 1
    from public.recruiting_offer_approvals roa
    where roa.offer_id = id
      and roa.approver_person_id = public.current_person_id()
  )
);
create policy recruiting_offers_insert
on public.recruiting_offers for insert to authenticated
with check (
  public.current_can_manage_recruiting_application(application_id)
  and status = 'draft'
  and row_version = 1
  and created_by_person_id = public.current_person_id()
  and approved_by_person_id is null
  and sent_by_person_id is null
  and esignature_external_id is null
);

create policy recruiting_offer_approvals_read
on public.recruiting_offer_approvals for select to authenticated
using (
  approver_person_id = public.current_person_id()
  or exists (
    select 1 from public.recruiting_offers ro
    where ro.id = offer_id
      and public.current_can_access_recruiting_application(ro.application_id)
  )
);
create policy recruiting_offer_approvals_insert
on public.recruiting_offer_approvals for insert to authenticated
with check (
  status = 'pending'
  and decided_at is null
  and reason is null
  and
  exists (
    select 1 from public.recruiting_offers ro
    where ro.id = offer_id
      and public.current_can_manage_recruiting_application(ro.application_id)
  )
);
create policy recruiting_offer_approvals_update
on public.recruiting_offer_approvals for update to authenticated
using (approver_person_id = public.current_person_id())
with check (approver_person_id = public.current_person_id());
create policy recruiting_offer_events_read
on public.recruiting_offer_events for select to authenticated
using (
  exists (
    select 1 from public.recruiting_offers ro
    where ro.id = offer_id
      and public.current_can_access_recruiting_application(ro.application_id)
  )
);
create policy recruiting_offer_events_insert
on public.recruiting_offer_events for insert to authenticated
with check (
  actor_person_id = public.current_person_id()
  and exists (
    select 1 from public.recruiting_offers ro
    where ro.id = offer_id
      and public.current_can_manage_recruiting_application(ro.application_id)
  )
);

create policy recruiting_handoffs_read
on public.recruiting_onboarding_handoffs for select to authenticated
using (public.current_can_access_sensitive_recruiting_application(application_id));
create policy recruiting_handoffs_insert
on public.recruiting_onboarding_handoffs for insert to authenticated
with check (
  public.current_can_manage_recruiting_application(application_id)
  and status = 'draft'
  and delivered_to_system is null
  and external_reference is null
  and delivered_at is null
  and created_by_person_id = public.current_person_id()
);

create policy recruiting_talent_pools_read
on public.recruiting_talent_pools for select to authenticated
using (public.current_recruiting_role() in ('recruiting_admin', 'recruiter', 'executive'));
create policy recruiting_talent_pools_write
on public.recruiting_talent_pools for all to authenticated
using (public.current_recruiting_role() in ('recruiting_admin', 'recruiter'))
with check (public.current_recruiting_role() in ('recruiting_admin', 'recruiter'));

create policy recruiting_pool_memberships_read
on public.recruiting_talent_pool_memberships for select to authenticated
using (public.current_can_access_recruiting_candidate(candidate_id));
create policy recruiting_pool_memberships_write
on public.recruiting_talent_pool_memberships for all to authenticated
using (public.current_can_manage_recruiting_candidate(candidate_id))
with check (public.current_can_manage_recruiting_candidate(candidate_id));

create policy recruiting_campaigns_read
on public.recruiting_campaigns for select to authenticated
using (public.current_recruiting_role() in ('recruiting_admin', 'recruiter'));
create policy recruiting_campaigns_write
on public.recruiting_campaigns for all to authenticated
using (public.current_recruiting_role() in ('recruiting_admin', 'recruiter'))
with check (public.current_recruiting_role() in ('recruiting_admin', 'recruiter'));

create policy recruiting_suppressions_read
on public.recruiting_contact_suppressions for select to authenticated
using (public.current_can_access_recruiting_candidate(candidate_id));
create policy recruiting_suppressions_insert
on public.recruiting_contact_suppressions for insert to authenticated
with check (
  public.current_can_manage_recruiting_candidate(candidate_id)
  and reason = 'manual'
  and suppressed_by_person_id = public.current_person_id()
);

create policy recruiting_referrals_read
on public.recruiting_referrals for select to authenticated
using (
  referrer_person_id = public.current_person_id()
  or public.current_can_access_recruiting_candidate(candidate_id)
);
create policy recruiting_referrals_write
on public.recruiting_referrals for all to authenticated
using (
  referrer_person_id = public.current_person_id()
  or public.current_can_manage_recruiting_candidate(candidate_id)
)
with check (
  referrer_person_id = public.current_person_id()
  or public.current_can_manage_recruiting_candidate(candidate_id)
);

create policy recruiting_certifications_read
on public.recruiting_certifications for select to authenticated
using (public.current_can_access_recruiting_candidate(candidate_id));
create policy recruiting_certifications_write
on public.recruiting_certifications for all to authenticated
using (public.current_can_manage_recruiting_candidate(candidate_id))
with check (public.current_can_manage_recruiting_candidate(candidate_id));

create policy recruiting_automation_rules_read
on public.recruiting_automation_rules for select to authenticated
using (public.current_recruiting_role() in ('recruiting_admin', 'recruiter'));
create policy recruiting_automation_rules_admin
on public.recruiting_automation_rules for all to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());

create policy recruiting_automation_runs_read
on public.recruiting_automation_runs for select to authenticated
using (
  requisition_id is null
  or public.current_can_access_recruiting_requisition(requisition_id)
);
create policy recruiting_automation_runs_write
on public.recruiting_automation_runs for all to authenticated
using (
  public.current_recruiting_is_admin()
  or (
    requisition_id is not null
    and public.current_can_manage_recruiting_requisition(requisition_id)
  )
)
with check (
  public.current_recruiting_is_admin()
  or (
    requisition_id is not null
    and public.current_can_manage_recruiting_requisition(requisition_id)
  )
);

revoke all on function public.current_can_access_recruiting_application(uuid) from public, anon;
revoke all on function public.current_can_manage_recruiting_application(uuid) from public, anon;
revoke all on function public.current_can_access_recruiting_interview(uuid) from public, anon;
revoke all on function public.current_can_access_sensitive_recruiting_application(uuid) from public, anon;
grant execute on function public.current_can_access_recruiting_application(uuid) to authenticated, service_role;
grant execute on function public.current_can_manage_recruiting_application(uuid) to authenticated, service_role;
grant execute on function public.current_can_access_recruiting_interview(uuid) to authenticated, service_role;
grant execute on function public.current_can_access_sensitive_recruiting_application(uuid) to authenticated, service_role;

revoke all on table public.recruiting_requisition_approvals from public, anon, authenticated;
revoke all on table public.recruiting_consents from public, anon, authenticated;
revoke all on table public.recruiting_evidence_facts from public, anon, authenticated;
revoke all on table public.recruiting_duplicate_reviews from public, anon, authenticated;
revoke all on table public.recruiting_message_templates from public, anon, authenticated;
revoke all on table public.recruiting_messages from public, anon, authenticated;
revoke all on table public.recruiting_provider_attempts from public, anon, authenticated;
revoke all on table public.recruiting_availability_requests from public, anon, authenticated;
revoke all on table public.recruiting_interview_plans from public, anon, authenticated;
revoke all on table public.recruiting_interviews from public, anon, authenticated;
revoke all on table public.recruiting_interview_participants from public, anon, authenticated;
revoke all on table public.recruiting_scorecard_templates from public, anon, authenticated;
revoke all on table public.recruiting_scorecard_submissions from public, anon, authenticated;
revoke all on table public.recruiting_offer_templates from public, anon, authenticated;
revoke all on table public.recruiting_offers from public, anon, authenticated;
revoke all on table public.recruiting_offer_approvals from public, anon, authenticated;
revoke all on table public.recruiting_offer_events from public, anon, authenticated;
revoke all on table public.recruiting_onboarding_handoffs from public, anon, authenticated;
revoke all on table public.recruiting_talent_pools from public, anon, authenticated;
revoke all on table public.recruiting_talent_pool_memberships from public, anon, authenticated;
revoke all on table public.recruiting_campaigns from public, anon, authenticated;
revoke all on table public.recruiting_contact_suppressions from public, anon, authenticated;
revoke all on table public.recruiting_referrals from public, anon, authenticated;
revoke all on table public.recruiting_certifications from public, anon, authenticated;
revoke all on table public.recruiting_automation_rules from public, anon, authenticated;
revoke all on table public.recruiting_automation_runs from public, anon, authenticated;

grant select, insert on public.recruiting_requisition_approvals to authenticated;
grant select, insert on public.recruiting_consents to authenticated;
grant select, insert, update, delete on public.recruiting_evidence_facts to authenticated;
grant select, insert, update, delete on public.recruiting_duplicate_reviews to authenticated;
grant select, insert, update, delete on public.recruiting_message_templates to authenticated;
grant select on public.recruiting_messages to authenticated;
grant select on public.recruiting_provider_attempts to authenticated;
grant select, insert, update, delete on public.recruiting_availability_requests to authenticated;
grant select, insert, update, delete on public.recruiting_interview_plans to authenticated;
grant select, insert, update, delete on public.recruiting_interviews to authenticated;
grant select, insert, update, delete on public.recruiting_interview_participants to authenticated;
grant select, insert, update, delete on public.recruiting_scorecard_templates to authenticated;
grant select, insert on public.recruiting_scorecard_submissions to authenticated;
grant select, insert, update, delete on public.recruiting_offer_templates to authenticated;
grant select, insert on public.recruiting_offers to authenticated;
grant select, insert on public.recruiting_offer_approvals to authenticated;
grant select on public.recruiting_offer_events to authenticated;
grant select, insert on public.recruiting_onboarding_handoffs to authenticated;
grant select, insert, update, delete on public.recruiting_talent_pools to authenticated;
grant select, insert, update, delete on public.recruiting_talent_pool_memberships to authenticated;
grant select, insert, update, delete on public.recruiting_campaigns to authenticated;
grant select, insert on public.recruiting_contact_suppressions to authenticated;
grant select, insert, update, delete on public.recruiting_referrals to authenticated;
grant select, insert, update, delete on public.recruiting_certifications to authenticated;
grant select, insert, update, delete on public.recruiting_automation_rules to authenticated;
grant select on public.recruiting_automation_runs to authenticated;

commit;
