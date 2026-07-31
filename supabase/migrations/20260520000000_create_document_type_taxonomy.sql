-- Migration: create_document_type_taxonomy
-- Phase 4 Day 1 — Document type taxonomy table
-- Provides a controlled vocabulary for document_metadata.document_type.
-- Applied via Supabase MCP on 2026-05-20.

create table public.document_type_taxonomy (
  type_key text primary key,
  display_name text not null,
  category text not null check (category in (
    'contract','closeout','permit','drawing','photo',
    'compliance','communication','financial','other'
  )),
  applies_to text[] not null,
  required_metadata jsonb,
  source_system text,
  retention_days integer,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create index on public.document_type_taxonomy using gin (applies_to);
create index on public.document_type_taxonomy (category) where is_active = true;

alter table public.document_type_taxonomy enable row level security;

create policy "Anyone authenticated can read taxonomy"
  on public.document_type_taxonomy for select
  to authenticated using (true);

create policy "Only admins can modify taxonomy"
  on public.document_type_taxonomy for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
