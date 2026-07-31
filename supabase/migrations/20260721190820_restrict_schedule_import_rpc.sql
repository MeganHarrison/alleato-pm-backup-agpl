-- Supabase grants EXECUTE to anon by default in this project. Revoke that
-- explicit grant as well as PUBLIC so unauthenticated callers cannot replace a
-- project schedule.
REVOKE EXECUTE ON FUNCTION public.replace_schedule_import_atomic(integer, jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_schedule_import_atomic(integer, jsonb, jsonb, boolean) TO authenticated, service_role;
