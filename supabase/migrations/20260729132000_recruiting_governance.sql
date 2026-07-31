-- Applicant Tracker governance expansion: public-intake receipts, experience
-- surveys, metrics, retention/legal holds, protected data, and human-controlled
-- AI audit records.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.recruiting_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.recruiting_requisitions(id) on delete restrict,
  application_id uuid references public.recruiting_applications(id) on delete set null,
  idempotency_key uuid not null,
  request_hash text not null check (length(btrim(request_hash)) >= 32),
  status text not null default 'received' check (
    status in (
      'received', 'quarantined', 'scanning', 'needs_review',
      'accepted', 'rejected_file', 'failed'
    )
  ),
  safe_error_code text,
  privacy_policy_version text not null check (
    length(btrim(privacy_policy_version)) between 1 and 100
  ),
  source_type text not null default 'career_site' check (
    source_type in ('career_site', 'kiosk', 'qr', 'referral')
  ),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (requisition_id, idempotency_key)
);

create table public.recruiting_candidate_surveys (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruiting_applications(id) on delete cascade,
  survey_type text not null default 'candidate_experience' check (
    survey_type = 'candidate_experience'
  ),
  token_hash text not null unique check (length(token_hash) >= 32),
  rating integer check (rating between 0 and 10),
  feedback text check (feedback is null or length(feedback) <= 5000),
  status text not null default 'open' check (
    status in ('open', 'submitted', 'expired', 'canceled')
  ),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recruiting_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  requisition_id uuid references public.recruiting_requisitions(id) on delete cascade,
  metric_name text not null check (length(btrim(metric_name)) between 1 and 120),
  numerator numeric,
  denominator numeric,
  metric_value numeric,
  definition_version text not null check (
    length(btrim(definition_version)) between 1 and 50
  ),
  dimensions jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (metric_date, requisition_id, metric_name, definition_version, dimensions)
);

create table public.recruiting_legal_holds (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  status text not null default 'active' check (status in ('active', 'released')),
  placed_by_person_id uuid not null references public.people(id) on delete restrict,
  released_by_person_id uuid references public.people(id) on delete set null,
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  constraint recruiting_legal_hold_release_contract check (
    (status = 'released' and released_at is not null and released_by_person_id is not null)
    or status = 'active'
  )
);

create table public.recruiting_retention_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('dry_run', 'execute')),
  policy_version text not null check (length(btrim(policy_version)) between 1 and 100),
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'canceled')
  ),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  result_summary jsonb not null default '{}'::jsonb,
  requested_by_person_id uuid not null references public.people(id) on delete restrict,
  approved_by_person_id uuid references public.people(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint recruiting_retention_execute_approval check (
    mode = 'dry_run' or approved_by_person_id is not null
  )
);

create table public.recruiting_retention_actions (
  id uuid primary key default gen_random_uuid(),
  retention_run_id uuid not null references public.recruiting_retention_runs(id) on delete restrict,
  candidate_id uuid not null references public.recruiting_candidates(id) on delete restrict,
  action text not null check (
    action in ('retain', 'anonymize', 'delete_documents', 'delete_candidate')
  ),
  status text not null default 'planned' check (
    status in ('planned', 'blocked_legal_hold', 'completed', 'failed', 'skipped')
  ),
  safe_reason text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (retention_run_id, candidate_id, action)
);

create table public.recruiting_ai_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.recruiting_candidates(id) on delete restrict,
  application_id uuid references public.recruiting_applications(id) on delete restrict,
  requisition_id uuid references public.recruiting_requisitions(id) on delete restrict,
  action text not null check (
    action in (
      'extract_resume_facts', 'draft_job_description', 'draft_message',
      'draft_interview_questions', 'summarize_evidence', 'suggest_schedule',
      'detect_possible_duplicate'
    )
  ),
  status text not null default 'requested' check (
    status in ('requested', 'running', 'completed', 'failed', 'disabled', 'rejected')
  ),
  model_provider text,
  model_name text,
  prompt_version text not null check (length(btrim(prompt_version)) between 1 and 100),
  input_hash text not null check (length(btrim(input_hash)) >= 32),
  protected_data_redacted boolean not null default true,
  output_payload jsonb,
  safe_error_code text,
  safe_error_message text,
  requested_by_person_id uuid not null references public.people(id) on delete restrict,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.recruiting_ai_citations (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.recruiting_ai_runs(id) on delete cascade,
  document_id uuid references public.recruiting_documents(id) on delete restrict,
  evidence_fact_id uuid references public.recruiting_evidence_facts(id) on delete restrict,
  output_field text not null check (length(btrim(output_field)) between 1 and 160),
  source_locator jsonb not null,
  source_excerpt text check (
    source_excerpt is null or length(source_excerpt) <= 2000
  ),
  created_at timestamptz not null default now(),
  check (document_id is not null or evidence_fact_id is not null)
);

