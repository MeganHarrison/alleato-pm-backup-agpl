create table if not exists public.submittal_ai_review_runs (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  submittal_id uuid not null references public.submittals(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'ready', 'partial', 'not_ready', 'failed')),
  focus_area text,
  summary text,
  recommendation text,
  readiness jsonb not null default '{}'::jsonb,
  source_coverage jsonb not null default '{}'::jsonb,
  raw_model_output jsonb,
  validated_output jsonb,
  error_code text,
  error_message text,
  model_id text,
  created_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_submittal_ai_review_runs_submittal_created
  on public.submittal_ai_review_runs(submittal_id, created_at desc);

create index if not exists idx_submittal_ai_review_runs_project_status
  on public.submittal_ai_review_runs(project_id, status, created_at desc);

create table if not exists public.submittal_ai_review_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.submittal_ai_review_runs(id) on delete cascade,
  project_id integer not null references public.projects(id) on delete cascade,
  submittal_id uuid not null references public.submittals(id) on delete cascade,
  check_type text not null,
  status text not null check (status in ('pass', 'fail', 'warning', 'missing_information', 'unable_to_determine', 'needs_human_review')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'informational')),
  title text not null,
  finding text not null,
  expected_value text,
  submitted_value text,
  recommendation text,
  source_references jsonb not null default '[]'::jsonb,
  confidence numeric,
  missing_data jsonb not null default '[]'::jsonb,
  reviewer_disposition text not null default 'pending'
    check (reviewer_disposition in ('pending', 'accepted', 'dismissed', 'edited')),
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_submittal_ai_review_checks_run
  on public.submittal_ai_review_checks(run_id, created_at asc);

create index if not exists idx_submittal_ai_review_checks_submittal
  on public.submittal_ai_review_checks(submittal_id, created_at desc);

alter table public.submittal_ai_review_runs enable row level security;
alter table public.submittal_ai_review_checks enable row level security;
