-- Keep metadata-linked tasks aligned with the source document's authoritative project.
--
-- Root cause:
-- Fireflies and other ingestion paths can create tasks before a human or
-- downstream classifier assigns `document_metadata.project_id`. When the
-- document later gets assigned, tasks were left behind with null/empty
-- project linkage.
--
-- Guardrail:
-- Whenever a document's project_id changes to a non-null value, update all
-- linked tasks to the same scalar `project_id` and canonical single-element
-- `project_ids` array. This keeps source-linked task assignment deterministic
-- and prevents drift between `document_metadata` and `tasks`.

create or replace function public.sync_tasks_from_document_metadata_project()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is null then
    return new;
  end if;

  update public.tasks
  set project_id = new.project_id,
      project_ids = array[new.project_id]::bigint[],
      extraction_metadata = coalesce(extraction_metadata, '{}'::jsonb) || jsonb_build_object(
        'project_assignment_sync',
        jsonb_build_object(
          'status', 'synced_from_document_metadata',
          'source', 'document_metadata.project_id',
          'document_metadata_id', new.id,
          'assigned_at', now()
        )
      ),
      updated_at = now()
  where metadata_id = new.id
    and (
      project_id is distinct from new.project_id
      or project_ids is null
      or project_ids <> array[new.project_id]::bigint[]
    );

  return new;
end;
$$;

drop trigger if exists trg_sync_tasks_from_document_metadata_project on public.document_metadata;

create trigger trg_sync_tasks_from_document_metadata_project
after update of project_id on public.document_metadata
for each row
when (new.project_id is not null and new.project_id is distinct from old.project_id)
execute function public.sync_tasks_from_document_metadata_project();
