-- Make a document's project reference survive a project deletion.
--
-- document_metadata.project_id FK is ON DELETE SET NULL: deleting a project unlinks its
-- documents (meetings/emails/Teams/files) rather than deleting them — which we WANT. But
-- the unlinked rows lost all trace of which project they belonged to, because the
-- denormalized name column (document_metadata.project) was not reliably populated and
-- nothing captured the former id.
--
-- This migration:
--   1. Adds previous_project_id (plain integer, NO FK — so it is never itself SET NULL'd).
--   2. Adds a BEFORE INSERT/UPDATE trigger that keeps `project` (name) + previous_project_id
--      populated whenever project_id is set, and preserves both when the FK later nulls
--      project_id on a project delete.
--   3. Backfills both columns for every currently-linked document.
--
-- Result: after any future project deletion, an unlinked document still carries its former
-- project's name AND id, so it can be shown ("was: <name>") and re-linked exactly.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

alter table public.document_metadata
  add column if not exists previous_project_id integer;

comment on column public.document_metadata.previous_project_id is
  'Last project this document was linked to. Plain integer (no FK) so a project delete '
  'that SET-NULLs project_id leaves this intact for display + re-linking. Maintained by '
  'trg_document_metadata_project_reference alongside the denormalized `project` name.';

create index if not exists idx_document_metadata_previous_project_id
  on public.document_metadata (previous_project_id)
  where project_id is null and previous_project_id is not null;

create or replace function public.fn_sync_document_project_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  if NEW.project_id is not null then
    -- Linked (or being linked): mirror the id and refresh the denormalized name.
    NEW.previous_project_id := NEW.project_id;
    if TG_OP = 'INSERT'
       or NEW.project_id is distinct from OLD.project_id
       or NEW.project is null then
      select name into v_name from public.projects where id = NEW.project_id;
      if v_name is not null then
        NEW.project := v_name;
      end if;
    end if;
  elsif TG_OP = 'UPDATE' and OLD.project_id is not null then
    -- Being unlinked (e.g. the FK just SET NULL'd project_id on a project delete):
    -- preserve the last-known reference so it is not lost.
    NEW.previous_project_id := OLD.project_id;
    if NEW.project is null then
      NEW.project := OLD.project;
    end if;
  end if;
  return NEW;
end;
$$;

comment on function public.fn_sync_document_project_reference() is
  'Keeps document_metadata.project (name) + previous_project_id populated so an unlinked '
  'document retains a reference to its former project. Added after the 2026-07-23 incident.';

drop trigger if exists trg_document_metadata_project_reference on public.document_metadata;

create trigger trg_document_metadata_project_reference
  before insert or update on public.document_metadata
  for each row execute function public.fn_sync_document_project_reference();

-- Backfill every currently-linked document so the reference is in place BEFORE any future
-- delete. (Already-orphaned rows — project_id already null — have no source to backfill
-- from and are handled separately by the attribution re-link.)
update public.document_metadata dm
set project = p.name,
    previous_project_id = dm.project_id
from public.projects p
where dm.project_id = p.id
  and (dm.project is distinct from p.name
       or dm.previous_project_id is distinct from dm.project_id);

commit;
