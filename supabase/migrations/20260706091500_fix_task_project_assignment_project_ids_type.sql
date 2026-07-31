-- Fix the project assignment sync trigger for document-backed tasks.
--
-- Root cause:
-- The earlier trigger compared `tasks.project_ids` (integer[]) against
-- `array[new.project_id]::bigint[]`, which throws
-- `operator does not exist: integer[] <> bigint[]` whenever a meeting/project
-- assignment is saved from the inline dropdown.
--
-- Guardrail:
-- Keep both sides in the same integer[] domain so the task sync remains
-- deterministic and the save path fails only on real data issues.

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
      project_ids = array[new.project_id]::integer[],
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
      or project_ids <> array[new.project_id]::integer[]
    );

  return new;
end;
$$;
