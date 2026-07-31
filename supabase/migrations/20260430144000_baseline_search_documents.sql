-- Baseline live search-document tables before the embedding-dimension repair.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.projects_sync (
  id uuid PRIMARY KEY,
  external_project_id bigint NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.search_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_sync_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['email'::text, 'attachment'::text])),
  source_id bigint NOT NULL,
  content text NOT NULL,
  embedding halfvec(3072) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
