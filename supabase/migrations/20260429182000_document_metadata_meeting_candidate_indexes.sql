-- Add narrow indexes for meeting candidate selection. These support health
-- checks and source-specific retrieval that ask for the latest meeting rows by
-- source/type/category without scanning wide document metadata content.

set statement_timeout = 0;
set lock_timeout = '5min';

create index if not exists idx_document_metadata_source_created
  on public.document_metadata (source, created_at desc);

create index if not exists idx_document_metadata_type_created
  on public.document_metadata (type, created_at desc);

create index if not exists idx_document_metadata_category_created
  on public.document_metadata (category, created_at desc);

create index if not exists idx_document_metadata_fireflies_created
  on public.document_metadata (created_at desc)
  where fireflies_id is not null;
