begin;

alter table public.fmds_tables
  add column review_priority smallint not null default 2
    check (review_priority between 1 and 3),
  add column review_reason text not null default '2026 revision table/figure renumbering verification';

alter table public.fmds_figures
  add column review_priority smallint not null default 2
    check (review_priority between 1 and 3),
  add column review_reason text not null default '2026 revision table/figure renumbering verification';

create table public.fmds_visual_review_candidates (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  source_type text not null check (source_type in ('table', 'figure')),
  source_id uuid not null,
  candidate_kind text not null
    check (candidate_kind in ('native_grid', 'ocr', 'vision', 'manual_import')),
  provider text not null,
  model text not null,
  prompt_version text not null,
  input_sha256 text not null,
  output jsonb not null,
  confidence numeric check (confidence between 0 and 1),
  status text not null default 'candidate'
    check (status in ('candidate', 'superseded', 'rejected')),
  extraction_error text,
  created_at timestamptz not null default now(),
  unique (
    source_type,
    source_id,
    candidate_kind,
    provider,
    model,
    prompt_version,
    input_sha256
  )
);

create index fmds_visual_review_candidates_source_idx
  on public.fmds_visual_review_candidates (source_type, source_id, created_at desc);
create index fmds_visual_review_candidates_revision_status_idx
  on public.fmds_visual_review_candidates (revision_id, status, source_type);