create table public.recruiting_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.recruiting_ai_runs(id) on delete restrict,
  review_decision text not null check (
    review_decision in ('accepted', 'edited', 'rejected')
  ),
  reviewed_output jsonb,
  reason text check (reason is null or length(reason) <= 2000),
  reviewer_person_id uuid not null references public.people(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  unique (ai_run_id, reviewer_person_id)
);

create table private.recruiting_accommodation_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  application_id uuid references public.recruiting_applications(id) on delete cascade,
  request_text text not null check (length(btrim(request_text)) between 1 and 5000),
  status text not null default 'received' check (
    status in ('received', 'in_review', 'arranged', 'closed')
  ),
  assigned_to_person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.recruiting_voluntary_demographics (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  application_id uuid references public.recruiting_applications(id) on delete cascade,
  policy_version text not null check (length(btrim(policy_version)) between 1 and 100),
  response_payload jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (application_id)
);

create or replace function public.recruiting_validate_ai_citation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_run public.recruiting_ai_runs%rowtype;
  v_run_candidate_id uuid;
  v_source_candidate_id uuid;
begin
  select * into v_run
  from public.recruiting_ai_runs
  where id = new.ai_run_id;

  if not found then
    raise exception 'The linked recruiting AI run does not exist.'
      using errcode = '23503';
  end if;

  v_run_candidate_id := v_run.candidate_id;
  if v_run_candidate_id is null and v_run.application_id is not null then
    select candidate_id into v_run_candidate_id
    from public.recruiting_applications
    where id = v_run.application_id;
  end if;

  if new.document_id is not null then
    select candidate_id into v_source_candidate_id
    from public.recruiting_documents
    where id = new.document_id;
  elsif new.evidence_fact_id is not null then
    select candidate_id into v_source_candidate_id
    from public.recruiting_evidence_facts
    where id = new.evidence_fact_id;
  end if;

  if v_run_candidate_id is not null
    and v_source_candidate_id is distinct from v_run_candidate_id
  then
    raise exception 'The AI citation source must belong to the AI run candidate.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.recruiting_ai_action_allowed(p_action text)
returns boolean
language sql
immutable
as $$
  select p_action in (
    'extract_resume_facts',
    'draft_job_description',
    'draft_message',
    'draft_interview_questions',
    'summarize_evidence',
    'suggest_schedule',
    'detect_possible_duplicate'
  );
$$;

