-- Versioned weekly progress report refinement and explicit review state.
alter table public.project_progress_reports
  add column if not exists version integer not null default 1,
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists refined_at timestamptz,
  add column if not exists refined_by uuid references auth.users(id);

alter table public.project_progress_reports
  drop constraint if exists project_progress_reports_review_status_check;
alter table public.project_progress_reports
  add constraint project_progress_reports_review_status_check
  check (review_status in ('needs_review', 'approved', 'sent'));

create table if not exists public.project_progress_report_versions (
  id uuid primary key default gen_random_uuid(),
  progress_report_id uuid not null references public.project_progress_reports(id) on delete cascade,
  project_id integer not null references public.projects(id) on delete cascade,
  version integer not null,
  action text not null check (action in ('created', 'refined', 'edited', 'approved', 'sent')),
  audience text not null default 'client' check (audience in ('internal', 'client')),
  content jsonb not null default '{}'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (progress_report_id, version)
);

create index if not exists idx_progress_report_versions_report
  on public.project_progress_report_versions(progress_report_id, version desc);

alter table public.project_progress_report_versions enable row level security;
create policy "project_progress_report_versions_select" on public.project_progress_report_versions
  for select using (auth.uid() is not null);
create policy "project_progress_report_versions_insert" on public.project_progress_report_versions
  for insert with check (auth.uid() is not null);

comment on table public.project_progress_report_versions is
  'Immutable audit snapshots for weekly progress report creation, refinement, review, and send transitions.';
