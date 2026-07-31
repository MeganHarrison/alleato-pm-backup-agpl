alter table public.outlook_email_intake
  add column if not exists vectorization_status text not null default 'pending',
  add column if not exists vectorization_checked_at timestamptz null,
  add column if not exists vectorization_chunk_count integer not null default 0,
  add column if not exists vectorization_error text null;

create index if not exists outlook_email_intake_vectorization_status_idx
  on public.outlook_email_intake(vectorization_status, received_at desc);

comment on column public.outlook_email_intake.vectorization_status is
  'Projection of RAG vectorization state for the email document: no_document, pending, embedded, skipped, failed, or review_needed.';

notify pgrst, 'reload schema';
