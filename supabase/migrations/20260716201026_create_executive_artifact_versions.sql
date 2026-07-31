begin;

create table if not exists public.executive_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_kind text not null check (artifact_kind in ('daily', 'weekly')),
  packet_id uuid not null references public.intelligence_packets(id) on delete restrict,
  issued_at timestamptz not null default now(),
  integrity_status text not null check (integrity_status in ('ready', 'limited', 'blocked')),
  source_assessment jsonb not null default '{}'::jsonb,
  state_snapshot jsonb not null default '{}'::jsonb,
  attention_snapshot jsonb not null default '[]'::jsonb,
  conflict_snapshot jsonb not null default '[]'::jsonb,
  unique (artifact_kind, packet_id)
);

create index if not exists executive_artifact_versions_packet_idx
  on public.executive_artifact_versions(packet_id, issued_at desc);

alter table public.executive_artifact_versions enable row level security;

drop policy if exists executive_artifact_versions_service_read on public.executive_artifact_versions;
create policy executive_artifact_versions_service_read
  on public.executive_artifact_versions
  for select to service_role
  using (true);

drop policy if exists executive_artifact_versions_service_insert on public.executive_artifact_versions;
create policy executive_artifact_versions_service_insert
  on public.executive_artifact_versions
  for insert to service_role
  with check (true);

create or replace function public.prevent_executive_artifact_version_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Executive artifact versions are immutable. Issue a new version for a new canonical packet.';
end;
$$;

drop trigger if exists executive_artifact_versions_immutable on public.executive_artifact_versions;
create trigger executive_artifact_versions_immutable
before update or delete on public.executive_artifact_versions
for each row execute function public.prevent_executive_artifact_version_mutation();

revoke all on table public.executive_artifact_versions from anon, authenticated;
grant select, insert on table public.executive_artifact_versions to service_role;

comment on table public.executive_artifact_versions is
  'Immutable governed Daily/Weekly executive artifact snapshots. Delivery attempts remain in ai_work_run_delivery_attempts and link through the artifact metadata.';

commit;
