-- Qualify the staging matcher similarity column against PL/pgSQL output variables.

begin;

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
  select m.* from matches m
  where m.similarity >= match_threshold
  order by m.similarity desc
  limit greatest(match_count, 0);
end;
$$;

commit;
