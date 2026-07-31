-- Alleato AI intelligence packets.
--
-- V1 supports packet-first client project intelligence while keeping internal
-- initiative targets isolated until an explicit visibility model exists.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.intelligence_targets (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('client_project','internal_initiative','vendor_platform','company_process')),
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'active',
  priority text,
  owner_person_id uuid null references public.people(id),
  project_id integer null references public.projects(id),
  metadata jsonb not null default '{}'::jsonb,
  last_signal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_targets_client_project_requires_project
    check (
      (target_type = 'client_project' and project_id is not null)
      or (target_type <> 'client_project' and project_id is null)
    )
);

create table if not exists public.insight_cards (
  id uuid primary key default gen_random_uuid(),
  primary_target_id uuid not null references public.intelligence_targets(id),
  title text not null,
  card_type text not null check (card_type in ('risk','decision','blocker','task','product_need','process_issue','project_update','open_question','requirement','financial_exposure','change_management','schedule_risk')),
  summary text not null,
  why_it_matters text,
  current_status text not null default 'open' check (current_status in ('open','resolved','blocked','needs_review','stale','rejected')),
  confidence text not null check (confidence in ('high','medium','low')),
  attribution_status text not null default 'candidate' check (attribution_status in ('auto_assigned','candidate','needs_review','approved','rejected')),
  suggested_owner_person_id uuid null references public.people(id),
  suggested_owner_label text,
  next_action text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  stale_after timestamptz,
  source_count integer not null default 0,
  compiler_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insight_card_targets (
  id uuid primary key default gen_random_uuid(),
  insight_card_id uuid not null references public.insight_cards(id) on delete cascade,
  target_id uuid not null references public.intelligence_targets(id),
  relationship text not null,
  confidence text not null check (confidence in ('high','medium','low')),
  attribution_status text not null default 'candidate' check (attribution_status in ('auto_assigned','candidate','needs_review','approved','rejected')),
  matched_terms text[] not null default '{}',
  reason text,
  reviewed_by uuid null references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insight_card_evidence (
  id uuid primary key default gen_random_uuid(),
  insight_card_id uuid not null references public.insight_cards(id) on delete cascade,
  source_document_id text null references public.document_metadata(id) on delete set null,
  source_chunk_id text null,
  source_type text not null,
  source_title text,
  source_occurred_at timestamptz,
  source_message_id text,
  participants text[] not null default '{}',
  excerpt text,
  summary text,
  relevance_reason text not null,
  evidence_role text not null,
  confidence text not null check (confidence in ('high','medium','low')),
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_packets (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.intelligence_targets(id),
  packet_type text not null default 'current' check (packet_type in ('current','snapshot','manual_gold_standard')),
  packet_version text not null,
  generated_at timestamptz not null default now(),
  covered_start_at timestamptz,
  covered_end_at timestamptz,
  freshness_status text not null check (freshness_status in ('fresh','stale','partial','working_sample','failed')),
  executive_summary text not null,
  current_status text,
  strategic_read text,
  why_it_matters text,
  recommended_next_moves text[] not null default '{}',
  confidence_summary jsonb not null default '{}'::jsonb,
  source_coverage jsonb not null default '{}'::jsonb,
  review_queue_count integer not null default 0,
  stale_item_count integer not null default 0,
  packet_json jsonb not null default '{}'::jsonb,
  compiler_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_packet_cards (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.intelligence_packets(id) on delete cascade,
  insight_card_id uuid not null references public.insight_cards(id),
  section text not null,
  rank integer not null default 0,
  included_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_reviews (
  id uuid primary key default gen_random_uuid(),
  review_type text not null,
  status text not null default 'open' check (status in ('open','approved','rejected','edited','deferred')),
  insight_card_id uuid null references public.insight_cards(id) on delete cascade,
  target_link_id uuid null references public.insight_card_targets(id) on delete cascade,
  evidence_id uuid null references public.insight_card_evidence(id) on delete cascade,
  review_reason text not null,
  proposed_value jsonb not null default '{}'::jsonb,
  reviewed_value jsonb,
  reviewed_by uuid null references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists intelligence_targets_client_project_project_id_unique
  on public.intelligence_targets(project_id)
  where target_type = 'client_project' and project_id is not null;

create index if not exists intelligence_targets_project_id_idx on public.intelligence_targets(project_id);
create index if not exists intelligence_targets_type_slug_idx on public.intelligence_targets(target_type, slug);
create index if not exists insight_cards_target_status_idx on public.insight_cards(primary_target_id, current_status, confidence);
create index if not exists insight_card_targets_target_idx on public.insight_card_targets(target_id, attribution_status, confidence);
create index if not exists insight_card_targets_card_idx on public.insight_card_targets(insight_card_id);
create unique index if not exists insight_card_targets_one_primary_per_card_idx
  on public.insight_card_targets(insight_card_id)
  where relationship = 'primary';
create index if not exists insight_card_evidence_card_idx on public.insight_card_evidence(insight_card_id, source_occurred_at desc);
create index if not exists insight_card_evidence_source_document_idx on public.insight_card_evidence(source_document_id);
create index if not exists intelligence_packets_current_lookup_idx on public.intelligence_packets(target_id, packet_type, generated_at desc);
create unique index if not exists intelligence_packets_one_current_per_target
  on public.intelligence_packets(target_id)
  where packet_type = 'current';
create index if not exists intelligence_packet_cards_packet_idx on public.intelligence_packet_cards(packet_id, section, rank);
create index if not exists intelligence_packet_cards_card_idx on public.intelligence_packet_cards(insight_card_id);
create index if not exists intelligence_reviews_open_idx on public.intelligence_reviews(status, created_at);
create index if not exists intelligence_reviews_card_idx on public.intelligence_reviews(insight_card_id);

drop trigger if exists intelligence_targets_set_updated_at on public.intelligence_targets;
create trigger intelligence_targets_set_updated_at
  before update on public.intelligence_targets
  for each row execute function public.set_updated_at();

drop trigger if exists insight_cards_set_updated_at on public.insight_cards;
create trigger insight_cards_set_updated_at
  before update on public.insight_cards
  for each row execute function public.set_updated_at();

drop trigger if exists insight_card_targets_set_updated_at on public.insight_card_targets;
create trigger insight_card_targets_set_updated_at
  before update on public.insight_card_targets
  for each row execute function public.set_updated_at();

drop trigger if exists intelligence_reviews_set_updated_at on public.intelligence_reviews;
create trigger intelligence_reviews_set_updated_at
  before update on public.intelligence_reviews
  for each row execute function public.set_updated_at();

alter table public.intelligence_targets enable row level security;
alter table public.insight_cards enable row level security;
alter table public.insight_card_targets enable row level security;
alter table public.insight_card_evidence enable row level security;
alter table public.intelligence_packets enable row level security;
alter table public.intelligence_packet_cards enable row level security;
alter table public.intelligence_reviews enable row level security;

drop policy if exists intelligence_targets_select on public.intelligence_targets;
create policy intelligence_targets_select
  on public.intelligence_targets
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or (
      target_type = 'client_project'
      and project_id is not null
      and public.current_is_project_member(project_id)
    )
  );

drop policy if exists intelligence_targets_service_write on public.intelligence_targets;
create policy intelligence_targets_service_write
  on public.intelligence_targets
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists insight_cards_select on public.insight_cards;
create policy insight_cards_select
  on public.insight_cards
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = insight_cards.primary_target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists insight_cards_service_write on public.insight_cards;
create policy insight_cards_service_write
  on public.insight_cards
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists insight_card_targets_select on public.insight_card_targets;
create policy insight_card_targets_select
  on public.insight_card_targets
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = insight_card_targets.target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists insight_card_targets_service_write on public.insight_card_targets;
create policy insight_card_targets_service_write
  on public.insight_card_targets
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists insight_card_evidence_select on public.insight_card_evidence;
create policy insight_card_evidence_select
  on public.insight_card_evidence
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.insight_cards c
      join public.intelligence_targets t on t.id = c.primary_target_id
      where c.id = insight_card_evidence.insight_card_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists insight_card_evidence_service_write on public.insight_card_evidence;
create policy insight_card_evidence_service_write
  on public.insight_card_evidence
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists intelligence_packets_select on public.intelligence_packets;
create policy intelligence_packets_select
  on public.intelligence_packets
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.intelligence_targets t
      where t.id = intelligence_packets.target_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists intelligence_packets_service_write on public.intelligence_packets;
create policy intelligence_packets_service_write
  on public.intelligence_packets
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists intelligence_packet_cards_select on public.intelligence_packet_cards;
create policy intelligence_packet_cards_select
  on public.intelligence_packet_cards
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.intelligence_packets p
      join public.intelligence_targets t on t.id = p.target_id
      where p.id = intelligence_packet_cards.packet_id
        and t.target_type = 'client_project'
        and t.project_id is not null
        and public.current_is_project_member(t.project_id)
    )
  );

drop policy if exists intelligence_packet_cards_service_write on public.intelligence_packet_cards;
create policy intelligence_packet_cards_service_write
  on public.intelligence_packet_cards
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists intelligence_reviews_select on public.intelligence_reviews;
create policy intelligence_reviews_select
  on public.intelligence_reviews
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or (
      insight_card_id is not null
      and exists (
        select 1
        from public.insight_cards c
        join public.intelligence_targets t on t.id = c.primary_target_id
        where c.id = intelligence_reviews.insight_card_id
          and t.target_type = 'client_project'
          and t.project_id is not null
          and public.current_is_project_member(t.project_id)
      )
    )
  );

drop policy if exists intelligence_reviews_service_write on public.intelligence_reviews;
create policy intelligence_reviews_service_write
  on public.intelligence_reviews
  for all
  to service_role
  using (true)
  with check (true);

grant select on
  public.intelligence_targets,
  public.insight_cards,
  public.insight_card_targets,
  public.insight_card_evidence,
  public.intelligence_packets,
  public.intelligence_packet_cards,
  public.intelligence_reviews
to authenticated;

grant all on
  public.intelligence_targets,
  public.insight_cards,
  public.insight_card_targets,
  public.insight_card_evidence,
  public.intelligence_packets,
  public.intelligence_packet_cards,
  public.intelligence_reviews
to service_role;

comment on table public.intelligence_targets is
  'Stable AI intelligence subjects such as client projects and internal initiatives.';
comment on table public.intelligence_packets is
  'Compiled packet-first advisor summaries. Current packets are unique per target.';
comment on column public.insight_card_evidence.source_chunk_id is
  'Soft reference to document_chunks.chunk_id. No FK until live uniqueness is guaranteed.';

commit;
