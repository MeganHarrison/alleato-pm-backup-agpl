-- Bound document chunk retrieval so an invalid/missing vector index does not
-- force every RAG request into a table-wide halfvec distance scan.
--
-- This keeps the existing RPC signature and result shape. The vector index
-- still needs a planned rebuild, but this fallback makes briefing-style
-- retrieval filter by source/project/recency before ranking candidate chunks.

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
    candidate_count int := greatest(match_count * 250, 5000);
begin
    set local hnsw.ef_search = 100;

    return query
    with eligible as materialized (
        select
            dc.chunk_id,
            dc.document_id,
            dc.chunk_index,
            dc.text,
            dc.source_type,
            dc.metadata,
            dc.embedding,
            dm.title,
            dm.category,
            dm.source,
            dm.date,
            dm.project_id,
            dm.created_at
        from public.document_chunks dc
        join public.document_metadata dm
          on dm.id = dc.document_id
        where dc.embedding is not null
          and (filter_source_types is null or dc.source_type = any(filter_source_types))
          and (filter_project_id is null or dm.project_id = filter_project_id)
          and (
            filter_project_id is not null
            or filter_source_types is not null
            or coalesce(dm.date, dm.created_at::timestamptz, 'epoch'::timestamptz) >= now() - interval '540 days'
          )
        order by coalesce(dm.date, dm.created_at::timestamptz, 'epoch'::timestamptz) desc
        limit candidate_count
    ),
    ranked as materialized (
        select
            e.*,
            e.embedding <=> query_embedding as distance
        from eligible e
    )
    select
        r.chunk_id,
        r.document_id,
        r.chunk_index,
        r.text as chunk_text,
        r.source_type,
        (1 - r.distance)::float as similarity,
        r.title as doc_title,
        r.category as doc_category,
        r.source as doc_source,
        r.date as doc_date,
        r.project_id as doc_project_id,
        r.metadata as doc_metadata,
        r.created_at as doc_created_at
    from ranked r
    where (1 - r.distance) > match_threshold
    order by r.distance
    limit match_count;
end;
$$;
grant execute on function public.search_document_chunks(halfvec(3072), text[], bigint, int, float)
    to anon, authenticated, service_role;
