-- Grant EXECUTE on is_admin() to authenticated role.
-- The function was previously only granted to anon, causing "permission denied
-- for function is_admin" when RLS policies on user_profiles evaluated it for
-- authenticated users (e.g. the /api/admin/ai-system-health requireAdmin check).

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
