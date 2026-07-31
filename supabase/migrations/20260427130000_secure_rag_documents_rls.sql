-- Secure RAG document sources (document_metadata/document_chunks/document_rows)
--
-- Goals:
-- - Enforce project-scoped access for authenticated users.
-- - Enforce admin-only access for Teams + Email sources.
-- - Preserve service_role ingestion and background jobs.
-- - Use users_auth -> person_id mapping when available (matches app guardrails).
--
-- NOTE: Many AI tools use the service role client (bypasses RLS). This migration
-- hardens direct client/RPC access, but tool-layer guardrails are still required.

-- These DDL operations touch hot RAG tables; allow time to acquire locks.
set statement_timeout = 0;
set lock_timeout = '5min';

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper functions (shared across RLS policies)
-- ---------------------------------------------------------------------------

-- Resolve the current auth user to a project directory person id.
-- Prefer users_auth (app standard), fall back to legacy people.auth_user_id.
CREATE OR REPLACE FUNCTION public.current_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT ua.person_id FROM public.users_auth ua WHERE ua.auth_user_id = auth.uid() LIMIT 1),
    (SELECT p.id FROM public.people p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.current_person_id() IS
  'Returns the project directory person id for auth.uid(). Uses users_auth when available, falls back to people.';

-- Is the current auth user flagged as an app admin?
CREATE OR REPLACE FUNCTION public.current_is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()), false);
$$;

COMMENT ON FUNCTION public.current_is_app_admin() IS
  'Returns user_profiles.is_admin for auth.uid(). Used inside RLS policies.';

-- Is the current user an active member of the given project?
CREATE OR REPLACE FUNCTION public.current_is_project_member(p_project_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_directory_memberships m
    WHERE m.project_id = p_project_id
      AND m.person_id = public.current_person_id()
      AND m.status = 'active'
  );
$$;

COMMENT ON FUNCTION public.current_is_project_member(bigint) IS
  'Returns true when auth.uid() is an active project directory member for p_project_id.';

-- These SECURITY DEFINER helpers must not be callable by anon (PUBLIC), but
-- authenticated users need them for RLS policy evaluation.
REVOKE ALL ON FUNCTION public.current_person_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_person_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_is_app_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_is_project_member(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_is_project_member(bigint) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- document_metadata (primary RAG document registry)
-- ---------------------------------------------------------------------------

ALTER TABLE public.document_metadata ENABLE ROW LEVEL SECURITY;

-- Drop likely legacy policy names (safe no-ops if they do not exist).
DROP POLICY IF EXISTS users_can_read_docs ON public.document_metadata;
DROP POLICY IF EXISTS "Users can read docs" ON public.document_metadata;
DROP POLICY IF EXISTS "Users can manage docs" ON public.document_metadata;
DROP POLICY IF EXISTS document_metadata_select ON public.document_metadata;
DROP POLICY IF EXISTS document_metadata_insert ON public.document_metadata;
DROP POLICY IF EXISTS document_metadata_update ON public.document_metadata;
DROP POLICY IF EXISTS document_metadata_delete ON public.document_metadata;

-- Read: project-scoped; Teams + Email admin-only.
CREATE POLICY document_metadata_select
  ON public.document_metadata
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR (
      COALESCE(category, '') NOT IN ('email', 'teams_message')
      AND (
        (project_id IS NOT NULL AND public.current_is_project_member(project_id))
        OR access_level = 'team'
        OR EXISTS (
          SELECT 1
          FROM public.document_user_access dua
          WHERE dua.document_id = document_metadata.id
            AND dua.user_id = auth.uid()
        )
      )
    )
  );

-- Write: allow project members to create/update/delete docs for their projects.
-- (Uploads + manual meetings use the authenticated Supabase client today.)
CREATE POLICY document_metadata_insert
  ON public.document_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_app_admin()
    OR project_id IS NULL
    OR public.current_is_project_member(project_id)
  );

CREATE POLICY document_metadata_update
  ON public.document_metadata
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR project_id IS NULL
    OR public.current_is_project_member(project_id)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR project_id IS NULL
    OR public.current_is_project_member(project_id)
  );

CREATE POLICY document_metadata_delete
  ON public.document_metadata
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR project_id IS NULL
    OR public.current_is_project_member(project_id)
  );

-- ---------------------------------------------------------------------------
-- document_chunks (vectorized unstructured chunks: meetings/docs/emails/Teams)
-- ---------------------------------------------------------------------------

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Replace permissive policies (common in legacy seeds).
DROP POLICY IF EXISTS "Enable read access for all users" ON public.document_chunks;
DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.document_chunks;
DROP POLICY IF EXISTS document_chunks_select ON public.document_chunks;
DROP POLICY IF EXISTS document_chunks_write ON public.document_chunks;

CREATE POLICY document_chunks_select
  ON public.document_chunks
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.document_metadata dm
      WHERE dm.id = document_chunks.document_id
        AND COALESCE(dm.category, '') NOT IN ('email', 'teams_message')
        AND (
          (dm.project_id IS NOT NULL AND public.current_is_project_member(dm.project_id))
          OR dm.access_level = 'team'
          OR EXISTS (
            SELECT 1
            FROM public.document_user_access dua
            WHERE dua.document_id = dm.id
              AND dua.user_id = auth.uid()
          )
        )
    )
  );

-- Restrict writes to service_role only (pipeline owns chunking/embeddings).
CREATE POLICY document_chunks_service_write
  ON public.document_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- document_rows (structured rows extracted from spreadsheets/financial docs)
-- ---------------------------------------------------------------------------

ALTER TABLE public.document_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_rows_select ON public.document_rows;
DROP POLICY IF EXISTS document_rows_service_write ON public.document_rows;

CREATE POLICY document_rows_select
  ON public.document_rows
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.document_metadata dm
      WHERE dm.id = document_rows.dataset_id
        AND COALESCE(dm.category, '') NOT IN ('email', 'teams_message')
        AND (
          (dm.project_id IS NOT NULL AND public.current_is_project_member(dm.project_id))
          OR dm.access_level = 'team'
          OR EXISTS (
            SELECT 1
            FROM public.document_user_access dua
            WHERE dua.document_id = dm.id
              AND dua.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY document_rows_service_write
  ON public.document_rows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
