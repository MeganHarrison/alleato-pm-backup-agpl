-- Align the email attachment search index with the repo-wide RAG embedding
-- convention: text-embedding-3-large at 3072 dimensions.

drop index if exists public.idx_search_documents_vector;

alter table public.search_documents
  alter column embedding type halfvec(3072)
  using (
    '[' || array_to_string(array_fill(0::real, array[3072]), ',') || ']'
  )::halfvec(3072);

create index if not exists idx_search_documents_vector
  on public.search_documents
  using ivfflat (embedding halfvec_cosine_ops)
  with (lists = 100);
