-- Phase 7.2: 30-day soak for the legacy `documents` table.
-- All application code has been migrated to document_metadata.
-- This trigger logs every read/write so we can confirm zero activity
-- before hard-dropping the table on 2026-06-17 or later.

create table if not exists public.documents_access_audit (
  id          uuid default gen_random_uuid() primary key,
  event_type  text not null,   -- INSERT | UPDATE | DELETE
  record_id   text,
  accessed_at timestamptz default now()
);

-- Only admins can read the audit log; no app code should touch it
alter table public.documents_access_audit enable row level security;
create policy "Admin read documents_access_audit"
  on public.documents_access_audit
  for select
  using (public.is_admin());

create or replace function public.log_documents_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.documents_access_audit (event_type, record_id)
  values (TG_OP, coalesce(NEW.id::text, OLD.id::text));
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists documents_access_audit_trigger on public.documents;
create trigger documents_access_audit_trigger
  after insert or update or delete on public.documents
  for each row execute function public.log_documents_access();

comment on table public.documents_access_audit is
  'Soak log for legacy documents table. Drop this table and the documents table together on 2026-06-17 if no rows appear after today.';