create or replace function public.recruiting_request_ai_assistance(
  p_action text,
  p_requisition_id uuid,
  p_candidate_id uuid,
  p_application_id uuid,
  p_prompt_version text,
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
  v_run public.recruiting_ai_runs%rowtype;
  v_application_candidate_id uuid;
  v_application_requisition_id uuid;
  v_response jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not public.recruiting_ai_action_allowed(p_action) then
    raise exception 'This employment AI action is prohibited.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.recruiting_settings
    where key = 'ai_enabled' and value = 'true'::jsonb
  ) or not exists (
    select 1 from public.recruiting_settings
    where key = 'ai_evaluation_approved' and value = 'true'::jsonb
  ) then
    raise exception 'Employment AI assistance is disabled.' using errcode = '42501';
  end if;
  if p_application_id is not null then
    if not public.current_can_manage_recruiting_application(p_application_id) then
      raise exception 'Recruiting write access is required.' using errcode = '42501';
    end if;
    select candidate_id, requisition_id
    into v_application_candidate_id, v_application_requisition_id
    from public.recruiting_applications
    where id = p_application_id;
    if p_candidate_id is not null
      and p_candidate_id <> v_application_candidate_id
    then
      raise exception 'The AI candidate must match its application.'
        using errcode = '23514';
    end if;
    if p_requisition_id is not null
      and p_requisition_id <> v_application_requisition_id
    then
      raise exception 'The AI requisition must match its application.'
        using errcode = '23514';
    end if;
  elsif p_requisition_id is not null then
    if not public.current_can_manage_recruiting_requisition(p_requisition_id) then
      raise exception 'Recruiting write access is required.' using errcode = '42501';
    end if;
  elsif p_candidate_id is not null then
    if not public.current_can_manage_recruiting_candidate(p_candidate_id) then
      raise exception 'Recruiting write access is required.' using errcode = '42501';
    end if;
  else
    raise exception 'An AI request must identify a recruiting record.' using errcode = '22023';
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
    if v_receipt.request_hash <> p_request_hash or v_receipt.command_name <> 'ai.request' then
      raise exception 'The idempotency key was already used for a different command.' using errcode = '23505';
    end if;
    return v_receipt.response_body || jsonb_build_object('replayed', true);
  end if;

  insert into public.recruiting_ai_runs (
    action, status, requisition_id, candidate_id, application_id,
    prompt_version, input_hash, protected_data_redacted, requested_by_person_id
  )
  values (
    p_action,
    'requested',
    coalesce(p_requisition_id, v_application_requisition_id),
    coalesce(p_candidate_id, v_application_candidate_id),
    p_application_id,
    btrim(p_prompt_version), p_request_hash, true, v_actor
  )
  returning * into v_run;

  v_response := jsonb_build_object(
    'aiRunId', v_run.id, 'status', v_run.status, 'replayed', false
  );
  insert into public.recruiting_command_receipts (
    actor_person_id, idempotency_key, command_name, request_hash, response_body
  ) values (v_actor, p_idempotency_key, 'ai.request', p_request_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.recruiting_record_accommodation_request(
  p_candidate_id uuid,
  p_application_id uuid,
  p_request_text text
)
returns uuid
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.current_can_manage_recruiting_candidate(p_candidate_id) then
    raise exception 'Recruiting accommodation access is required.'
      using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_request_text, ''))) not between 1 and 5000 then
    raise exception 'Accommodation request text must be between 1 and 5000 characters.'
      using errcode = '22023';
  end if;

  insert into private.recruiting_accommodation_requests (
    candidate_id, application_id, request_text
  )
  values (p_candidate_id, p_application_id, btrim(p_request_text))
  returning id into v_id;

  return v_id;
end;
$$;

alter table public.recruiting_intake_submissions enable row level security;
alter table public.recruiting_candidate_surveys enable row level security;
alter table public.recruiting_metric_snapshots enable row level security;
alter table public.recruiting_legal_holds enable row level security;
alter table public.recruiting_retention_runs enable row level security;
alter table public.recruiting_retention_actions enable row level security;
alter table public.recruiting_ai_runs enable row level security;
alter table public.recruiting_ai_citations enable row level security;
alter table public.recruiting_ai_reviews enable row level security;
alter table private.recruiting_accommodation_requests enable row level security;
alter table private.recruiting_voluntary_demographics enable row level security;

create trigger recruiting_ai_runs_validate_aggregate
before insert or update on public.recruiting_ai_runs
for each row execute function public.recruiting_validate_aggregate_links();
create trigger recruiting_ai_citations_validate_aggregate
before insert or update on public.recruiting_ai_citations
for each row execute function public.recruiting_validate_ai_citation();
create trigger recruiting_accommodations_validate_aggregate
before insert or update on private.recruiting_accommodation_requests
for each row execute function public.recruiting_validate_aggregate_links();
create trigger recruiting_demographics_validate_aggregate
before insert or update on private.recruiting_voluntary_demographics
for each row execute function public.recruiting_validate_aggregate_links();

create policy recruiting_intake_submissions_read
on public.recruiting_intake_submissions for select to authenticated
using (public.current_can_access_recruiting_requisition(requisition_id));
create policy recruiting_intake_submissions_write
on public.recruiting_intake_submissions for all to authenticated
using (public.current_can_manage_recruiting_requisition(requisition_id))
with check (public.current_can_manage_recruiting_requisition(requisition_id));

create policy recruiting_surveys_aggregate_admin
on public.recruiting_candidate_surveys for select to authenticated
using (public.current_recruiting_is_admin());

create policy recruiting_metrics_read
on public.recruiting_metric_snapshots for select to authenticated
using (
  public.current_recruiting_role() in ('recruiting_admin', 'recruiter', 'executive')
  and (
    requisition_id is null
    or public.current_can_access_recruiting_requisition(requisition_id)
  )
);
create policy recruiting_metrics_admin
on public.recruiting_metric_snapshots for all to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());

