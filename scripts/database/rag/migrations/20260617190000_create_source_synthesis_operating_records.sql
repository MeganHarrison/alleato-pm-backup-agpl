set statement_timeout = 0;
set lock_timeout = '5min';

create table if not exists public.source_syntheses (
  id uuid primary key default gen_random_uuid(),
  source_document_id text not null,
  source_family text not null check (
    source_family in (
      'fireflies',
      'outlook_email',
      'teams',
      'onedrive_document',
      'sharepoint_document',
      'email_attachment',
      'daily_log',
      'photo',
      'database_snapshot',
      'acumatica_sync',
      'other'
    )
  ),
  project_id integer null,
  source_occurred_at timestamptz null,
  source_title text null,
  source_url text null,
  full_source_hash text not null,
  synthesis_model text null,
  synthesis_status text not null default 'pending' check (
    synthesis_status in (
      'pending',
      'running',
      'succeeded',
      'failed_retryable',
      'failed_permanent',
      'skipped_no_content',
      'skipped_unchanged',
      'needs_project_review'
    )
  ),
  executive_summary text null,
  what_changed jsonb not null default '[]'::jsonb,
  decisions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  commitments jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  financial_signals jsonb not null default '[]'::jsonb,
  schedule_signals jsonb not null default '[]'::jsonb,
  change_event_signals jsonb not null default '[]'::jsonb,
  daily_log_signals jsonb not null default '[]'::jsonb,
  progress_report_signals jsonb not null default '[]'::jsonb,
  confidence text not null default 'unknown' check (confidence in ('high', 'medium', 'low', 'unknown')),
  confidence_notes text null,
  source_quotes jsonb not null default '[]'::jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  error_code text null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists source_syntheses_source_hash_idx
  on public.source_syntheses(source_document_id, full_source_hash);

create index if not exists source_syntheses_status_idx
  on public.source_syntheses(synthesis_status, created_at);

create index if not exists source_syntheses_project_occurred_idx
  on public.source_syntheses(project_id, source_occurred_at desc);

create index if not exists source_syntheses_family_idx
  on public.source_syntheses(source_family, source_occurred_at desc);

create table if not exists public.project_daily_deltas (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null,
  business_date date not null,
  status text not null default 'pending' check (
    status in (
      'pending',
      'running',
      'succeeded',
      'failed',
      'superseded',
      'skipped_no_sources'
    )
  ),
  source_synthesis_ids uuid[] not null default '{}'::uuid[],
  database_snapshot_id uuid null,
  headline text null,
  what_changed jsonb not null default '[]'::jsonb,
  decisions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  financial_changes jsonb not null default '[]'::jsonb,
  schedule_changes jsonb not null default '[]'::jsonb,
  change_event_candidates jsonb not null default '[]'::jsonb,
  task_candidates jsonb not null default '[]'::jsonb,
  daily_report_draft jsonb not null default '{}'::jsonb,
  progress_report_updates jsonb not null default '{}'::jsonb,
  source_coverage jsonb not null default '{}'::jsonb,
  confidence text not null default 'unknown' check (confidence in ('high', 'medium', 'low', 'unknown')),
  confidence_notes text null,
  model text null,
  token_usage jsonb not null default '{}'::jsonb,
  error_code text null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists project_daily_deltas_one_active_per_day_idx
  on public.project_daily_deltas(project_id, business_date)
  where status <> 'superseded';

create index if not exists project_daily_deltas_status_idx
  on public.project_daily_deltas(status, business_date desc);

create index if not exists project_daily_deltas_project_date_idx
  on public.project_daily_deltas(project_id, business_date desc);

comment on table public.source_syntheses is
  'Full-source AI synthesis rows reused by project intelligence, briefs, tasks, daily reports, and progress reports.';

comment on table public.project_daily_deltas is
  'One project/day synthesis delta from source syntheses plus app database snapshots.';

alter table public.source_syntheses enable row level security;
alter table public.project_daily_deltas enable row level security;

drop policy if exists source_syntheses_service_all on public.source_syntheses;
create policy source_syntheses_service_all
  on public.source_syntheses
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists project_daily_deltas_service_all on public.project_daily_deltas;
create policy project_daily_deltas_service_all
  on public.project_daily_deltas
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
