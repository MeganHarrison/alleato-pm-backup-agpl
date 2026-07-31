-- RAG DB only.
-- Stores full source payloads and processing metadata outside the app database.

create extension if not exists vector with schema extensions;

create table if not exists public.rag_document_metadata (
  id text primary key,
  app_document_id text not null,
  project_id integer,
  source text,
  source_system text,
  source_item_id text,
  fireflies_id text,
  title text,
  type text,
  category text,
  source_web_url text,
  url text,
  storage_bucket text,
  storage_path text,
  file_name text,
  content text,
  raw_text text,
  content_hash text,
  content_length integer,
  summary text,
  overview text,
  summary_embedding extensions.halfvec(3072),
  parsing_status text,
  embedding_status text,
  processing_metadata jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_content_loaded_at timestamptz,
  last_indexed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_rag_document_metadata_project_source_date
  on public.rag_document_metadata (
    project_id,
    source,
    category,
    coalesce(last_synced_at, created_at) desc
  );

create index if not exists idx_rag_document_metadata_embedding_status
  on public.rag_document_metadata (embedding_status, source, category);

create index if not exists idx_rag_document_metadata_storage
  on public.rag_document_metadata (storage_bucket, storage_path)
  where storage_path is not null;

create index if not exists idx_rag_document_metadata_content_hash
  on public.rag_document_metadata (content_hash)
  where content_hash is not null;

create index if not exists idx_rag_document_metadata_summary_embedding
  on public.rag_document_metadata
  using hnsw (summary_embedding extensions.halfvec_cosine_ops)
  where summary_embedding is not null;

create or replace function public.set_rag_document_metadata_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_rag_document_metadata_updated_at on public.rag_document_metadata;
create trigger set_rag_document_metadata_updated_at
before update on public.rag_document_metadata
for each row
execute function public.set_rag_document_metadata_updated_at();

grant select, insert, update, delete on public.rag_document_metadata to service_role;
grant select on public.rag_document_metadata to authenticated;