create policy recruiting_legal_holds_admin
on public.recruiting_legal_holds for all to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());

create policy recruiting_retention_runs_admin
on public.recruiting_retention_runs for all to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());
create policy recruiting_retention_actions_admin
on public.recruiting_retention_actions for all to authenticated
using (public.current_recruiting_is_admin())
with check (public.current_recruiting_is_admin());

create policy recruiting_ai_runs_read
on public.recruiting_ai_runs for select to authenticated
using (
  requested_by_person_id = public.current_person_id()
  or public.current_recruiting_is_admin()
  or (
    requisition_id is not null
    and public.current_can_manage_recruiting_requisition(requisition_id)
  )
);
create policy recruiting_ai_runs_insert
on public.recruiting_ai_runs for insert to authenticated
with check (
  requested_by_person_id = public.current_person_id()
  and public.recruiting_ai_action_allowed(action)
  and (
    requisition_id is null
    or public.current_can_manage_recruiting_requisition(requisition_id)
  )
);
create policy recruiting_ai_runs_update
on public.recruiting_ai_runs for update to authenticated
using (
  requested_by_person_id = public.current_person_id()
  or public.current_recruiting_is_admin()
)
with check (
  requested_by_person_id = public.current_person_id()
  or public.current_recruiting_is_admin()
);

create policy recruiting_ai_citations_read
on public.recruiting_ai_citations for select to authenticated
using (
  exists (
    select 1
    from public.recruiting_ai_runs rar
    where rar.id = ai_run_id
      and (
        rar.requested_by_person_id = public.current_person_id()
        or public.current_recruiting_is_admin()
        or (
          rar.requisition_id is not null
          and public.current_can_manage_recruiting_requisition(rar.requisition_id)
        )
      )
  )
);
create policy recruiting_ai_citations_insert
on public.recruiting_ai_citations for insert to authenticated
with check (
  exists (
    select 1
    from public.recruiting_ai_runs rar
    where rar.id = ai_run_id
      and rar.requested_by_person_id = public.current_person_id()
  )
);

create policy recruiting_ai_reviews_read
on public.recruiting_ai_reviews for select to authenticated
using (
  reviewer_person_id = public.current_person_id()
  or public.current_recruiting_is_admin()
);
create policy recruiting_ai_reviews_insert
on public.recruiting_ai_reviews for insert to authenticated
with check (reviewer_person_id = public.current_person_id());

revoke all on table private.recruiting_accommodation_requests from public, anon, authenticated;
revoke all on table private.recruiting_voluntary_demographics from public, anon, authenticated;
revoke all on function public.recruiting_record_accommodation_request(uuid, uuid, text) from public, anon;
revoke all on function public.recruiting_request_ai_assistance(text, uuid, uuid, uuid, text, uuid, text) from public, anon;
grant execute on function public.recruiting_record_accommodation_request(uuid, uuid, text)
to authenticated, service_role;
grant execute on function public.recruiting_request_ai_assistance(text, uuid, uuid, uuid, text, uuid, text)
to authenticated, service_role;

revoke all on table public.recruiting_intake_submissions from public, anon, authenticated;
revoke all on table public.recruiting_candidate_surveys from public, anon, authenticated;
revoke all on table public.recruiting_metric_snapshots from public, anon, authenticated;
revoke all on table public.recruiting_legal_holds from public, anon, authenticated;
revoke all on table public.recruiting_retention_runs from public, anon, authenticated;
revoke all on table public.recruiting_retention_actions from public, anon, authenticated;
revoke all on table public.recruiting_ai_runs from public, anon, authenticated;
revoke all on table public.recruiting_ai_citations from public, anon, authenticated;
revoke all on table public.recruiting_ai_reviews from public, anon, authenticated;

grant select, insert, update, delete on public.recruiting_intake_submissions to authenticated;
grant select on public.recruiting_candidate_surveys to authenticated;
grant select, insert, update, delete on public.recruiting_metric_snapshots to authenticated;
grant select, insert, update, delete on public.recruiting_legal_holds to authenticated;
grant select, insert, update, delete on public.recruiting_retention_runs to authenticated;
grant select, insert, update, delete on public.recruiting_retention_actions to authenticated;
grant select on public.recruiting_ai_runs to authenticated;
grant select on public.recruiting_ai_citations to authenticated;
grant select on public.recruiting_ai_reviews to authenticated;

commit;
