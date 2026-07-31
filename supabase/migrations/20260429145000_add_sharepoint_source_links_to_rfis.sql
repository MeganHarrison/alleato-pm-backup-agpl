-- Track SharePoint/OneDrive source documents that are promoted into RFI workflow records.
-- This lets imported RFIs stay linked to their original question/response PDFs.

alter table public.rfis
  add column if not exists source_system text,
  add column if not exists source_project_document_id bigint references public.project_documents(id) on delete set null,
  add column if not exists response_project_document_id bigint references public.project_documents(id) on delete set null,
  add column if not exists source_document_metadata_id text references public.document_metadata(id) on delete set null,
  add column if not exists response_document_metadata_id text references public.document_metadata(id) on delete set null,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;
create index if not exists rfis_source_project_document_idx
  on public.rfis (source_project_document_id)
  where source_project_document_id is not null;
create index if not exists rfis_response_project_document_idx
  on public.rfis (response_project_document_id)
  where response_project_document_id is not null;
create index if not exists rfis_source_system_project_idx
  on public.rfis (source_system, project_id)
  where source_system is not null;
create unique index if not exists rfis_project_number_unique_idx
  on public.rfis (project_id, number);
