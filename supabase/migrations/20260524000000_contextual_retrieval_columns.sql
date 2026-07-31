-- =============================================================================
-- Contextual Retrieval — additive columns + search RPC
--
-- Target database: AI Database (Supabase project fqcvmfqldlewvbsuxdvz).
--   Applied via `supabase migration up` against that project, or via the
--   Supabase MCP `apply_migration` tool. Not for the App DB.
--
-- Purpose: enable A/B comparison of contextually-prefixed embeddings vs the
-- existing raw-chunk embeddings, without breaking either path during rollout.
--
-- Changes:
--   1. Add chunk_context, embedding_contextual, contextualized_at columns to
--      document_chunks. All nullable — existing rows and existing ingestion
--      remain untouched.
--   2. Create an HNSW index on the new vector column with the same parameters
--      as the legacy index.
--   3. Create search_document_chunks_contextual — identical signature, return
--      shape, and metadata-extraction logic to search_document_chunks, but
--      searches the new vector column. The retrieval consumer (alleato-ai)
--      flips between them by RPC name.
--
-- Promotion / rollback: this migration is non-destructive. Promotion happens
-- on the consumer side by flipping `RAG_EMBEDDING_VARIANT`. Rollback is the
-- same flip plus, eventually, dropping the new columns + RPC.
-- =============================================================================

-- ─── 1. Columns ──────────────────────────────────────────────────────────────
alter table public.document_chunks
  add column if not exists chunk_context        text,
  add column if not exists embedding_contextual halfvec(3072),
  add column if not exists contextualized_at    timestamptz;

comment on column public.document_chunks.chunk_context is
  'Document-level context prepended to the chunk before embedding (template '
  'header plus optional LLM-generated paragraph). Stored for audit/debug.';

comment on column public.document_chunks.embedding_contextual is
  'Vector embedding of (chunk_context || chunk_text). Used by '
  'search_document_chunks_contextual. Nullable while contextual backfill is in '
  'progress; the RPC filters NULL rows out.';

comment on column public.document_chunks.contextualized_at is
  'When chunk_context and embedding_contextual were last written.';

-- ─── 2. Vector index ─────────────────────────────────────────────────────────
create index if not exists document_chunks_embedding_contextual_hnsw
  on public.document_chunks
  using hnsw (embedding_contextual halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ─── 3. Search RPC ───────────────────────────────────────────────────────────
-- Mirrors search_document_chunks exactly: same signature, same return shape,
-- same metadata-extraction logic out of dc.metadata jsonb. Only difference is
-- it reads dc.embedding_contextual instead of dc.embedding.

create or replace function public.search_document_chunks_contextual(
    query_embedding     halfvec,
    filter_source_types text[]            default null,
    filter_project_id   bigint            default null,
    match_count         integer           default 10,
    match_threshold     double precision  default 0.25
)
returns table (
    chunk_id        text,
    document_id     text,
    chunk_index     integer,
    chunk_text      text,
    source_type     text,
    similarity      double precision,
    doc_title       text,
    doc_category    text,
    doc_source      text,
    doc_date        timestamp with time zone,
    doc_project_id  bigint,
    doc_metadata    jsonb,
    doc_created_at  timestamp without time zone
)
language plpgsql
set statement_timeout to '60s'
as $function$
begin
  set local hnsw.ef_search = 100;
  set local ivfflat.probes = 24;

  return query
  select
    dc.chunk_id,
    dc.document_id,
    dc.chunk_index,
    dc.text as chunk_text,
    dc.source_type,
    (1 - (dc.embedding_contextual <=> query_embedding))::float as similarity,
    dc.metadata ->> 'title' as doc_title,
    coalesce(dc.metadata ->> 'category', dc.metadata ->> 'doc_type') as doc_category,
    dc.metadata ->> 'source' as doc_source,
    case
      when coalesce(dc.metadata ->> 'file_date', dc.metadata ->> 'date') ~ '^\d{4}-\d{2}-\d{2}'
        then (coalesce(dc.metadata ->> 'file_date', dc.metadata ->> 'date'))::timestamptz
      else null::timestamptz
    end as doc_date,
    nullif(dc.metadata ->> 'project_id', '')::bigint as doc_project_id,
    dc.metadata as doc_metadata,
    dc.created_at::timestamp as doc_created_at
  from public.document_chunks dc
  where
    dc.embedding_contextual is not null
    and (filter_source_types is null or dc.source_type = any(filter_source_types))
    and (
      filter_project_id is null
      or nullif(dc.metadata ->> 'project_id', '')::bigint = filter_project_id
    )
    and (1 - (dc.embedding_contextual <=> query_embedding)) > match_threshold
  order by dc.embedding_contextual <=> query_embedding
  limit match_count;
end;
$function$;

grant execute on function public.search_document_chunks_contextual(
    halfvec, text[], bigint, integer, double precision
) to anon, authenticated, service_role;

comment on function public.search_document_chunks_contextual is
  'Contextual Retrieval variant of search_document_chunks. Identical signature '
  'and return shape; searches embedding_contextual instead of embedding. '
  'Returns nothing for chunks not yet backfilled.';
