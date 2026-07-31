-- Widen the email partial HNSW index to cover email AND email_attachment.
--
-- DB: AI Database (RAG) — fqcvmfqldlewvbsuxdvz. NOT managed by supabase/migrations/.
-- Apply against RAG_DATABASE_URL.
--
-- Why:
--   backend/src/services/agents/alleato_ai_tools/graph_api.py::search_emails
--   filters source_types = ['email','email_attachment'] and calls the
--   search_document_chunks RPC. The RPC's inner kNN query becomes
--       ... WHERE source_type = ANY('{email,email_attachment}')
--           ORDER BY embedding <=> query_embedding LIMIT n
--   (the plpgsql custom plan folds the `filter_source_types is null OR ...`
--   guard away once the constant array substitutes in).
--
--   The previous partial index predicate was a scalar `source_type = 'email'`.
--   Postgres' predicate_implied_by() cannot prove that a query filtering
--   `source_type = ANY('{email,email_attachment}')` is covered by an index
--   predicated on `source_type = 'email'`, so the planner ignored the HNSW
--   index and fell back to the global idx_document_chunks_embedding_ivfflat
--   (lists=200). Under concurrent searches that fallback drove
--   search_document_chunks RPC statement-timeouts / HTTP 500s — the
--   2026-06-24 "Degraded-search" resignation-search false-negative incident.
--
--   Note: as of 2026-06-24 there are 0 rows with source_type='email_attachment'
--   (10,303 'email' rows). Widening the predicate is still required regardless
--   of that count — the fix is about predicate coverage so the planner can use
--   the HNSW index for the two-element filter, not about indexing attachment
--   rows. The new index stays usable for the email-only path too, because
--   `source_type = 'email'` is implied by `source_type = ANY('{email,email_attachment}')`.
--
-- Mirrors the existing teams/meeting partial-index pattern:
--   idx_document_chunks_teams_embedding   WHERE source_type = ANY(ARRAY['teams_dm','teams_channel'])
--   idx_document_chunks_meeting_embedding WHERE source_type = ANY(ARRAY['meeting_transcript', ...])
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY / DROP INDEX CONCURRENTLY cannot run
-- inside a transaction block. Run this file WITHOUT wrapping BEGIN/COMMIT
-- (psql runs each statement in its own implicit transaction by default).

-- 1. Build the widened HNSW partial index concurrently (no table lock).
create index concurrently if not exists idx_document_chunks_email_attachment_embedding
  on public.document_chunks
  using hnsw (embedding extensions.halfvec_cosine_ops)
  with (m = '8', ef_construction = '32')
  where (source_type = any (array['email'::text, 'email_attachment'::text]));

-- 2. Drop the old single-source-type index now that the widened one covers it.
drop index concurrently if exists public.idx_document_chunks_email_embedding;
