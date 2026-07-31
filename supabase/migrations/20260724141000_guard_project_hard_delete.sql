-- Guard against ACCIDENTAL project hard-deletes — keyed to disposable data.
--
-- Context: on 2026-07-23 a raw `DELETE FROM projects` (direct DB/dashboard access,
-- bypassing the app — the app only soft-archives) removed ~28 active projects.
--
-- Design decision (2026-07-24): the guard deliberately does NOT block on documents /
-- meetings / intelligence. Blocking on those would only pressure an operator to delete
-- them first to get the delete through — the opposite of what we want. Instead:
--   * The document corpus SURVIVES a delete (document_metadata.project_id is ON DELETE
--     SET NULL) and now keeps its former project name + id
--     (see 20260724160000_document_metadata_preserve_project_reference.sql), so it can be
--     re-linked afterwards.
--   * This guard trips only on `direct_costs`, which is disposable (re-syncs from
--     Acumatica). It is a deliberate-action speed bump: you cannot silently nuke a
--     financially-active project, but clearing the tripwire costs nothing valuable.
--
-- Escape hatch (intended hard-delete): set the override in the SAME transaction:
--   set local app.allow_project_hard_delete = 'on';
--   delete from public.projects where id = ...;
-- Projects with no direct costs are never blocked, so empty/test-project cleanup is
-- unaffected.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create or replace function public.fn_guard_project_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_override     text;
  v_direct_costs bigint;
begin
  -- Deliberate override for intended hard-deletes, scoped to the current transaction.
  v_override := current_setting('app.allow_project_hard_delete', true);
  if v_override is not null and lower(v_override) in ('on', 'true', '1', 'yes') then
    return OLD;
  end if;

  select count(*) into v_direct_costs
    from public.direct_costs where project_id = OLD.id;

  if v_direct_costs > 0 then
    raise exception 'PROJECT_HAS_DIRECT_COSTS'
      using
        detail = format(
          'Project %s (%s) still has %s direct cost record(s) attached.',
          OLD.id, coalesce(OLD.name, '(unnamed)'), v_direct_costs
        ),
        hint =
          'This is a deliberate-action guard, not data protection: delete the direct '
          'costs first (they re-sync from Acumatica) or run '
          '"SET LOCAL app.allow_project_hard_delete = ''on'';" in the same transaction, '
          'then retry. Note: the document/meeting/email corpus is NOT deleted by this — '
          'it survives unlinked, retaining its former project name via '
          'document_metadata.previous_project_id / project.';
  end if;

  return OLD;
end;
$$;

comment on function public.fn_guard_project_hard_delete() is
  'BEFORE DELETE speed-bump on projects: blocks a hard delete while disposable direct_costs '
  'are attached, unless app.allow_project_hard_delete is set in the transaction. Deliberately '
  'does NOT block on the document corpus (which survives unlinked). Added after 2026-07-23.';

drop trigger if exists trg_guard_project_hard_delete on public.projects;

create trigger trg_guard_project_hard_delete
  before delete on public.projects
  for each row execute function public.fn_guard_project_hard_delete();

commit;
