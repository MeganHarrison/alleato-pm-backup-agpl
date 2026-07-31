-- Add UPDATE RLS policy to projects table
--
-- BUG: Budget lock/unlock feature was returning 403 Forbidden because
-- the projects table had no UPDATE RLS policy. The Supabase auth client
-- could not update budget_locked, budget_locked_at, budget_locked_by columns.
--
-- The API route already checks requirePermission(projectId, "budget", "admin")
-- before reaching the Supabase UPDATE call, so the RLS policy can be permissive
-- for authenticated users — permission enforcement happens at the API layer.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'projects_update_budget_lock_authenticated'
  ) then
    CREATE POLICY "projects_update_budget_lock_authenticated"
    ON projects FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  end if;
end $$;
