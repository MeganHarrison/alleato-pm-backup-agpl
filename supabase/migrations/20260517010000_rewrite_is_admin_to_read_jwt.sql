-- Migration: rewrite_is_admin_to_read_jwt
-- Purpose: Replace the user_profiles SELECT inside is_admin() with a JWT claim
--          read. Once the custom_access_token_hook is registered (see migration
--          20260517000000 and docs/deployment/AUTH-JWT-HOOK-RUNBOOK.md),
--          auth.jwt() carries the is_admin boolean — no extra DB round-trip needed.
-- Dependency: 20260517000000_custom_access_token_hook.sql + hook registered in Dashboard.
-- Rollback: see docs/deployment/AUTH-JWT-HOOK-RUNBOOK.md#rollback

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_admin')::boolean, false);
$$;
