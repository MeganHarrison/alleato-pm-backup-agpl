-- Fix search_document_chunks_by_category runtime failures caused by exact
-- Postgres return-type mismatches between document_metadata/document_chunks
-- physical column types and the function's declared table shape.

drop function if exists public.search_document_chunks_by_category(halfvec(3072), text, int, float, bigint);
drop function if exists public.search_document_chunks_by_category(halfvec(3072), text, integer, double precision, bigint);
drop function if exists public.search_document_chunks_by_category(halfvec(3072), text, integer, double precision);
drop function if exists public.search_document_chunks_by_category(halfvec(3072), text, integer, float);

create or replace function public.search_document_chunks_by_category(
    query_embedding  halfvec(3072),
    filter_category  text,
    match_count      int     default 10,
    match_threshold  float   default 0.25,
    filter_project_id bigint default null
)
returns table (
    chunk_id         text,
    document_id      text,
    chunk_index      int,
    chunk_text       text,
    similarity       float,
    doc_title        text,
    doc_category     text,
    doc_source       text,
    doc_type         text,
    doc_date         timestamptz,
    doc_participants text,
    doc_tags         text,
    doc_project_id   bigint,
    doc_metadata     jsonb,
    doc_created_at   timestamptz
)
language plpgsql
as $$
begin
    set local hnsw.ef_search = 100;

    return query
    select
        dc.chunk_id::text,
        dc.document_id::text,
        dc.chunk_index::int,
        dc.text::text as chunk_text,
        (1 - (dc.embedding <=> query_embedding))::float as similarity,
        dm.title::text as doc_title,
        dm.category::text as doc_category,
        dm.source::text as doc_source,
        dm.type::text as doc_type,
        dm.date::timestamptz as doc_date,
        dm.participants::text as doc_participants,
        dm.tags::text as doc_tags,
        dm.project_id::bigint as doc_project_id,
        dc.metadata::jsonb as doc_metadata,
        dm.created_at::timestamptz as doc_created_at
    from public.document_chunks dc
    join public.document_metadata dm
        on dc.document_id = dm.id
    where
        dc.embedding is not null
        and dm.category = filter_category
        and (filter_project_id is null or dm.project_id = filter_project_id)
        and (1 - (dc.embedding <=> query_embedding)) > match_threshold
    order by dc.embedding <=> query_embedding
    limit match_count;
end;
$$;

grant execute on function public.search_document_chunks_by_category(halfvec(3072), text, int, float, bigint)
  to anon, authenticated, service_role;
