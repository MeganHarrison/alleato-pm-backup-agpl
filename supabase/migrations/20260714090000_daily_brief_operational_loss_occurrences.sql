-- Canonical Daily Brief occurrence lineage for the existing recurring-issue
-- master/evidence model. A row is an evidence-backed daily observation, not a
-- confirmed financial loss or a person-level assessment.

alter table public.recurring_issues
  add column if not exists operational_loss_key text;

create unique index if not exists recurring_issues_operational_loss_key_unique
  on public.recurring_issues (operational_loss_key)
  where operational_loss_key is not null;

create table if not exists public.operational_loss_occurrences (
  id uuid primary key default gen_random_uuid(),
  recurring_issue_id uuid not null references public.recurring_issues(id) on delete cascade,
  packet_id uuid not null references public.intelligence_packets(id) on delete cascade,
  business_date date not null,
  finding_key text not null,
  observed_condition text not null,
  preventability text not null check (preventability in ('preventable', 'partially_preventable', 'cannot_determine')),
  preventability_basis text not null,
  missing_control text not null,
  recommended_system text not null,
  accountable_role text,
  leading_indicator text,
  source_aliases text[] not null default '{}'::text[],
  source_evidence jsonb not null default '[]'::jsonb,
  confidence text not null default 'medium' check (confidence in ('high', 'medium', 'low')),
  review_status text not null default 'needs_review' check (review_status in ('needs_review', 'reviewed', 'excluded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_loss_occurrences_packet_finding_unique unique (packet_id, finding_key),
  constraint operational_loss_occurrences_source_evidence_array check (jsonb_typeof(source_evidence) = 'array')
);

create index if not exists operational_loss_occurrences_issue_date_idx
  on public.operational_loss_occurrences (recurring_issue_id, business_date desc);
create index if not exists operational_loss_occurrences_packet_idx
  on public.operational_loss_occurrences (packet_id);
create index if not exists operational_loss_occurrences_review_idx
  on public.operational_loss_occurrences (review_status, business_date desc);

drop trigger if exists trg_operational_loss_occurrences_updated_at on public.operational_loss_occurrences;
create trigger trg_operational_loss_occurrences_updated_at
  before update on public.operational_loss_occurrences
  for each row execute function public.set_recurring_issues_updated_at();

alter table public.operational_loss_occurrences enable row level security;

drop policy if exists "auth read operational_loss_occurrences" on public.operational_loss_occurrences;
create policy "auth read operational_loss_occurrences"
  on public.operational_loss_occurrences for select to authenticated using (true);

comment on table public.operational_loss_occurrences is
  'Immutable Daily Brief prevention finding linked to its canonical packet and cited source manifest. Review status controls whether an AI observation is treated as reviewed; all rows remain evidence-backed occurrences, not financial-loss estimates.';
comment on column public.recurring_issues.operational_loss_key is
  'Stable normalized pattern key used only by the Daily Brief operational-loss consumer to link recurring occurrences to one master issue.';
