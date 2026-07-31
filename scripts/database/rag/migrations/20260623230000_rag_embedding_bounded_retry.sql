-- Bounded-retry guard for the graph embedding pipeline (poison-pill fix).
--
-- Context: embed.py `_batch_embed` previously threw OUTSIDE the status-advancing
-- code, so a provider auth/credit failure left `embedding_status` NULL forever.
-- The candidate query re-pulled the same docs every run → infinite re-fail +
-- re-bill, invisible. These columns let embed_graph_document record the real
-- error and bound retries so a permanently-failing doc parks loudly instead of
-- looping silently.
--
-- Target DB: AI Database (RAG) — project fqcvmfqldlewvbsuxdvz. NOT the PM APP DB.

ALTER TABLE public.rag_document_metadata
  ADD COLUMN IF NOT EXISTS embedding_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_error text,
  ADD COLUMN IF NOT EXISTS embedding_last_attempt_at timestamptz;

COMMENT ON COLUMN public.rag_document_metadata.embedding_attempts IS
  'Consecutive failed embed attempts; reset to 0 on success. Bounded-retry guard against the poison-pill loop (see embed.py).';
COMMENT ON COLUMN public.rag_document_metadata.embedding_error IS
  'Last embedding failure message (truncated). Cleared on successful embed.';
