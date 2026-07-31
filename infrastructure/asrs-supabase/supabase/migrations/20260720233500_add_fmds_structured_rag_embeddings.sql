-- Source-linked embeddings for human-reviewed FMDS tables and figures.
-- This migration belongs only to the dedicated ASRS Supabase project.

begin;

create table public.fmds_structured_chunks (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  source_type text not null check (source_type in ('table', 'figure')),
  source_id uuid not null,
  page_number integer not null check (page_number > 0),
  source_identifier text not null check (length(btrim(source_identifier)) > 0),
  title text,
  review_event_id uuid not null references public.fmds_visual_review_events(id) on delete restrict,
  candidate_id uuid not null references public.fmds_visual_review_candidates(id) on delete restrict,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(btrim(content)) > 0),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  citation_label text not null check (length(btrim(citation_label)) > 0),
  embedding public.halfvec(3072),
  embedding_model text,
  embedding_dimensions integer check (embedding_dimensions = 3072),
  embedding_status text not null default 'pending'
    check (embedding_status in ('pending', 'embedded', 'failed')),
  embedding_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, source_type, source_id, review_event_id, chunk_index)
);

create index fmds_structured_chunks_revision_source_idx
  on public.fmds_structured_chunks (revision_id, source_type, source_id, chunk_index);

create index fmds_structured_chunks_embedding_hnsw_idx
  on public.fmds_structured_chunks using hnsw (embedding public.halfvec_cosine_ops)
  where embedding_status = 'embedded';

create trigger fmds_structured_chunks_updated_at
before update on public.fmds_structured_chunks
for each row execute function public.set_fmds_updated_at();

create or replace function public.validate_fmds_structured_chunk()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  revision_status text;
  source_revision_id uuid;
  source_review_status text;
  source_page_number integer;
  source_identifier_value text;
  event_candidate_ids uuid[];
begin
  select status into revision_status
  from public.fmds_corpus_revisions
  where id = new.revision_id;

  if revision_status is null then
    raise exception 'Unknown FMDS revision %', new.revision_id;
  end if;
  if revision_status <> 'staging' then
    raise exception 'Structured FMDS chunk writes require a staging revision; current status is %', revision_status;
  end if;

  if new.source_type = 'table' then
    select revision_id, review_status, page_start, table_identifier
    into source_revision_id, source_review_status, source_page_number, source_identifier_value
    from public.fmds_tables
    where id = new.source_id;
  else
    select revision_id, review_status, page_number, figure_identifier
    into source_revision_id, source_review_status, source_page_number, source_identifier_value
    from public.fmds_figures
    where id = new.source_id;
  end if;

  if source_revision_id is null then
    raise exception 'Unknown FMDS % source %', new.source_type, new.source_id;
  end if;
  if source_revision_id <> new.revision_id then
    raise exception 'FMDS % source % belongs to revision %, not %',
      new.source_type, new.source_id, source_revision_id, new.revision_id;
  end if;
  if source_review_status <> 'reviewed' then
    raise exception 'FMDS % % is %, not reviewed; structured embedding is forbidden',
      new.source_type, new.source_id, source_review_status;
  end if;
  if new.page_number <> source_page_number then
    raise exception 'FMDS % % source page is %, not %',
      new.source_type, new.source_id, source_page_number, new.page_number;
  end if;
  if new.source_identifier <> source_identifier_value then
    raise exception 'FMDS % % identifier is %, not %',
      new.source_type, new.source_id, source_identifier_value, new.source_identifier;
  end if;

  select candidate_ids into event_candidate_ids
  from public.fmds_visual_review_events
  where id = new.review_event_id
    and revision_id = new.revision_id
    and source_type = new.source_type
    and source_id = new.source_id
    and decision = 'approved';

  if event_candidate_ids is null then
    raise exception 'FMDS structured chunk requires an approved review event for this exact source';
  end if;
  if not (new.candidate_id = any(event_candidate_ids)) then
    raise exception 'FMDS candidate % was not approved by review event %',
      new.candidate_id, new.review_event_id;
  end if;
  if not exists (
    select 1
    from public.fmds_visual_review_candidates c
    where c.id = new.candidate_id
      and c.revision_id = new.revision_id
      and c.source_type = new.source_type
      and c.source_id = new.source_id
  ) then
    raise exception 'FMDS candidate % does not belong to this revision and source', new.candidate_id;
  end if;
  if encode(extensions.digest(new.content, 'sha256'), 'hex') <> new.content_sha256 then
    raise exception 'FMDS structured chunk content hash does not match its content';
  end if;

  return new;
