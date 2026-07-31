-- Leadership-restricted meetings (annual reviews)
--
-- Goal: meetings whose category is "Annual Review" must be visible ONLY to
-- leadership (user_profiles.is_leadership = true). Regular admins and project
-- members must NOT see them in lists, detail pages, transcripts, or AI chat.
--
-- Mechanism:
--   1. user_profiles.is_leadership flag + current_is_leadership() helper.
--   2. A trigger stamps document_metadata.access_level = 'leadership' whenever
--      category = 'Annual Review' (insert or update), plus a backfill.
--   3. RLS: leadership-stamped rows are readable only by leadership. This gate
--      wraps the existing project/admin branches (it is an AND-gate on top,
--      except leadership rows become visible to leadership regardless of
--      project membership — an annual review should not require the leader to
--      be on the project directory).
--   4. meeting_segments gets RLS for the first time: a segment is visible iff
--      its parent document_metadata row is visible (parent RLS cascades into
--      the EXISTS subquery because the policy runs as the querying user).
--
-- NOTE: AI tools use service-role clients and bypass RLS. The tool-layer
-- counterpart of this migration lives in frontend/src/lib/ai/ (ToolScope.
-- isLeadership + leadership-restriction helpers) and the embedding pipeline
-- (chunk metadata access_level stamp). Both are required for full coverage.

set statement_timeout = 0;
set lock_timeout = '5min';

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Leadership flag
-- ---------------------------------------------------------------------------

alter table public.user_profiles
  add column if not exists is_leadership boolean not null default false;

comment on column public.user_profiles.is_leadership is
  'True for company leadership (Megan, Brandon, Jesse). Gates leadership-restricted content such as Annual Review meetings. Independent of is_admin: an admin who is not leadership cannot read leadership-restricted rows.';

-- Seed the current leadership team. All known accounts per person are flagged.
insert into public.user_profiles (id, email, is_leadership)
select u.id, u.email, true
from auth.users u
where lower(u.email) in (
  'mkharrison16@gmail.com',      -- Megan Harrison
  'mharrison@alleatogroup.com',  -- Megan Harrison (work)
  'megan@megankharrison.com',    -- Megan Harrison (alt)
  'bclymer@alleatogroup.com',    -- Brandon Clymer
  'jdawson@alleatogroup.com'     -- Jesse Dawson
)
on conflict (id) do update set is_leadership = true;

-- ---------------------------------------------------------------------------
-- 2. Helpers: SQL + JWT claim
-- ---------------------------------------------------------------------------

create or replace function public.current_is_leadership()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select is_leadership from public.user_profiles where id = auth.uid()), false);
$$;

comment on function public.current_is_leadership() is
  'Returns user_profiles.is_leadership for auth.uid(). Used inside RLS policies for leadership-restricted content (e.g. Annual Review meetings). NOT implied by is_admin.';

revoke all on function public.current_is_leadership() from public;
grant execute on function public.current_is_leadership() to authenticated, service_role;

-- Extend the JWT hook so clients can read the claim without a DB round-trip.
-- Keeps all existing claims (is_admin superset of is_developer, app_role).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_is_admin boolean;
  user_is_developer boolean;
  user_is_leadership boolean;
  user_role text;
begin
  select is_admin, is_developer, is_leadership, role
    into user_is_admin, user_is_developer, user_is_leadership, user_role
  from public.user_profiles
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(
    claims,
    '{is_admin}',
    to_jsonb(coalesce(user_is_admin, false) or coalesce(user_is_developer, false))
  );
  claims := jsonb_set(
    claims,
    '{is_developer}',
    to_jsonb(coalesce(user_is_developer, false))
  );
  claims := jsonb_set(
    claims,
    '{is_leadership}',
    to_jsonb(coalesce(user_is_leadership, false))
  );
  claims := jsonb_set(
    claims,
    '{app_role}',
    to_jsonb(coalesce(user_role, 'team'))
  );
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Stamp Annual Review docs as leadership-restricted (trigger + backfill)
-- ---------------------------------------------------------------------------

create or replace function public.stamp_leadership_access_level()
returns trigger
language plpgsql
as $$
begin
  if lower(btrim(coalesce(new.category, ''))) = 'annual review' then
    new.access_level := 'leadership';
  elsif tg_op = 'UPDATE'
    and new.access_level = 'leadership'
    and lower(btrim(coalesce(old.category, ''))) = 'annual review' then
    -- Category moved off Annual Review: lift the auto-stamp (back to the
    -- default). A manually-set leadership stamp on a non-Annual-Review doc is
    -- untouched because old.category would not have been Annual Review.
    new.access_level := 'team';
  end if;
  return new;