create table public.fmds_visual_review_events (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  source_type text not null check (source_type in ('table', 'figure')),
  source_id uuid not null,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  reviewer_id text not null check (length(btrim(reviewer_id)) > 0),
  reviewer_role text not null check (length(btrim(reviewer_role)) > 0),
  notes text not null check (length(btrim(notes)) >= 10),
  evidence_paths text[] not null check (cardinality(evidence_paths) > 0),
  candidate_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index fmds_visual_review_events_source_idx
  on public.fmds_visual_review_events (source_type, source_id, created_at desc);
create index fmds_visual_review_events_revision_decision_idx
  on public.fmds_visual_review_events (revision_id, decision, created_at desc);

create or replace function public.validate_fmds_review_source()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_revision_id uuid;
begin
  if new.source_type = 'table' then
    select revision_id into source_revision_id
    from public.fmds_tables
    where id = new.source_id;
  elsif new.source_type = 'figure' then
    select revision_id into source_revision_id
    from public.fmds_figures
    where id = new.source_id;
  end if;

  if source_revision_id is null then
    raise exception 'Unknown FMDS % source %', new.source_type, new.source_id;
  end if;
  if source_revision_id <> new.revision_id then
    raise exception 'FMDS review source % belongs to revision %, not %',
      new.source_id, source_revision_id, new.revision_id;
  end if;
  return new;
end;
$$;

create trigger validate_fmds_visual_review_candidate_source
before insert or update on public.fmds_visual_review_candidates
for each row execute function public.validate_fmds_review_source();

create trigger validate_fmds_visual_review_event_source
before insert on public.fmds_visual_review_events
for each row execute function public.validate_fmds_review_source();

create or replace function public.prevent_fmds_review_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'FMDS visual review events are append-only';
end;
$$;

create trigger prevent_fmds_review_event_update
before update on public.fmds_visual_review_events
for each row execute function public.prevent_fmds_review_event_mutation();

create trigger prevent_fmds_review_event_delete
before delete on public.fmds_visual_review_events
for each row execute function public.prevent_fmds_review_event_mutation();

create or replace function public.guard_fmds_review_promotion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  approved_event_id uuid;
  expected_source_type text := tg_argv[0];
begin
  if new.review_status = 'reviewed' and old.review_status <> 'reviewed' then
    begin
      approved_event_id := nullif(current_setting('app.fmds_review_event_id', true), '')::uuid;
    exception when invalid_text_representation then
      approved_event_id := null;
    end;

    if approved_event_id is null or not exists (
      select 1
      from public.fmds_visual_review_events e
      where e.id = approved_event_id
        and e.source_type = expected_source_type
        and e.source_id = new.id
        and e.revision_id = new.revision_id
        and e.decision = 'approved'
    ) then
      raise exception 'FMDS % % cannot be marked reviewed without an attributed approval event',
        expected_source_type, new.id;
    end if;
    if new.evidence_image_path is null then
      raise exception 'FMDS % % cannot be approved without rendered evidence',
        expected_source_type, new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_fmds_table_review_promotion
before update of review_status on public.fmds_tables
for each row execute function public.guard_fmds_review_promotion('table');

create trigger guard_fmds_figure_review_promotion
before update of review_status on public.fmds_figures
for each row execute function public.guard_fmds_review_promotion('figure');

create or replace function public.record_fmds_visual_review(
  requested_source_type text,
  requested_source_id uuid,
  requested_decision text,
  requested_reviewer_id text,
  requested_reviewer_role text,
  requested_notes text,
  requested_evidence_paths text[],
  requested_candidate_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_revision_id uuid;
  source_evidence_path text;
  revision_status text;
  event_id uuid;
  candidate_count integer;
begin
  if requested_source_type not in ('table', 'figure') then
    raise exception 'Unsupported FMDS review source type: %', requested_source_type;
  end if;
  if requested_decision not in ('approved', 'rejected', 'changes_requested') then
    raise exception 'Unsupported FMDS review decision: %', requested_decision;
  end if;
  if length(btrim(coalesce(requested_reviewer_id, ''))) = 0
     or length(btrim(coalesce(requested_reviewer_role, ''))) = 0 then
    raise exception 'FMDS review requires reviewer identity and role';
  end if;
  if length(btrim(coalesce(requested_notes, ''))) < 10 then
    raise exception 'FMDS review notes must contain at least 10 characters';
  end if;
  if coalesce(cardinality(requested_evidence_paths), 0) = 0 then
    raise exception 'FMDS review requires at least one evidence path';
  end if;

  if requested_source_type = 'table' then
    select revision_id, evidence_image_path
    into source_revision_id, source_evidence_path
    from public.fmds_tables
    where id = requested_source_id
    for update;
  else
    select revision_id, evidence_image_path
    into source_revision_id, source_evidence_path
    from public.fmds_figures
    where id = requested_source_id
    for update;
  end if;

  if source_revision_id is null then
    raise exception 'Unknown FMDS % source %', requested_source_type, requested_source_id;
  end if;
  select status into revision_status
  from public.fmds_corpus_revisions
  where id = source_revision_id;
  if revision_status <> 'staging' then
    raise exception 'FMDS visual review requires a staging revision; current status is %', revision_status;
  end if;
  if source_evidence_path is null or not (source_evidence_path = any(requested_evidence_paths)) then
    raise exception 'FMDS review evidence must include the source rendered image path %', source_evidence_path;
  end if;

  if coalesce(cardinality(requested_candidate_ids), 0) > 0 then
    select count(*) into candidate_count
    from public.fmds_visual_review_candidates c
    where c.id = any(requested_candidate_ids)
      and c.source_type = requested_source_type
      and c.source_id = requested_source_id
      and c.revision_id = source_revision_id;
    if candidate_count <> cardinality(requested_candidate_ids) then
      raise exception 'One or more FMDS candidate IDs do not belong to this review source';
    end if;
  end if;

  insert into public.fmds_visual_review_events (
    revision_id,
    source_type,
    source_id,
    decision,
    reviewer_id,
    reviewer_role,
    notes,
    evidence_paths,
    candidate_ids
  ) values (
    source_revision_id,
    requested_source_type,
    requested_source_id,
    requested_decision,
    requested_reviewer_id,
    requested_reviewer_role,
    requested_notes,
    requested_evidence_paths,
    requested_candidate_ids
  ) returning id into event_id;

  perform set_config('app.fmds_review_event_id', event_id::text, true);

  if requested_source_type = 'table' then
    update public.fmds_tables
    set review_status = case requested_decision
      when 'approved' then 'reviewed'
      when 'rejected' then 'rejected'
      else 'needs_review'
    end
    where id = requested_source_id;
  else
    update public.fmds_figures
    set review_status = case requested_decision
      when 'approved' then 'reviewed'
      when 'rejected' then 'rejected'
      else 'needs_review'
    end
    where id = requested_source_id;
  end if;

  return event_id;
end;
$$;

create or replace view public.fmds_visual_review_queue
with (security_invoker = true)
as
select
  'table'::text as source_type,
  t.id as source_id,
  t.revision_id,
  r.document_code,
  r.revision_label,
  t.table_identifier as identifier,
  t.title,
  t.page_start as page_number,
  t.caption_text,
  t.evidence_image_path,
  t.bounding_box,
  t.review_priority,
  t.review_reason,
  t.review_status,
  coalesce(c.candidate_count, 0)::integer as candidate_count,
  e.decision as latest_decision,
  e.reviewer_id as latest_reviewer_id,
  e.created_at as latest_reviewed_at
from public.fmds_tables t
join public.fmds_corpus_revisions r on r.id = t.revision_id
left join lateral (
  select count(*) as candidate_count
  from public.fmds_visual_review_candidates c0
  where c0.source_type = 'table' and c0.source_id = t.id and c0.status = 'candidate'
) c on true
left join lateral (
  select e0.decision, e0.reviewer_id, e0.created_at
  from public.fmds_visual_review_events e0
  where e0.source_type = 'table' and e0.source_id = t.id
  order by e0.created_at desc
  limit 1
) e on true
union all
select
  'figure'::text as source_type,
  f.id as source_id,
  f.revision_id,
  r.document_code,
  r.revision_label,
  f.figure_identifier as identifier,
  f.title,
  f.page_number,
  f.caption_text,
  f.evidence_image_path,
  f.bounding_box,
  f.review_priority,
  f.review_reason,
  f.review_status,
  coalesce(c.candidate_count, 0)::integer as candidate_count,
  e.decision as latest_decision,
  e.reviewer_id as latest_reviewer_id,
  e.created_at as latest_reviewed_at
from public.fmds_figures f
join public.fmds_corpus_revisions r on r.id = f.revision_id
left join lateral (
  select count(*) as candidate_count
  from public.fmds_visual_review_candidates c0
  where c0.source_type = 'figure' and c0.source_id = f.id and c0.status = 'candidate'
) c on true
left join lateral (
  select e0.decision, e0.reviewer_id, e0.created_at
  from public.fmds_visual_review_events e0
  where e0.source_type = 'figure' and e0.source_id = f.id
  order by e0.created_at desc
  limit 1
) e on true;

alter table public.fmds_visual_review_candidates enable row level security;
alter table public.fmds_visual_review_events enable row level security;

revoke all on public.fmds_visual_review_candidates from anon, authenticated;
revoke all on public.fmds_visual_review_events from anon, authenticated;
revoke all on public.fmds_visual_review_queue from anon, authenticated;
revoke all on function public.record_fmds_visual_review(text, uuid, text, text, text, text, text[], uuid[])
  from public, anon, authenticated;

grant select, insert, update on public.fmds_visual_review_candidates to service_role;
grant select, insert on public.fmds_visual_review_events to service_role;
grant select on public.fmds_visual_review_queue to service_role;
grant execute on function public.record_fmds_visual_review(text, uuid, text, text, text, text, text[], uuid[])
  to service_role;

commit;