end;
$$;

create trigger validate_fmds_structured_chunk_write
before insert on public.fmds_structured_chunks
for each row execute function public.validate_fmds_structured_chunk();

create or replace function public.prevent_fmds_structured_chunk_provenance_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.revision_id <> old.revision_id
     or new.source_type <> old.source_type
     or new.source_id <> old.source_id
     or new.page_number <> old.page_number
     or new.source_identifier <> old.source_identifier
     or new.review_event_id <> old.review_event_id
     or new.candidate_id <> old.candidate_id
     or new.chunk_index <> old.chunk_index
     or new.content <> old.content
     or new.content_sha256 <> old.content_sha256
     or new.citation_label <> old.citation_label then
    raise exception 'FMDS structured chunk provenance and content are immutable; create a new approved review event';
  end if;
  return new;
end;
$$;

create trigger prevent_fmds_structured_chunk_provenance_mutation
before update on public.fmds_structured_chunks
for each row execute function public.prevent_fmds_structured_chunk_provenance_mutation();

create or replace function public.insert_fmds_structured_chunks(
  requested_revision_id uuid,
  chunk_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  revision_status text;
  item jsonb;
  existing_hash text;
  inserted integer := 0;
begin
  select status into revision_status
  from public.fmds_corpus_revisions
  where id = requested_revision_id;

  if revision_status is null then
    raise exception 'Unknown FMDS revision %', requested_revision_id;
  end if;
  if revision_status <> 'staging' then
    raise exception 'Structured FMDS chunk writes require a staging revision; current status is %', revision_status;
  end if;
  if jsonb_typeof(chunk_rows) <> 'array' then
    raise exception 'chunk_rows must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(chunk_rows)
  loop
    select content_sha256 into existing_hash
    from public.fmds_structured_chunks
    where revision_id = requested_revision_id
      and source_type = item ->> 'source_type'
      and source_id = (item ->> 'source_id')::uuid
      and review_event_id = (item ->> 'review_event_id')::uuid
      and chunk_index = (item ->> 'chunk_index')::integer;

    if existing_hash is not null then
      if existing_hash <> item ->> 'content_sha256' then
        raise exception 'Existing structured chunk content differs for source % event % chunk %',
          item ->> 'source_id', item ->> 'review_event_id', item ->> 'chunk_index';
      end if;
      continue;
    end if;

    insert into public.fmds_structured_chunks (
      revision_id,
      source_type,
      source_id,
      page_number,
      source_identifier,
      title,
      review_event_id,
      candidate_id,
      chunk_index,
      content,
      content_sha256,
      citation_label
    ) values (
      requested_revision_id,
      item ->> 'source_type',
      (item ->> 'source_id')::uuid,
      (item ->> 'page_number')::integer,
      item ->> 'source_identifier',
      nullif(item ->> 'title', ''),
      (item ->> 'review_event_id')::uuid,
      (item ->> 'candidate_id')::uuid,
      (item ->> 'chunk_index')::integer,
      item ->> 'content',
      item ->> 'content_sha256',
      item ->> 'citation_label'
    );
    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;

create or replace function public.store_fmds_structured_chunk_embeddings(
  requested_revision_id uuid,
  embedding_rows jsonb,
  requested_model text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  revision_status text;
  item jsonb;
  changed integer := 0;
  row_changed integer;
begin
  select status into revision_status
  from public.fmds_corpus_revisions
  where id = requested_revision_id;

  if revision_status is null then
    raise exception 'Unknown FMDS revision %', requested_revision_id;
  end if;
  if revision_status <> 'staging' then
    raise exception 'Structured FMDS embedding writes require a staging revision; current status is %', revision_status;
  end if;
  if jsonb_typeof(embedding_rows) <> 'array' then
    raise exception 'embedding_rows must be a JSON array';
  end if;
  if requested_model <> 'text-embedding-3-large' then
    raise exception 'Unsupported FMDS structured embedding model: %', requested_model;
  end if;

  for item in select value from jsonb_array_elements(embedding_rows)
  loop
    update public.fmds_structured_chunks
    set embedding = (item ->> 'embedding')::public.halfvec(3072),
        embedding_model = requested_model,
        embedding_dimensions = 3072,
        embedding_status = 'embedded',
        embedding_error = null
    where id = (item ->> 'id')::uuid
      and revision_id = requested_revision_id;

    get diagnostics row_changed = row_count;
    if row_changed <> 1 then
      raise exception 'Structured embedding target % is missing or belongs to another revision', item ->> 'id';
    end if;
    changed := changed + row_changed;
  end loop;

  return changed;
end;
$$;

revoke all on table public.fmds_structured_chunks from public, anon, authenticated;
grant select, insert, update on table public.fmds_structured_chunks to service_role;
revoke all on function public.insert_fmds_structured_chunks(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.insert_fmds_structured_chunks(uuid, jsonb) to service_role;
revoke all on function public.store_fmds_structured_chunk_embeddings(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.store_fmds_structured_chunk_embeddings(uuid, jsonb, text) to service_role;

create or replace view public.fmds_structured_embedding_coverage as
with reviewed_sources as (
  select revision_id, 'table'::text as source_type, id as source_id
  from public.fmds_tables
  where review_status = 'reviewed'
  union all
  select revision_id, 'figure'::text as source_type, id as source_id
  from public.fmds_figures
  where review_status = 'reviewed'
),
latest_approved as (
  select distinct on (revision_id, source_type, source_id)
    revision_id,
    source_type,
    source_id,
    id as review_event_id
  from public.fmds_visual_review_events
  where decision = 'approved'
  order by revision_id, source_type, source_id, created_at desc, id desc
),
source_coverage as (
  select
    rs.revision_id,
    rs.source_type,
    rs.source_id,
    la.review_event_id,
    exists (
      select 1
      from public.fmds_structured_chunks sc
      where sc.revision_id = rs.revision_id
        and sc.source_type = rs.source_type
        and sc.source_id = rs.source_id
        and sc.review_event_id = la.review_event_id
        and sc.embedding_status = 'embedded'
        and sc.embedding is not null
        and sc.embedding_dimensions = 3072
    ) as is_embedded
  from reviewed_sources rs
  left join latest_approved la
    on la.revision_id = rs.revision_id
   and la.source_type = rs.source_type
   and la.source_id = rs.source_id
)
select
  r.id as revision_id,
  count(*) filter (where sc.source_type = 'table')::integer as reviewed_table_count,
  count(*) filter (where sc.source_type = 'table' and sc.is_embedded)::integer as embedded_reviewed_table_count,
  count(*) filter (where sc.source_type = 'table' and not sc.is_embedded)::integer as missing_reviewed_table_count,
  count(*) filter (where sc.source_type = 'figure')::integer as reviewed_figure_count,
  count(*) filter (where sc.source_type = 'figure' and sc.is_embedded)::integer as embedded_reviewed_figure_count,
  count(*) filter (where sc.source_type = 'figure' and not sc.is_embedded)::integer as missing_reviewed_figure_count
from public.fmds_corpus_revisions r
left join source_coverage sc on sc.revision_id = r.id
group by r.id;

revoke all on table public.fmds_structured_embedding_coverage from public, anon, authenticated;
grant select on table public.fmds_structured_embedding_coverage to service_role;

drop function if exists public.match_active_fmds_chunks(public.halfvec, integer, double precision);
drop function if exists public.match_staging_fmds_chunks(uuid, public.halfvec, integer, double precision);

create or replace function public.match_active_fmds_chunks(
  query_embedding public.halfvec(3072),
  match_count integer default 12,
  match_threshold double precision default 0.25
)
returns table (
  chunk_id uuid,
  revision_id uuid,
  document_code text,
  revision_label text,
  page_number integer,
  citation_label text,
  section_path text,
  clause_reference text,
  content text,
  similarity double precision,
  source_type text,
  source_id uuid,
  source_identifier text,
  review_event_id uuid,
  candidate_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with matches as (
    select
      c.id as chunk_id,
      c.revision_id,
      r.document_code,
      r.revision_label,
      c.page_number,
      c.citation_label,
      c.section_path,
      c.clause_reference,
      c.content,
      (1 - (c.embedding <=> query_embedding))::double precision as similarity,
      'native_text'::text as source_type,
      null::uuid as source_id,
      null::text as source_identifier,
      null::uuid as review_event_id,
      null::uuid as candidate_id
    from public.fmds_chunks c
    join public.fmds_corpus_revisions r on r.id = c.revision_id
    where r.status = 'active'
      and c.embedding_status = 'embedded'
    union all
    select
      sc.id,
      sc.revision_id,
      r.document_code,
      r.revision_label,
      sc.page_number,
      sc.citation_label,
      null::text,
      sc.source_identifier,
      sc.content,
      (1 - (sc.embedding <=> query_embedding))::double precision,
      sc.source_type,
      sc.source_id,
      sc.source_identifier,
      sc.review_event_id,
      sc.candidate_id
    from public.fmds_structured_chunks sc
    join public.fmds_corpus_revisions r on r.id = sc.revision_id
    join public.fmds_visual_review_events e on e.id = sc.review_event_id
    where r.status = 'active'
      and sc.embedding_status = 'embedded'
      and e.decision = 'approved'
      and not exists (
        select 1 from public.fmds_visual_review_events newer
        where newer.revision_id = e.revision_id
          and newer.source_type = e.source_type
          and newer.source_id = e.source_id
          and newer.decision = 'approved'
          and (newer.created_at, newer.id) > (e.created_at, e.id)
      )
  )
  select * from matches
  where similarity >= match_threshold
  order by similarity desc
  limit greatest(match_count, 0);
$$;

create or replace function public.match_staging_fmds_chunks(
  requested_revision_id uuid,
  query_embedding public.halfvec(3072),
  match_count integer default 12,
  match_threshold double precision default 0.25
)
returns table (
  chunk_id uuid,
  revision_id uuid,
  document_code text,
  revision_label text,
  page_number integer,
  citation_label text,
  section_path text,
  clause_reference text,
  content text,
  similarity double precision,
  source_type text,
  source_id uuid,
  source_identifier text,
  review_event_id uuid,
  candidate_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.fmds_corpus_revisions
    where id = requested_revision_id and status = 'staging'
  ) then
    raise exception 'Requested FMDS staging revision % is unavailable', requested_revision_id;
  end if;

  return query
  with matches as (
    select
      c.id as chunk_id,
      c.revision_id,
      r.document_code,
      r.revision_label,
      c.page_number,
      c.citation_label,
      c.section_path,
      c.clause_reference,
      c.content,
      (1 - (c.embedding <=> query_embedding))::double precision as similarity,
      'native_text'::text as source_type,
      null::uuid as source_id,
      null::text as source_identifier,
      null::uuid as review_event_id,
      null::uuid as candidate_id
    from public.fmds_chunks c
    join public.fmds_corpus_revisions r on r.id = c.revision_id
    where c.revision_id = requested_revision_id
      and r.status = 'staging'
      and c.embedding_status = 'embedded'
    union all
    select
      sc.id,
      sc.revision_id,
      r.document_code,
      r.revision_label,
      sc.page_number,
      sc.citation_label,
      null::text,
      sc.source_identifier,
      sc.content,
      (1 - (sc.embedding <=> query_embedding))::double precision,
      sc.source_type,
      sc.source_id,
      sc.source_identifier,
      sc.review_event_id,
      sc.candidate_id
    from public.fmds_structured_chunks sc
    join public.fmds_corpus_revisions r on r.id = sc.revision_id
    join public.fmds_visual_review_events e on e.id = sc.review_event_id
    where sc.revision_id = requested_revision_id
      and r.status = 'staging'
      and sc.embedding_status = 'embedded'
      and e.decision = 'approved'
      and not exists (
        select 1 from public.fmds_visual_review_events newer
        where newer.revision_id = e.revision_id
          and newer.source_type = e.source_type
          and newer.source_id = e.source_id
          and newer.decision = 'approved'
          and (newer.created_at, newer.id) > (e.created_at, e.id)
      )
  )
  select * from matches
  where similarity >= match_threshold
  order by similarity desc
  limit greatest(match_count, 0);
end;
$$;

revoke all on function public.match_active_fmds_chunks(public.halfvec, integer, double precision) from public;
revoke all on function public.match_staging_fmds_chunks(uuid, public.halfvec, integer, double precision) from public;
grant execute on function public.match_active_fmds_chunks(public.halfvec, integer, double precision) to anon, authenticated, service_role;
grant execute on function public.match_staging_fmds_chunks(uuid, public.halfvec, integer, double precision) to anon, authenticated, service_role;

commit;
