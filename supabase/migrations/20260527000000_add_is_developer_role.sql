-- Migration: add_is_developer_role
-- Purpose: Introduce a developer role for site-builders. Developers see everything
--          admins see (developer implies admin), plus dev-only surfaces gated by
--          is_developer().
-- Dependency: 20260517000000_custom_access_token_hook.sql must already be applied.
-- After applying this migration, no Dashboard change is required — the existing
-- custom_access_token_hook registration continues to fire and now emits the
-- is_developer claim as well. See docs/deployment/AUTH-JWT-HOOK-RUNBOOK.md.

-- 1. Add the column
alter table public.user_profiles
  add column if not exists is_developer boolean not null default false;

comment on column public.user_profiles.is_developer is
  'True if the user is a site developer. Developers automatically have admin access (is_admin claim is forced true for them). Used to gate developer-only surfaces.';

-- 2. Update the JWT hook to embed is_developer AND make is_admin a superset.
--    Developer implies admin, so the JWT is_admin claim is OR-ed with is_developer.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_is_admin boolean;
  user_is_developer boolean;
  user_role text;
begin
  select is_admin, is_developer, role
    into user_is_admin, user_is_developer, user_role
  from public.user_profiles
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';
  -- Developer implies admin: any code path gated by is_admin auto-includes developers.
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
    '{app_role}',
    to_jsonb(coalesce(user_role, 'team'))
  );
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- 3. SQL helper that mirrors is_admin() for developer-only checks.
create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_developer')::boolean, false);
$$;

grant execute on function public.is_developer() to authenticated, anon, service_role;

comment on function public.is_developer() is
  'Returns true if the current JWT carries is_developer=true. Use for RLS policies that should be restricted to site developers (e.g. internal diagnostic tables).';
