-- Recruiter-only audit records for safe, no-send Applicant Tracker UAT actions.

create table if not exists public.recruiting_uat_feature_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.recruiting_uat_submissions(id) on delete cascade,
  action text not null check (action in (
    'resume_evidence_extraction',
    'sms_preview',
    'offer_esignature_preview',
    'workflow_automation_preview',
    'ai_evidence_summary'
  )),
  status text not null default 'succeeded' check (status = 'succeeded'),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (
    result #>> '{safety,delivery}' = 'not_sent'
    and result #>> '{safety,employmentDecision}' = 'human_required'
    and result #>> '{safety,syntheticDataOnly}' = 'true'
  ),
  initiated_by_person_id uuid not null references public.people(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (initiated_by_person_id, idempotency_key)
);

create index if not exists recruiting_uat_feature_runs_submission_idx
  on public.recruiting_uat_feature_runs(submission_id, created_at desc);

create or replace function public.recruiting_bind_uat_feature_run_expiry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.recruiting_uat_submissions%rowtype;
begin
  select * into v_submission
  from public.recruiting_uat_submissions
  where id = new.submission_id;

  if not found or v_submission.expires_at <= now() then
    raise exception 'An active synthetic UAT submission is required.';
  end if;

  if v_submission.submitted_by_person_id <> new.initiated_by_person_id
    and not exists (
      select 1
      from public.recruiting_user_roles rur
      where rur.person_id = new.initiated_by_person_id
        and rur.role = 'recruiting_admin'
        and rur.is_active = true
    ) then
    raise exception 'The recruiter may only test an owned synthetic submission.';
  end if;

  new.expires_at := v_submission.expires_at;
  return new;
end;
$$;

drop trigger if exists recruiting_bind_uat_feature_run_expiry
  on public.recruiting_uat_feature_runs;
create trigger recruiting_bind_uat_feature_run_expiry
before insert or update on public.recruiting_uat_feature_runs
for each row execute function public.recruiting_bind_uat_feature_run_expiry();

alter table public.recruiting_uat_feature_runs enable row level security;

drop policy if exists recruiting_uat_feature_runs_select
  on public.recruiting_uat_feature_runs;
create policy recruiting_uat_feature_runs_select
on public.recruiting_uat_feature_runs
for select
to authenticated
using (
  expires_at > now()
  and (
    (
      public.current_recruiting_role() = 'recruiter'
      and initiated_by_person_id = public.current_recruiting_person_id()
    )
    or public.current_recruiting_is_admin()
  )
);

revoke all on table public.recruiting_uat_feature_runs from anon, authenticated;
grant select on table public.recruiting_uat_feature_runs to authenticated;
revoke all on function public.recruiting_bind_uat_feature_run_expiry()
  from public, anon, authenticated, service_role;

comment on table public.recruiting_uat_feature_runs is
  'Audited no-send UAT results for recruiter-owned synthetic submissions. Cascades with 24-hour UAT purge.';
