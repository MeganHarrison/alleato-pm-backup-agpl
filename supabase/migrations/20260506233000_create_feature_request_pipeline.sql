create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  requester_name text not null,
  requester_user_id uuid null,
  requester_person_id uuid null references public.people(id) on delete set null,
  source text not null default 'ais_chat',
  project_id integer null references public.projects(id) on delete set null,
  company_id uuid null,
  request_type text not null check (
    request_type in (
      'new_feature',
      'workflow_improvement',
      'bug',
      'report_dashboard',
      'automation',
      'ai_assistant_capability',
      'data_cleanup',
      'integration',
      'permission_admin'
    )
  ),
  raw_request text not null,
  assistant_summary text not null,
  stakeholder_problem text null,
  desired_outcome text null,
  affected_users jsonb not null default '[]'::jsonb,
  affected_pages jsonb not null default '[]'::jsonb,
  affected_workflows jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  verification_steps jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  readiness_goal_clarity text not null default 'low' check (readiness_goal_clarity in ('low', 'medium', 'high')),
  readiness_data_clarity text not null default 'low' check (readiness_data_clarity in ('low', 'medium', 'high')),
  readiness_ux_clarity text not null default 'low' check (readiness_ux_clarity in ('low', 'medium', 'high')),
  readiness_acceptance_status text not null default 'missing' check (readiness_acceptance_status in ('missing', 'partial', 'complete')),
  readiness_implementation_risk text not null default 'medium' check (readiness_implementation_risk in ('low', 'medium', 'high')),
  readiness_missing_requirements jsonb not null default '[]'::jsonb,
  ready_for_build boolean not null default false,
  status text not null default 'captured' check (
    status in (
      'captured',
      'needs_clarification',
      'ready_for_planning',
      'plan_generated',
      'linear_drafted',
      'ready_for_build',
      'handoff_generated',
      'sent_to_claude_code',
      'in_progress',
      'ready_for_review',
      'accepted',
      'rejected'
    )
  ),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  linear_issue_id text null,
  linear_issue_url text null,
  linear_draft_body text null,
  claude_handoff_path text null,
  source_session_id uuid null,
  source_message_id uuid null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feature_requests_status on public.feature_requests(status);
create index if not exists idx_feature_requests_project_id on public.feature_requests(project_id);
create index if not exists idx_feature_requests_requester_name on public.feature_requests(requester_name);
create index if not exists idx_feature_requests_request_type on public.feature_requests(request_type);
create index if not exists idx_feature_requests_linear_issue_id on public.feature_requests(linear_issue_id);
create index if not exists idx_feature_requests_updated_at on public.feature_requests(updated_at desc);

create table if not exists public.feature_request_events (
  id uuid primary key default gen_random_uuid(),
  feature_request_id uuid not null references public.feature_requests(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feature_request_events_request
  on public.feature_request_events(feature_request_id, created_at desc);

create table if not exists public.implementation_plans (
  id uuid primary key default gen_random_uuid(),
  feature_request_id uuid not null references public.feature_requests(id) on delete cascade,
  version integer not null default 1,
  summary text not null,
  affected_routes jsonb not null default '[]'::jsonb,
  affected_components jsonb not null default '[]'::jsonb,
  affected_tables jsonb not null default '[]'::jsonb,
  data_requirements jsonb not null default '[]'::jsonb,
  implementation_steps jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  verification_steps jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  generated_by uuid null,
  created_at timestamptz not null default now(),
  unique (feature_request_id, version)
);

create index if not exists idx_implementation_plans_request
  on public.implementation_plans(feature_request_id, version desc);

create table if not exists public.execution_handoffs (
  id uuid primary key default gen_random_uuid(),
  feature_request_id uuid not null references public.feature_requests(id) on delete cascade,
  implementation_plan_id uuid null references public.implementation_plans(id) on delete set null,
  handoff_path text not null,
  handoff_title text not null,
  linear_issue_id text null,
  validation_status text not null default 'draft' check (validation_status in ('draft', 'valid', 'blocked')),
  validation_errors jsonb not null default '[]'::jsonb,
  generated_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_execution_handoffs_request
  on public.execution_handoffs(feature_request_id, created_at desc);

create or replace function public.set_feature_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feature_requests_set_updated_at on public.feature_requests;
create trigger feature_requests_set_updated_at
  before update on public.feature_requests
  for each row execute function public.set_feature_request_updated_at();

alter table public.feature_requests enable row level security;
alter table public.feature_request_events enable row level security;
alter table public.implementation_plans enable row level security;
alter table public.execution_handoffs enable row level security;

drop policy if exists feature_requests_select on public.feature_requests;
create policy feature_requests_select
  on public.feature_requests
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or project_id is null
    or public.current_is_project_member(project_id::bigint)
  );

drop policy if exists feature_requests_service_write on public.feature_requests;
create policy feature_requests_service_write
  on public.feature_requests
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists feature_request_events_select on public.feature_request_events;
create policy feature_request_events_select
  on public.feature_request_events
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.feature_requests fr
      where fr.id = feature_request_events.feature_request_id
        and (fr.project_id is null or public.current_is_project_member(fr.project_id::bigint))
    )
  );

drop policy if exists feature_request_events_service_write on public.feature_request_events;
create policy feature_request_events_service_write
  on public.feature_request_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists implementation_plans_select on public.implementation_plans;
create policy implementation_plans_select
  on public.implementation_plans
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.feature_requests fr
      where fr.id = implementation_plans.feature_request_id
        and (fr.project_id is null or public.current_is_project_member(fr.project_id::bigint))
    )
  );

drop policy if exists implementation_plans_service_write on public.implementation_plans;
create policy implementation_plans_service_write
  on public.implementation_plans
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists execution_handoffs_select on public.execution_handoffs;
create policy execution_handoffs_select
  on public.execution_handoffs
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.feature_requests fr
      where fr.id = execution_handoffs.feature_request_id
        and (fr.project_id is null or public.current_is_project_member(fr.project_id::bigint))
    )
  );

drop policy if exists execution_handoffs_service_write on public.execution_handoffs;
create policy execution_handoffs_service_write
  on public.execution_handoffs
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.feature_requests is
  'AIS feature request packets preserving stakeholder wording, readiness state, implementation planning, and Claude Code handoff linkage.';
comment on table public.implementation_plans is
  'Versioned implementation plans generated from feature request packets.';
comment on table public.execution_handoffs is
  'Claude Code/Codex handoff metadata generated from feature request packets and implementation plans.';