end;
$$;

comment on function public.stamp_leadership_access_level() is
  'BEFORE trigger on document_metadata: any row categorized "Annual Review" is forced to access_level = leadership so RLS and the AI tool layer restrict it. Also prevents un-stamping by re-applying on updates.';

drop trigger if exists trg_stamp_leadership_access on public.document_metadata;
create trigger trg_stamp_leadership_access
  before insert or update of category, access_level
  on public.document_metadata
  for each row
  execute function public.stamp_leadership_access_level();

update public.document_metadata
set access_level = 'leadership'
where lower(btrim(coalesce(category, ''))) = 'annual review'
  and access_level is distinct from 'leadership';

-- ---------------------------------------------------------------------------
-- 4. RLS: leadership gate on document_metadata (+ chunk/row mirrors)
-- ---------------------------------------------------------------------------

drop policy if exists document_metadata_select on public.document_metadata;
create policy document_metadata_select
  on public.document_metadata
  for select
  to authenticated
  using (
    case
      when access_level = 'leadership' then public.current_is_leadership()
      else (
        public.current_is_app_admin()
        or (
          coalesce(category, '') not in ('email', 'teams_message')
          and (
            (project_id is not null and public.current_is_project_member(project_id))
            or access_level = 'team'
            or exists (
              select 1
              from public.document_user_access dua
              where dua.document_id = document_metadata.id
                and dua.user_id = auth.uid()
            )
          )
        )
      )
    end
  );

-- Write policies: non-leadership users must not be able to modify or delete a
-- leadership-restricted row (e.g. re-categorize it to lift the restriction).
drop policy if exists document_metadata_update on public.document_metadata;
create policy document_metadata_update
  on public.document_metadata
  for update
  to authenticated
  using (
    (access_level is distinct from 'leadership' or public.current_is_leadership())
    and (
      public.current_is_app_admin()
      or project_id is null
      or public.current_is_project_member(project_id)
    )
  )
  with check (
    (access_level is distinct from 'leadership' or public.current_is_leadership())
    and (
      public.current_is_app_admin()
      or project_id is null
      or public.current_is_project_member(project_id)
    )
  );

drop policy if exists document_metadata_delete on public.document_metadata;
create policy document_metadata_delete
  on public.document_metadata
  for delete
  to authenticated
  using (
    (access_level is distinct from 'leadership' or public.current_is_leadership())
    and (
      public.current_is_app_admin()
      or project_id is null
      or public.current_is_project_member(project_id)
    )
  );

-- NOTE: the legacy PM-APP document_chunks table no longer exists (verified
-- live 2026-07-23) — the active chunks live in the AI/RAG database, which is
-- reached only via service role; its protection is the chunk-metadata stamp
-- enforced in the tool layer. Only document_rows still needs the mirror here.

drop policy if exists document_rows_select on public.document_rows;
create policy document_rows_select
  on public.document_rows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_metadata dm
      where dm.id = document_rows.dataset_id
        and case
          when dm.access_level = 'leadership' then public.current_is_leadership()
          else (
            public.current_is_app_admin()
            or (
              coalesce(dm.category, '') not in ('email', 'teams_message')
              and (
                (dm.project_id is not null and public.current_is_project_member(dm.project_id))
                or dm.access_level = 'team'
                or exists (
                  select 1
                  from public.document_user_access dua
                  where dua.document_id = dm.id
                    and dua.user_id = auth.uid()
                )
              )
            )
          )
        end
    )
  );

-- ---------------------------------------------------------------------------
-- 5. meeting_segments: enable RLS (previously world-readable to authenticated)
-- ---------------------------------------------------------------------------

alter table public.meeting_segments enable row level security;

drop policy if exists meeting_segments_select on public.meeting_segments;
create policy meeting_segments_select
  on public.meeting_segments
  for select
  to authenticated
  using (
    -- Parent visibility cascades: this subquery runs as the querying user, so
    -- document_metadata RLS (including the leadership gate) applies to it.
    exists (
      select 1
      from public.document_metadata dm
      where dm.id = meeting_segments.metadata_id
    )
  );

drop policy if exists meeting_segments_service_write on public.meeting_segments;
create policy meeting_segments_service_write
  on public.meeting_segments
  for all
  to service_role
  using (true)
  with check (true);

COMMIT;
