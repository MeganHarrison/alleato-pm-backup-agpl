-- Lower ivfflat.probes 10 -> 4 in search_document_chunks (AI DB, fqcvmfqldlewvbsuxdvz).
-- The unfiltered semantic search (filter_source_types = NULL) can't use the per-source
-- partial HNSW indexes, so it falls back to a full ivfflat scan over ~146k halfvec(3072)
-- chunks. With probes=10 that was ~6.7s and got canceled by the 8s statement_timeout under
-- the assistant's concurrent searches -> the AI chat reported 'search failed on the backend'
-- and 'found nothing'. probes=4 drops it to ~2.3s cold / ~0.7s warm with recall intact
-- (the Jacob Richardson resignation thread still returns at sim 1.0/0.70). 2026-06-24.

CREATE OR REPLACE FUNCTION public.search_document_chunks(query_embedding halfvec, filter_source_types text[] DEFAULT NULL::text[], filter_project_id bigint DEFAULT NULL::bigint, match_count integer DEFAULT 10, match_threshold double precision DEFAULT 0.25, ranking_mode text DEFAULT 'vector'::text, query_text text DEFAULT NULL::text, telemetry_enabled boolean DEFAULT false, query_signature text DEFAULT NULL::text, trace_id text DEFAULT NULL::text)
 RETURNS TABLE(chunk_id text, document_id text, chunk_index integer, chunk_text text, source_type text, similarity double precision, vector_score double precision, text_score double precision, recall_score double precision, recency_score double precision, hybrid_score double precision, ranking_mode_used text, score_components jsonb, doc_title text, doc_category text, doc_source text, doc_date timestamp with time zone, doc_project_id bigint, doc_metadata jsonb, doc_created_at timestamp without time zone)
 LANGUAGE plpgsql
AS $function$
declare
  normalized_mode text := lower(coalesce(ranking_mode, 'vector'));
  use_hybrid boolean;
  tsq tsquery;
  telemetry_mode text;
