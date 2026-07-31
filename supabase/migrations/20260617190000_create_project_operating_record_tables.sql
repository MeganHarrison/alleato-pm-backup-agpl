create table if not exists public.project_operating_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on update cascade on delete cascade,
  snapshot_at timestamptz not null default timezone('utc'::text, now()),
  source_delta_id uuid null,
  source_coverage jsonb not null default '{}'::jsonb,
  financial_snapshot jsonb not null default '{}'::jsonb,
  schedule_snapshot jsonb not null default '{}'::jsonb,
  database_counts jsonb not null default '{}'::jsonb,
  project_info jsonb not null default '{}'::jsonb,
  acumatica_sync_at timestamptz null,
  freshness jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  confidence text not null default 'unknown' check (confidence in ('high', 'medium', 'low', 'unknown')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists project_operating_snapshots_project_snapshot_idx
  on public.project_operating_snapshots(project_id, snapshot_at desc);

create table if not exists public.project_current_state (
  project_id integer primary key references public.projects(id) on update cascade on delete cascade,
  current_summary text null,
  health_status text not null default 'unknown' check (health_status in ('on_track', 'watch', 'at_risk', 'critical', 'unknown')),
  what_changed_since_last_update jsonb not null default '[]'::jsonb,
  needs_attention jsonb not null default '[]'::jsonb,
  open_decisions jsonb not null default '[]'::jsonb,
  active_risks jsonb not null default '[]'::jsonb,
  financial_read text null,
  schedule_read text null,
  field_read text null,
  source_confidence jsonb not null default '{}'::jsonb,
  last_delta_id uuid null,
  last_snapshot_id uuid null references public.project_operating_snapshots(id) on update cascade on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.project_intelligence_timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on update cascade on delete cascade,
  event_at timestamptz not null,
  event_type text not null check (
    event_type in (
      'decision',
      'risk',
      'issue',
      'milestone',
      'idea',
      'cost_exposure',
      'schedule_impact',
      'change_event_signal',
      'client_concern',
      'daily_log',
      'progress_update',
      'rfi',
      'submittal',
      'drawing',
      'commitment',
      'financial',
      'document',
      'email',
      'meeting'
    )
  ),
  title text not null,
  summary text null,
  why_it_matters text null,
  current_status text not null default 'open' check (
    current_status in (
      'open',
      'monitoring',
      'needs_decision',
      'resolved',
      'converted',
      'dismissed',
      'superseded'
    )
  ),
  owner_label text null,
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  source_synthesis_id uuid null,
  source_document_id text null,
  related_event_ids uuid[] not null default '{}'::uuid[],
  related_record_type text null,
  related_record_id text null,
  confidence text not null default 'unknown' check (confidence in ('high', 'medium', 'low', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists project_intelligence_timeline_events_project_event_idx
  on public.project_intelligence_timeline_events(project_id, event_at desc);

create index if not exists project_intelligence_timeline_events_status_idx
  on public.project_intelligence_timeline_events(project_id, current_status, priority);

create index if not exists project_intelligence_timeline_events_type_idx
  on public.project_intelligence_timeline_events(project_id, event_type, event_at desc);

create table if not exists public.project_intelligence_timeline_event_sources (
  id uuid primary key default gen_random_uuid(),
  timeline_event_id uuid not null references public.project_intelligence_timeline_events(id) on update cascade on delete cascade,
  source_synthesis_id uuid null,
  source_document_id text null,
  source_family text null,
  source_title text null,
  source_excerpt text null,
  source_url text null,
  source_occurred_at timestamptz null,
  confidence text not null default 'unknown' check (confidence in ('high', 'medium', 'low', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists project_intelligence_timeline_event_sources_event_idx
  on public.project_intelligence_timeline_event_sources(timeline_event_id);

create index if not exists project_intelligence_timeline_event_sources_document_idx
  on public.project_intelligence_timeline_event_sources(source_document_id);

create table if not exists public.change_event_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on update cascade on delete cascade,
  title text not null,
  description text null,
  reason text null,
  potential_cost_impact text null,
  potential_schedule_impact text null,
  source_synthesis_ids uuid[] not null default '{}'::uuid[],
  timeline_event_ids uuid[] not null default '{}'::uuid[],
  confidence text not null default 'unknown' check (confidence in ('high', 'medium', 'low', 'unknown')),
  missing_information jsonb not null default '[]'::jsonb,
  status text not null default 'candidate' check (
    status in (
      'candidate',
      'reviewing',
      'draft_created',
      'converted',
      'dismissed'
    )
  ),
  created_change_event_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists change_event_candidates_project_status_idx
  on public.change_event_candidates(project_id, status, created_at desc);

create table if not exists public.project_report_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on update cascade on delete cascade,
  report_type text not null check (
    report_type in (
      'executive_daily_brief',
      'project_daily_report',
      'field_daily_log',
      'weekly_progress_report'
    )
  ),
  business_date date null,
  week_start_date date null,
  source_delta_id uuid null,
  source_snapshot_id uuid null references public.project_operating_snapshots(id) on update cascade on delete set null,
  title text not null,
  suggestion_payload jsonb not null default '{}'::jsonb,
  source_timeline_event_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'suggested' check (
    status in (
      'suggested',
      'reviewing',
      'applied',
      'partially_applied',
      'dismissed',
      'superseded'
    )
  ),
  applied_record_type text null,
  applied_record_id text null,
  reviewed_by uuid null references public.people(id) on update cascade on delete set null,
  reviewed_at timestamptz null,
  confidence text not null default 'unknown' check (confidence in ('high', 'medium', 'low', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists project_report_suggestions_project_type_idx
  on public.project_report_suggestions(project_id, report_type, (coalesce(business_date, week_start_date)), status);

drop trigger if exists update_project_current_state_updated_at on public.project_current_state;
create trigger update_project_current_state_updated_at
  before update on public.project_current_state
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_project_intelligence_timeline_events_updated_at on public.project_intelligence_timeline_events;
create trigger update_project_intelligence_timeline_events_updated_at
  before update on public.project_intelligence_timeline_events
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_change_event_candidates_updated_at on public.change_event_candidates;
create trigger update_change_event_candidates_updated_at
  before update on public.change_event_candidates
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_project_report_suggestions_updated_at on public.project_report_suggestions;
create trigger update_project_report_suggestions_updated_at
  before update on public.project_report_suggestions
  for each row
  execute function public.update_updated_at_column();

alter table public.project_operating_snapshots enable row level security;
alter table public.project_current_state enable row level security;
alter table public.project_intelligence_timeline_events enable row level security;
alter table public.project_intelligence_timeline_event_sources enable row level security;
alter table public.change_event_candidates enable row level security;
alter table public.project_report_suggestions enable row level security;

drop policy if exists authenticated_read_project_operating_snapshots on public.project_operating_snapshots;
create policy authenticated_read_project_operating_snapshots
  on public.project_operating_snapshots
  for select
  to authenticated
  using (true);

drop policy if exists service_write_project_operating_snapshots on public.project_operating_snapshots;
create policy service_write_project_operating_snapshots
  on public.project_operating_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists authenticated_read_project_current_state on public.project_current_state;
create policy authenticated_read_project_current_state
  on public.project_current_state
  for select
  to authenticated
  using (true);

drop policy if exists service_write_project_current_state on public.project_current_state;
create policy service_write_project_current_state
  on public.project_current_state
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists authenticated_read_project_intelligence_timeline_events on public.project_intelligence_timeline_events;
create policy authenticated_read_project_intelligence_timeline_events
  on public.project_intelligence_timeline_events
  for select
  to authenticated
  using (true);

drop policy if exists service_write_project_intelligence_timeline_events on public.project_intelligence_timeline_events;
create policy service_write_project_intelligence_timeline_events
  on public.project_intelligence_timeline_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists authenticated_read_project_intelligence_timeline_event_sources on public.project_intelligence_timeline_event_sources;
create policy authenticated_read_project_intelligence_timeline_event_sources
  on public.project_intelligence_timeline_event_sources
  for select
  to authenticated
  using (true);

drop policy if exists service_write_project_intelligence_timeline_event_sources on public.project_intelligence_timeline_event_sources;
create policy service_write_project_intelligence_timeline_event_sources
  on public.project_intelligence_timeline_event_sources
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists authenticated_read_change_event_candidates on public.change_event_candidates;
create policy authenticated_read_change_event_candidates
  on public.change_event_candidates
  for select
  to authenticated
  using (true);

drop policy if exists service_write_change_event_candidates on public.change_event_candidates;
create policy service_write_change_event_candidates
  on public.change_event_candidates
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists authenticated_read_project_report_suggestions on public.project_report_suggestions;
create policy authenticated_read_project_report_suggestions
  on public.project_report_suggestions
  for select
  to authenticated
  using (true);

drop policy if exists service_write_project_report_suggestions on public.project_report_suggestions;
create policy service_write_project_report_suggestions
  on public.project_report_suggestions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.project_operating_snapshots is
  'Authoritative structured project snapshot used by Project Intelligence, reports, and assistant answers.';

comment on table public.project_current_state is
  'Current synthesized operating read for one project.';

comment on table public.project_intelligence_timeline_events is
  'Durable reverse-chronological project intelligence timeline events.';

comment on table public.project_intelligence_timeline_event_sources is
  'Evidence links for durable Project Intelligence timeline events.';

comment on table public.change_event_candidates is
  'AI-detected potential change-event candidates awaiting human review.';

comment on table public.project_report_suggestions is
  'AI-generated report suggestions for executive briefs, daily reports/logs, and weekly progress reports without overwriting user-authored reports.';
