-- Purpose: Secure Plane Pages records stored in public.notes.
-- Affects: public.notes grants, RLS policies, and immutable identity columns.
--
-- Preconditions:
-- - public.current_has_project_module_permission(bigint, text, text) exists.
--   That shared STABLE SECURITY DEFINER helper resolves app-admin overrides,
--   direct user overrides, project templates, and company templates.
--
-- Rollback / recovery:
-- 1. Keep RLS enabled while investigating. Do not restore anon privileges.
-- 2. If application writes must be temporarily disabled, revoke INSERT, UPDATE,
--    and DELETE from authenticated while leaving SELECT and RLS in place.
-- 3. To remove this policy set, drop the four notes_project_* policies and the
--    notes_immutable_identity trigger/function in a new forward migration.
-- 4. Only restore a previous access model after a security review and explicit
--    approval; never disable RLS as rollback.
--
-- Production ledger verification after an approved apply:
-- npm run db:migrations:verify-applied -- supabase/migrations/20260731231000_secure_notes_rls.sql

begin;

alter table public.notes enable row level security;

-- The shared permission helper uses fully schema-qualified object references,
-- so it does not require caller-controlled schemas in its resolution path.
-- Keep its existing STABLE / SECURITY DEFINER behavior while hardening the
-- execution environment for every RLS policy that relies on it.
alter function public.current_has_project_module_permission(bigint, text, text)
  set search_path = '';
revoke all on function public.current_has_project_module_permission(bigint, text, text)
  from public, anon;
grant execute on function public.current_has_project_module_permission(bigint, text, text)
  to authenticated, service_role;

-- The public Data API must not expose pages to unauthenticated callers.
revoke all privileges on table public.notes from anon;

-- Replace legacy blanket grants with the minimum privileges required by the
-- authenticated Pages API. Identity columns are intentionally not updateable.
revoke all privileges on table public.notes from authenticated;
grant select, delete on table public.notes to authenticated;
grant insert (project_id, title, body, archived, created_by) on public.notes to authenticated;
grant update (title, body, archived, updated_at) on table public.notes to authenticated;

drop policy if exists notes_project_select on public.notes;
drop policy if exists notes_project_insert on public.notes;
drop policy if exists notes_project_update on public.notes;
drop policy if exists notes_project_delete on public.notes;

create policy notes_project_select
on public.notes
for select
to authenticated
using (
  public.current_has_project_module_permission(project_id, 'documents', 'read')
);

create policy notes_project_insert
on public.notes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.current_has_project_module_permission(project_id, 'documents', 'write')
);

create policy notes_project_update
on public.notes
for update
to authenticated
using (
  public.current_has_project_module_permission(project_id, 'documents', 'write')
)
with check (
  public.current_has_project_module_permission(project_id, 'documents', 'write')
);

create policy notes_project_delete
on public.notes
for delete
to authenticated
using (
  public.current_has_project_module_permission(project_id, 'documents', 'write')
);

-- RLS compares row visibility but cannot compare OLD and NEW values. This
-- trigger makes the project and creator identities immutable even for trusted
-- server code that could otherwise bypass column grants or RLS.
create or replace function public.enforce_notes_immutable_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception using
      errcode = '23514',
      message = 'notes.project_id is immutable';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '23514',
      message = 'notes.created_by is immutable';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_notes_immutable_identity() from public;
revoke all on function public.enforce_notes_immutable_identity() from anon;
revoke all on function public.enforce_notes_immutable_identity() from authenticated;
grant execute on function public.enforce_notes_immutable_identity() to service_role;

drop trigger if exists notes_immutable_identity_guard on public.notes;
create trigger notes_immutable_identity_guard
before update of project_id, created_by on public.notes
for each row
execute function public.enforce_notes_immutable_identity();

create index if not exists idx_notes_project_id
on public.notes (project_id);

create index if not exists idx_notes_created_by
on public.notes (created_by);

commit;
