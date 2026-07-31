-- Migration: custom_access_token_hook
-- Purpose: Embed is_admin and app_role into every JWT at token issuance time,
--          eliminating the per-request user_profiles SELECT that guards admin checks.
-- After applying this migration, register the hook in Supabase Dashboard:
--   Authentication → Hooks → Custom Access Token Hook
--   Function: public.custom_access_token_hook
-- See: docs/deployment/AUTH-JWT-HOOK-RUNBOOK.md

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_is_admin boolean;
  user_role text;
begin
  select is_admin, role into user_is_admin, user_role
  from public.user_profiles
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(coalesce(user_is_admin, false)));
  claims := jsonb_set(claims, '{app_role}', to_jsonb(coalesce(user_role, 'team')));
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Only supabase_auth_admin may invoke this hook
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Auth admin needs read access to user_profiles to populate claims
grant select on table public.user_profiles to supabase_auth_admin;

-- RLS policy: let supabase_auth_admin read all profiles (needed for hook execution)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'user_profiles'
      and policyname = 'Allow auth admin to read user profiles'
  ) then
    execute $policy$
      create policy "Allow auth admin to read user profiles"
        on public.user_profiles for select
        to supabase_auth_admin
        using (true)
    $policy$;
  end if;
end;
$$;
