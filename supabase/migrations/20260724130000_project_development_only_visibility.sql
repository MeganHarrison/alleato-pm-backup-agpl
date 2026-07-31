-- Development-only projects: keep them in the DB but hide them from everyone
-- except users with the developer role.
--
-- Context: rather than deleting dev/scratch/restored projects (which SET-NULLs
-- their document links), flag them is_development=true. They are then excluded
-- from the portfolio list and RLS for all non-developer users.
--
-- Visibility is enforced in TWO layers because /api/projects uses the service
-- client (which bypasses RLS):
--   1. RLS projects_select policy (this file) — covers authenticated-client reads
--   2. /api/projects route application logic — covers the portfolio list
-- The is_developer() helper reads the JWT is_developer claim, which the
-- custom_access_token_hook populates from public.user_profiles.is_developer.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

alter table public.projects
  add column if not exists is_development boolean not null default false;

comment on column public.projects.is_development is
  'When true, the project is development-only: hidden from the portfolio list and '
  'from RLS for every non-developer user. Set the developer flag on user_profiles.is_developer.';

create index if not exists idx_projects_is_development
  on public.projects (is_development)
  where is_development = true;

-- Rebuild the SELECT policy so development projects are visible ONLY to developers.
-- Non-development projects keep the existing admin-or-member rule.
drop policy if exists projects_select on public.projects;

create policy projects_select
  on public.projects
  as permissive
  for select
  to public
  using (
    case
      when coalesce(is_development, false) then public.is_developer()
      else (public.current_is_app_admin() or public.current_is_project_member(id))
    end
  );

commit;
