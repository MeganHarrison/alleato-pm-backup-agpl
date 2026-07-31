-- Partial index that covers the exact teams compiler batch-query pattern:
--   WHERE type = 'teams_dm_conversation'
--     AND status IN ('raw_ingested', 'embedded')
--     AND (overview IS NULL OR overview = '')
--   ORDER BY created_at DESC
--   LIMIT n
--
-- Without this, the query uses idx_document_metadata_type_created (type, created_at)
-- but still must heap-fetch every teams_dm_conversation row to filter on status and
-- overview. As successful compilations accumulate, the ratio of "already compiled"
-- rows grows and the scan gets progressively slower.
--
-- This partial index is tiny (only uncompiled rows), is never scanned by other queries,
-- and is automatically kept small as the compiler marks rows "compiled".

set statement_timeout = 0;
set lock_timeout = '5min';

create index if not exists idx_document_metadata_teams_pending
  on public.document_metadata (created_at desc)
  where type = 'teams_dm_conversation'
    and status in ('raw_ingested', 'embedded')
    and (overview is null or overview = '');

commit;
