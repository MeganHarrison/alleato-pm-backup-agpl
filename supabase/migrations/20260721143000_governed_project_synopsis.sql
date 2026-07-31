-- Ticket 08: retain governed synopsis provenance/history and protect human edits.
alter table public.project_current_state
  add column if not exists synopsis_revision integer not null default 0,
  add column if not exists synopsis_human_edited boolean not null default false,
  add column if not exists synopsis_human_edited_at timestamptz,
  add column if not exists synopsis_source_packet_id uuid references public.intelligence_packets(id) on delete set null,
  add column if not exists synopsis_freshness text,
  add column if not exists synopsis_confidence text,
  add column if not exists synopsis_source_lineage jsonb not null default '{}'::jsonb;

create table if not exists public.project_synopsis_history (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  revision integer not null,
  summary text,
  source_packet_id uuid references public.intelligence_packets(id) on delete set null,
  freshness text,
  confidence text,
  source_lineage jsonb not null default '{}'::jsonb,
  human_edited boolean not null default false,
  recorded_at timestamptz not null default timezone('utc'::text, now()),
  unique (project_id, revision)
);

-- Seed revision zero for rows created before this governed history existed.
insert into public.project_synopsis_history
  (project_id, revision, summary, source_packet_id, freshness, confidence, source_lineage, human_edited)
select project_id, synopsis_revision, current_summary, synopsis_source_packet_id,
       synopsis_freshness, synopsis_confidence, synopsis_source_lineage, synopsis_human_edited
from public.project_current_state
on conflict (project_id, revision) do nothing;

create or replace function public.project_current_state_synopsis_guard()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
begin
  -- Controlled writers may update provenance, but never overwrite a PM's edit.
  if old.synopsis_human_edited and new.current_summary is distinct from old.current_summary then
    new.current_summary := old.current_summary;
  end if;
  if new.current_summary is distinct from old.current_summary then
    new.synopsis_revision := old.synopsis_revision + 1;
  else
    new.synopsis_revision := old.synopsis_revision;
  end if;
  new.synopsis_source_packet_id := nullif(new.projection_provenance->>'packet_id', '')::uuid;
  new.synopsis_source_lineage := coalesce(new.projection_provenance, '{}'::jsonb);
  new.synopsis_freshness := coalesce(new.source_confidence->>'freshness_status', new.synopsis_freshness);
  new.synopsis_confidence := coalesce(new.source_confidence->>'confidence', new.synopsis_confidence);
  return new;
exception when invalid_text_representation then
  new.synopsis_source_packet_id := old.synopsis_source_packet_id;
  return new;
end;
$$;

drop trigger if exists project_current_state_synopsis_guard on public.project_current_state;
create trigger project_current_state_synopsis_guard
  before update on public.project_current_state
  for each row execute function public.project_current_state_synopsis_guard();

create or replace function public.record_project_synopsis_history()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
begin
  insert into public.project_synopsis_history
    (project_id, revision, summary, source_packet_id, freshness, confidence, source_lineage, human_edited)
  values
    (new.project_id, new.synopsis_revision, new.current_summary, new.synopsis_source_packet_id,
     new.synopsis_freshness, new.synopsis_confidence, new.synopsis_source_lineage, new.synopsis_human_edited)
  on conflict (project_id, revision) do update set
    summary = excluded.summary, source_packet_id = excluded.source_packet_id,
    freshness = excluded.freshness, confidence = excluded.confidence,
    source_lineage = excluded.source_lineage, human_edited = excluded.human_edited;
  return new;
end;
$$;

drop trigger if exists record_project_synopsis_history on public.project_current_state;
create trigger record_project_synopsis_history
  after insert or update on public.project_current_state
  for each row execute function public.record_project_synopsis_history();
