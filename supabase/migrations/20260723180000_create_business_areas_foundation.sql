-- Alleato Brain — Business Areas foundation (Phase 1, Linear ALL-7)
--
-- Adds a hidden, non-project classification ("business areas" = Brain branches)
-- so internal company knowledge no longer needs fake rows in public.projects.
--
-- Additive only: no existing table, column, policy, or grant is removed or
-- tightened. During the migration parallel run a document_metadata row may
-- carry BOTH project_id and business_area_id; routing code (Phase 3) enforces
-- the project-XOR-area rule for NEW assignments, and cutover (Phase 6) clears
-- project_id on area-owned rows.

-- 1) business_areas ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.business_areas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_restricted boolean NOT NULL DEFAULT false,
  owner_person_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_areas IS
  'Alleato Brain branches: hidden, non-project classification for internal company knowledge (Leads, AI, Finance, Internal Operations, Marketing). Never rendered as projects.';

-- 2) business_area_memberships ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.business_area_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_area_id bigint NOT NULL REFERENCES public.business_areas(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_area_id, person_id)
);

COMMENT ON TABLE public.business_area_memberships IS
  'Who may see a business area (and their role). Restricted areas (Finance) are readable only by members and app admins.';

-- 3) fake-project -> branch mapping (auditable, permanent record) -------------

CREATE TABLE IF NOT EXISTS public.business_area_project_map (
  project_id bigint PRIMARY KEY REFERENCES public.projects(id),
  business_area_id bigint NOT NULL REFERENCES public.business_areas(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_area_project_map IS
  'Permanent record mapping retired container projects (756, 767, 60, 90, 89) to their Alleato Brain branch.';

-- 4) document_metadata.business_area_id ---------------------------------------

ALTER TABLE public.document_metadata
  ADD COLUMN IF NOT EXISTS business_area_id bigint REFERENCES public.business_areas(id);

CREATE INDEX IF NOT EXISTS idx_document_metadata_business_area_id
  ON public.document_metadata (business_area_id)
  WHERE business_area_id IS NOT NULL;

COMMENT ON COLUMN public.document_metadata.business_area_id IS
  'Alleato Brain branch for internal knowledge. New items get project_id XOR business_area_id; migrated rows may temporarily carry both until cutover.';

-- 5) membership helper (mirrors current_is_project_member) --------------------

CREATE OR REPLACE FUNCTION public.current_is_business_area_member(p_business_area_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_area_memberships m
    WHERE m.business_area_id = p_business_area_id
      AND m.person_id = public.current_person_id()
      AND m.status = 'active'
  );
$$;

COMMENT ON FUNCTION public.current_is_business_area_member(bigint) IS
  'Returns true when auth.uid() is an active member of the given business area. Used inside RLS policies.';

REVOKE ALL ON FUNCTION public.current_is_business_area_member(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_is_business_area_member(bigint) TO authenticated, service_role;

-- 6) RLS on the new tables -----------------------------------------------------

ALTER TABLE public.business_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_area_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_area_project_map ENABLE ROW LEVEL SECURITY;

-- Branch names are not sensitive (needed for AI scoping + future Brain UI);
-- the CONTENT behind restricted branches is protected on document_metadata.
CREATE POLICY business_areas_select ON public.business_areas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY business_areas_admin_write ON public.business_areas
  FOR ALL TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

-- Memberships: admins manage; users can read their own membership rows.
CREATE POLICY business_area_memberships_select ON public.business_area_memberships
  FOR SELECT TO authenticated
  USING (
    public.current_is_app_admin()
    OR person_id = public.current_person_id()
  );
CREATE POLICY business_area_memberships_admin_write ON public.business_area_memberships
  FOR ALL TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

CREATE POLICY business_area_project_map_select ON public.business_area_project_map
  FOR SELECT TO authenticated USING (true);
CREATE POLICY business_area_project_map_admin_write ON public.business_area_project_map
  FOR ALL TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

-- 7) document_metadata: additive branch-member read policy ---------------------
-- Postgres ORs permissive policies, so this strictly WIDENS access for branch
-- members. Nothing in the existing document_metadata_select policy is changed;
-- the Finance restriction lands in Phase 2 by setting access_level='restricted'
-- on Finance-area rows (which removes them from the legacy 'team' escape hatch
-- while this policy keeps them visible to branch members).

CREATE POLICY document_metadata_select_business_area ON public.document_metadata
  FOR SELECT TO authenticated
  USING (
    business_area_id IS NOT NULL
    AND public.current_is_business_area_member(business_area_id)
  );

-- 8) seed branches + fake-project mapping --------------------------------------

INSERT INTO public.business_areas (key, name, description, is_restricted) VALUES
  ('leads',               'Leads',               'Business development and lead intake knowledge', false),
  ('ai',                  'AI',                  'Alleato AI platform knowledge',                  false),
  ('finance',             'Finance',             'Finance and accounting knowledge (restricted)',  true),
  ('internal-operations', 'Internal Operations', 'Company operations knowledge',                   false),
  ('marketing',           'Marketing',           'Marketing knowledge',                            false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.business_area_project_map (project_id, business_area_id, note)
SELECT m.project_id, b.id, 'Alleato Brain migration (ALL-7): container project retired to this branch'
FROM (VALUES
  (756, 'leads'),
  (767, 'ai'),
  (60,  'finance'),
  (90,  'internal-operations'),
  (89,  'marketing')
) AS m (project_id, key)
JOIN public.business_areas b ON b.key = m.key
ON CONFLICT (project_id) DO NOTHING;
