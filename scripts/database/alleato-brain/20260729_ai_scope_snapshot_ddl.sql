BEGIN;

CREATE TABLE IF NOT EXISTS public.alleato_brain_scope_snapshot_20260729_documents (
  id text PRIMARY KEY,
  project_id integer,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alleato_brain_scope_snapshot_20260729_chunks (
  chunk_id text PRIMARY KEY,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.alleato_brain_scope_snapshot_20260729_documents
  FROM anon, authenticated;
REVOKE ALL ON public.alleato_brain_scope_snapshot_20260729_chunks
  FROM anon, authenticated;

COMMIT;
