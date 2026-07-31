-- AAI-1107: the monthly review is a governed consumer of an immutable monthly
-- artifact version. This records release governance without introducing a
-- parallel report compiler or delivery ledger.

begin;

alter table public.executive_artifact_versions
  drop constraint if exists executive_artifact_versions_artifact_kind_check;

alter table public.executive_artifact_versions
  add constraint executive_artifact_versions_artifact_kind_check
  check (artifact_kind in ('daily', 'weekly', 'monthly'));

create table if not exists public.executive_monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  artifact_version_id uuid not null references public.executive_artifact_versions(id) on delete restrict,
  review_period date not null,
  source_coverage jsonb not null,
  financial_readiness jsonb not null,
  delivery_snapshot jsonb not null,
  supersedes_review_id uuid null references public.executive_monthly_reviews(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (artifact_version_id)
);

create index if not exists executive_monthly_reviews_period_idx
  on public.executive_monthly_reviews(review_period desc, created_at desc);

create table if not exists public.executive_monthly_review_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.executive_monthly_reviews(id) on delete restrict,
  action text not null check (action in ('issued', 'finance_closed', 'executive_approved', 'superseded')),
  actor_user_id uuid null,
  actor_label text not null,
  rationale text null,
  created_at timestamptz not null default now()
);

create index if not exists executive_monthly_review_events_review_idx
  on public.executive_monthly_review_events(review_id, created_at asc);

alter table public.executive_monthly_reviews enable row level security;
alter table public.executive_monthly_review_events enable row level security;

revoke all on table public.executive_monthly_reviews from public, anon, authenticated;
revoke all on table public.executive_monthly_review_events from public, anon, authenticated;
grant select, insert on table public.executive_monthly_reviews to service_role;
grant select, insert on table public.executive_monthly_review_events to service_role;

create or replace function public.prevent_executive_monthly_review_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Monthly executive review records are immutable. Issue a governed artifact version and append a governance event.';
end;
$$;

drop trigger if exists executive_monthly_reviews_immutable on public.executive_monthly_reviews;
create trigger executive_monthly_reviews_immutable
before update or delete on public.executive_monthly_reviews
for each row execute function public.prevent_executive_monthly_review_mutation();

create or replace function public.prevent_executive_monthly_review_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Monthly executive review governance events are append-only.';
end;
$$;

drop trigger if exists executive_monthly_review_events_immutable on public.executive_monthly_review_events;
create trigger executive_monthly_review_events_immutable
before update or delete on public.executive_monthly_review_events
for each row execute function public.prevent_executive_monthly_review_event_mutation();

comment on table public.executive_monthly_reviews is
  'Immutable monthly-review evidence derived from a governed executive artifact version. Delivery remains packet-correlated in the AI Ops ledger.';
comment on table public.executive_monthly_review_events is
  'Append-only finance-close and executive-approval evidence for a monthly executive review.';

commit;
