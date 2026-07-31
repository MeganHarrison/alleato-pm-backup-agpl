-- Migration: add_document_type_to_document_metadata
-- Phase 4 Day 1 — Add document_type FK column to document_metadata (PM APP project)
-- Also applied separately to rag_document_metadata (RAG project fqcvmfqldlewvbsuxdvz)
-- without FK since taxonomy lives only in PM APP.
-- Applied via Supabase MCP on 2026-05-20.

alter table public.document_metadata
  add column document_type text
  references public.document_type_taxonomy(type_key);

create index on public.document_metadata (document_type);
create index on public.document_metadata (document_type, project_id) where document_type is not null;