begin
  if match_count <= 0 then
    raise exception 'match_count must be positive';
  end if;

  if normalized_mode not in ('vector', 'hybrid') then
    raise exception 'ranking_mode must be vector or hybrid, got %', ranking_mode;
  end if;

  use_hybrid := normalized_mode = 'hybrid';
  telemetry_mode := case
    when use_hybrid and nullif(trim(coalesce(query_text, '')), '') is null then 'degraded_hybrid'
    when use_hybrid then 'hybrid'
    else 'vector'
  end;

  if nullif(trim(coalesce(query_text, '')), '') is not null then
    tsq := websearch_to_tsquery('english', query_text);
  end if;

  set local hnsw.ef_search = 100;
  set local ivfflat.probes = 4;

  create temporary table pg_temp.search_document_chunks_ranked on commit drop as
  with vector_candidates as (
    select
      dc.chunk_id,
      dc.document_id,
      dc.chunk_index,
      dc.text as chunk_text,
      dc.source_type,
      (1 - (dc.embedding <=> query_embedding))::float as vector_score,
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
      dc.embedding is not null
      and (filter_source_types is null or dc.source_type = any(filter_source_types))
      and (
        filter_project_id is null
        or nullif(dc.metadata ->> 'project_id', '')::bigint = filter_project_id
      )
      and (1 - (dc.embedding <=> query_embedding)) > match_threshold
    order by dc.embedding <=> query_embedding
    limit greatest(match_count * 4, match_count)
  ),
  scored as (
    select
      vc.*,
      case
        when tsq is null then null::double precision
        else (
          ts_rank_cd(
            to_tsvector(
              'english',
              coalesce(vc.doc_title, '') || ' ' || coalesce(vc.chunk_text, '')
            ),
            tsq
          )::double precision
        )
      end as raw_text_rank,
      coalesce(stats.recall_count, 0) as recall_count,
      stats.last_recalled_at,
      coalesce(vc.doc_date, vc.doc_created_at::timestamptz) as source_time
    from vector_candidates vc
    left join public.document_chunk_retrieval_stats stats
      on stats.chunk_id = vc.chunk_id
  ),
  normalized as (
    select
      scored.*,
      case
        when raw_text_rank is null then null::double precision
        else raw_text_rank / (1 + raw_text_rank)
      end as text_score,
      least(1, ln(1 + greatest(recall_count, 0)) / ln(11))::double precision as recall_score,
      greatest(
        0.1,
        exp(
          -greatest(
            0,
            extract(epoch from (now() - coalesce(source_time, now()))) / 86400
          ) / 180
        )
      )::double precision as recency_score
    from scored
  )
  select
    normalized.chunk_id,
    normalized.document_id,
    normalized.chunk_index,
    normalized.chunk_text,
    normalized.source_type,
    normalized.vector_score as similarity,
    normalized.vector_score,
    normalized.text_score,
    normalized.recall_score,
    normalized.recency_score,
    case
      when use_hybrid and normalized.text_score is not null then
        (
          normalized.vector_score * 0.65
          + normalized.text_score * 0.20
          + normalized.recall_score * 0.10
          + normalized.recency_score * 0.05
        )::double precision
      else normalized.vector_score
    end as hybrid_score,
    case
      when use_hybrid and normalized.text_score is null then 'degraded_hybrid'
      when use_hybrid then 'hybrid'
      else 'vector'
    end as ranking_mode_used,
    jsonb_build_object(
      'vectorScore', normalized.vector_score,
      'textScore', normalized.text_score,
      'recallScore', normalized.recall_score,
      'recencyScore', normalized.recency_score,
      'recallCount', normalized.recall_count,
      'lastRecalledAt', normalized.last_recalled_at,
      'weights', jsonb_build_object(
        'vector', case when use_hybrid then 0.65 else 1 end,
        'text', case when use_hybrid then 0.20 else 0 end,
        'recall', case when use_hybrid then 0.10 else 0 end,
        'recency', case when use_hybrid then 0.05 else 0 end
      )
    ) as score_components,
    normalized.doc_title,
    normalized.doc_category,
    normalized.doc_source,
    normalized.doc_date,
    normalized.doc_project_id,
    normalized.doc_metadata,
    normalized.doc_created_at
  from normalized
  order by
    case when use_hybrid and normalized.text_score is not null then
      (
        normalized.vector_score * 0.65
        + normalized.text_score * 0.20
        + normalized.recall_score * 0.10
        + normalized.recency_score * 0.05
      )
    else normalized.vector_score end desc
  limit match_count;

  if telemetry_enabled then
    insert into public.document_chunk_retrieval_telemetry (
      chunk_id,
      retrieval_date,
      retrieval_mode,
      source_type,
      project_id,
      recall_count,
      first_recalled_at,
      last_recalled_at,
      last_query_signature,
      last_trace_id,
      metadata
    )
    select
      r.chunk_id,
      (now() at time zone 'UTC')::date,
      telemetry_mode,
      r.source_type,
      r.doc_project_id,
      1,
      now(),
      now(),
      nullif(query_signature, ''),
      nullif(trace_id, ''),
      jsonb_build_object(
        'filterSourceTypes', filter_source_types,
        'filterProjectId', filter_project_id,
        'matchThreshold', match_threshold
      )
    from pg_temp.search_document_chunks_ranked r
    on conflict on constraint document_chunk_retrieval_telemetry_bucket_key
    do update set
      recall_count = public.document_chunk_retrieval_telemetry.recall_count + 1,
      last_recalled_at = excluded.last_recalled_at,
      last_query_signature = excluded.last_query_signature,
      last_trace_id = excluded.last_trace_id,
      updated_at = now(),
      metadata = public.document_chunk_retrieval_telemetry.metadata || excluded.metadata;
  end if;

  return query
  select * from pg_temp.search_document_chunks_ranked;
end;
$function$

