-- Durable cumulative Product Intelligence findings.
-- A current intelligence_packets row is a replaceable read model; these rows
-- retain the finding identity and its lifecycle across packet refreshes.
begin;

create table if not exists public.project_intelligence_packet_items (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  packet_id uuid not null references public.intelligence_packets(id) on delete cascade,
  executive_artifact_id uuid null references public.executive_artifact_versions(id) on delete set null,
  item_type text not null check (item_type in ('timeline','insight','risk','opportunity','decision','unresolved_question')),
  finding_key text not null,
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open','resolved','superseded')),
  occurred_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  source_document_ids text[] not null default '{}',
  source_evidence jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, item_type, finding_key)
);

create index if not exists project_intelligence_packet_items_project_idx
  on public.project_intelligence_packet_items(project_id, item_type, last_seen_at desc);
create index if not exists project_intelligence_packet_items_status_idx
  on public.project_intelligence_packet_items(project_id, status, last_seen_at desc);

drop trigger if exists project_intelligence_packet_items_set_updated_at on public.project_intelligence_packet_items;
create trigger project_intelligence_packet_items_set_updated_at
  before update on public.project_intelligence_packet_items
  for each row execute function public.set_updated_at();

alter table public.project_intelligence_packet_items enable row level security;
drop policy if exists project_intelligence_packet_items_service_read on public.project_intelligence_packet_items;
create policy project_intelligence_packet_items_service_read
  on public.project_intelligence_packet_items for select to service_role using (true);
drop policy if exists project_intelligence_packet_items_service_write on public.project_intelligence_packet_items;
create policy project_intelligence_packet_items_service_write
  on public.project_intelligence_packet_items for all to service_role using (true) with check (true);
drop policy if exists project_intelligence_packet_items_project_read on public.project_intelligence_packet_items;
create policy project_intelligence_packet_items_project_read
  on public.project_intelligence_packet_items for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_intelligence_packet_items.project_id));

comment on table public.project_intelligence_packet_items is
  'Cumulative, deduplicated project findings projected from replaceable intelligence packets with source and executive-artifact lineage.';
commit;
