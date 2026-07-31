-- Add an explicit promotion ledger for Outlook intake attachments.
-- Capturing an attachment is not the same as making it a project document; this
-- state makes every promoted, skipped, review-needed, or failed attachment visible.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

alter table public.outlook_email_intake_attachments
  add column if not exists promotion_status text not null default 'pending',
  add column if not exists promotion_reason text,
  add column if not exists promotion_attempt_count integer not null default 0,
  add column if not exists promoted_at timestamptz,
  add column if not exists project_id integer references public.projects(id) on delete set null,
  add column if not exists document_metadata_id text references public.document_metadata(id) on delete set null,
  add column if not exists project_document_id bigint references public.project_documents(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'outlook_email_intake_attachments_promotion_status_check'
      and conrelid = 'public.outlook_email_intake_attachments'::regclass
  ) then
    alter table public.outlook_email_intake_attachments
      add constraint outlook_email_intake_attachments_promotion_status_check
      check (promotion_status in ('pending', 'promoted', 'skipped', 'review_needed', 'failed'));
  end if;
end $$;

create index if not exists idx_outlook_intake_attachments_promotion_queue
  on public.outlook_email_intake_attachments (promotion_status, created_at)
  where promotion_status in ('pending', 'failed');

create index if not exists idx_outlook_intake_attachments_project
  on public.outlook_email_intake_attachments (project_id)
  where project_id is not null;

create index if not exists idx_outlook_intake_attachments_document_metadata
  on public.outlook_email_intake_attachments (document_metadata_id)
  where document_metadata_id is not null;

create index if not exists idx_outlook_intake_attachments_project_document
  on public.outlook_email_intake_attachments (project_document_id)
  where project_document_id is not null;

comment on column public.outlook_email_intake_attachments.promotion_status is
  'Document-promotion state for Outlook attachments: pending, promoted, skipped, review_needed, or failed.';
comment on column public.outlook_email_intake_attachments.promotion_reason is
  'Short machine-readable reason for the latest promotion decision or failure.';
comment on column public.outlook_email_intake_attachments.document_metadata_id is
  'App/RAG catalog row created for important promoted Outlook attachments.';
comment on column public.outlook_email_intake_attachments.project_document_id is
  'Project Documents row created for important promoted Outlook attachments.';

commit;
