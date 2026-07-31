-- Job Planner <-> Acumatica reconciliation persistence + triage.
-- Accessed only via API routes using the service client; RLS on with no public
-- policies = deny by default (service role bypasses RLS).

create table if not exists public.reconciliation_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','complete','failed')),
  source text not null default 'manual' check (source in ('manual','cron')),
  projects_scanned int not null default 0,
  findings_total int not null default 0,
  high_count int not null default 0,
  dollars_at_risk_cents bigint not null default 0,
  acumatica_checked boolean not null default false,
  error text
);

create table if not exists public.reconciliation_findings (
  fingerprint text primary key,
  jp_project_id int not null,
  jp_project_name text not null,
  record_type text not null,
  record_ref text not null,
  cost_code_label text,
  cost_code text,
  cost_type text,
  kind text not null,
  tier text not null,
  detail text not null,
  amount_cents bigint,
  jp_value_cents bigint,
  acu_value_cents bigint,
  jp_modified_on timestamptz,
  last_synced_on timestamptz,
  external_id text,
  external_model text,
  acumatica_checked boolean not null default false,
  is_active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_run_id bigint references public.reconciliation_runs(id),
  review_status text not null default 'open' check (review_status in ('open','reviewed','resolved')),
  reviewed_by text,
  reviewed_at timestamptz
);

create index if not exists reconciliation_findings_active_idx
  on public.reconciliation_findings (is_active, tier, review_status);
create index if not exists reconciliation_findings_project_idx
  on public.reconciliation_findings (jp_project_id);

alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_findings enable row level security;
