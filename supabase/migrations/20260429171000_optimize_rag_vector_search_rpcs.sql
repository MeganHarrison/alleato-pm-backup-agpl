-- Optimize hot RAG vector RPCs by forcing vector-nearest candidate selection
-- before joins and threshold filtering.
--
-- The previous functions could time out because Postgres had to reason about
-- threshold predicates and metadata joins inside the vector search. These
-- versions first pull a bounded nearest-neighbor candidate set using the HNSW
-- index, then apply threshold/project/source filters over that small set.

set statement_timeout = 0;
set lock_timeout = '5min';
create or replace function public.search_document_chunks(
    query_embedding  halfvec(3072),
    filter_source_types text[] default null,
    filter_project_id bigint default null,
    match_count      int     default 10,
    match_threshold  float   default 0.25
)
returns table (
    chunk_id        text,
    document_id     text,
    chunk_index     int,
    chunk_text      text,
    source_type     text,
    similarity      float,
    doc_title       text,
    doc_category    text,
    doc_source      text,
    doc_date        timestamptz,
    doc_project_id  bigint,
    doc_metadata    jsonb,
    doc_created_at  timestamp
)
language plpgsql volatile
as $$
declare
    candidate_count int := greatest(match_count * case when filter_project_id is null then 30 else 100 end, 200);
begin
    set local hnsw.ef_search = 100;

    return query
    with nearest as materialized (
        select
            dc.chunk_id,
            dc.document_id,
            dc.chunk_index,
            dc.text,
            dc.source_type,
            dc.metadata,
            dc.embedding <=> query_embedding as distance
        from public.document_chunks dc
        where dc.embedding is not null
          and (filter_source_types is null or dc.source_type = any(filter_source_types))
        order by dc.embedding <=> query_embedding
        limit candidate_count
    )
    select
        n.chunk_id,
        n.document_id,
        n.chunk_index,
        n.text as chunk_text,
        n.source_type,
        (1 - n.distance)::float as similarity,
        dm.title as doc_title,
        dm.category as doc_category,
        dm.source as doc_source,
        dm.date as doc_date,
        dm.project_id as doc_project_id,
        n.metadata as doc_metadata,
        dm.created_at as doc_created_at
    from nearest n
    join public.document_metadata dm
      on dm.id = n.document_id
    where (filter_project_id is null or dm.project_id = filter_project_id)
      and (1 - n.distance) > match_threshold
    order by n.distance
    limit match_count;
end;
$$;
grant execute on function public.search_document_chunks(halfvec(3072), text[], bigint, int, float)
    to anon, authenticated, service_role;
create or replace function public.search_all_knowledge(
    query_embedding  halfvec(3072),
    match_count      int     default 10,
    match_threshold  float   default 0.3
)
returns table (
    id              uuid,
    source_table    text,
    metadata_id     text,
    description     text,
    type            text,
    owner_name      text,
    project_id      bigint,
    project_ids     int[],
    status          text,
    details         jsonb,
    similarity      float,
    created_at      timestamptz
)
language plpgsql volatile
as $$
declare
    candidate_count int := greatest(match_count * 30, 200);
begin
    set local hnsw.ef_search = 100;

    return query
    with nearest as materialized (
        select
            i.id,
            i.metadata_id,
            i.description,
            i.type,
            i.owner_name,
            i.project_id,
            i.project_ids,
            i.status,
            i.details,
            i.created_at,
            i.embedding <=> query_embedding as distance
        from public.insights i
        where i.embedding is not null
        order by i.embedding <=> query_embedding
        limit candidate_count
    )
    select
        n.id,
        'insights'::text as source_table,
        n.metadata_id,
        n.description,
        n.type,
        n.owner_name,
        n.project_id,
        n.project_ids,
        n.status,
        n.details,
        (1 - n.distance)::float as similarity,
        n.created_at
    from nearest n
    where (1 - n.distance) > match_threshold
    order by n.distance
    limit match_count;
end;
$$;
grant execute on function public.search_all_knowledge(halfvec(3072), int, float)
    to anon, authenticated, service_role;
