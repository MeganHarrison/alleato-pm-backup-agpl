-- Keep paused AI/RAG workers from reintroducing table scans when they resume.
-- The hot selectors filter and order by source freshness, then anti-join
-- document_chunks to repair completed Graph rows missing embedded chunks.

set statement_timeout = '5min';
set lock_timeout = '5s';

create index if not exists idx_document_metadata_graph_pending_source_at
  on public.document_metadata (captured_at desc, date desc, created_at desc)
  where source = 'microsoft_graph'
    and status in ('raw_ingested', 'segmented', 'compiled', 'error')
    and length(coalesce(content, '')) > 0;

create index if not exists idx_document_metadata_graph_completed_source_at
  on public.document_metadata (captured_at desc, date desc, created_at desc)
  where source = 'microsoft_graph'
    and status in ('embedded', 'complete')
    and category in ('email', 'teams_message', 'document');

create index if not exists idx_document_chunks_embedded_document_id
  on public.document_chunks (document_id)
  where embedding is not null;

create index if not exists idx_fireflies_ingestion_backlog_candidates
  on public.fireflies_ingestion_jobs (updated_at desc, metadata_id)
  where stage in ('raw_ingested', 'error')
    and metadata_id <> '';
