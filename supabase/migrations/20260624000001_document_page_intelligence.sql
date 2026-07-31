-- Vision-extracted intelligence per PDF page.
-- Populated by the backend pipeline vision_analyzer step (GPT-4o).
-- Powers submittal AI review and drawing search in the frontend.

create table if not exists document_page_intelligence (
  id                    uuid primary key default gen_random_uuid(),
  document_metadata_id  text not null references document_metadata(id) on delete cascade,
  page_number           integer not null,

  -- Extracted fields
  sheet_number          text,
  sheet_title           text,
  discipline            text,
  scale                 text,
  detail_references     text[],
  implied_submittals    text[],
  notes_and_requirements text[],

  -- AI summary — the clean prose that gets vectorized and queried
  ai_summary            text,

  -- Full raw GPT extraction for debugging / re-processing
  raw_extraction        jsonb,
  vision_model          text,

  processed_at          timestamptz default now(),

  unique(document_metadata_id, page_number)
);

create index if not exists document_page_intelligence_doc_idx
  on document_page_intelligence(document_metadata_id);

-- RLS: same pattern as document_metadata — service role only writes,
-- authenticated users can read pages for docs they can access.
alter table document_page_intelligence enable row level security;

create policy "service role full access"
  on document_page_intelligence
  as permissive
  for all
  to service_role
  using (true)
  with check (true);

create policy "authenticated read"
  on document_page_intelligence
  as permissive
  for select
  to authenticated
  using (true);
