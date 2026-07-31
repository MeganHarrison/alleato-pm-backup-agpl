-- Alleato Brain — foundation hardening and Finance deny-by-default guard.
--
-- This follows the already-applied additive foundation migration. It does not
-- mutate that ledgered source file. It repairs current legacy-container label
-- drift, constrains membership integrity, removes excessive table privileges,
-- and makes restricted Business Areas an AND-ed RLS requirement rather than
-- another permissive policy.

BEGIN;

-- Repair any rows that arrived through a still-project-only ingestion caller.
UPDATE public.document_metadata AS document
SET business_area_id = mapping.business_area_id
FROM public.business_area_project_map AS mapping
WHERE document.project_id = mapping.project_id
  AND document.business_area_id IS NULL;

-- Finance must no longer qualify for the legacy team-access escape hatch.
UPDATE public.document_metadata AS document
SET access_level = 'restricted'
FROM public.business_areas AS area
WHERE document.business_area_id = area.id
  AND area.is_restricted = true
  AND document.access_level IS DISTINCT FROM 'restricted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_areas_owner_person_id_fkey'
      AND conrelid = 'public.business_areas'::regclass
  ) THEN
    ALTER TABLE public.business_areas
      ADD CONSTRAINT business_areas_owner_person_id_fkey
      FOREIGN KEY (owner_person_id)
      REFERENCES public.people(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_area_memberships_person_id_fkey'
      AND conrelid = 'public.business_area_memberships'::regclass
  ) THEN
    ALTER TABLE public.business_area_memberships
      ADD CONSTRAINT business_area_memberships_person_id_fkey
      FOREIGN KEY (person_id)
      REFERENCES public.people(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_area_memberships_role_nonempty'
      AND conrelid = 'public.business_area_memberships'::regclass
  ) THEN
    ALTER TABLE public.business_area_memberships
      ADD CONSTRAINT business_area_memberships_role_nonempty
      CHECK (length(btrim(role)) > 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_area_memberships_status_check'
      AND conrelid = 'public.business_area_memberships'::regclass
  ) THEN
    ALTER TABLE public.business_area_memberships
      ADD CONSTRAINT business_area_memberships_status_check
      CHECK (status IN ('active', 'inactive'))
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.business_areas
  VALIDATE CONSTRAINT business_areas_owner_person_id_fkey;
ALTER TABLE public.business_area_memberships
  VALIDATE CONSTRAINT business_area_memberships_person_id_fkey;
ALTER TABLE public.business_area_memberships
  VALIDATE CONSTRAINT business_area_memberships_role_nonempty;
ALTER TABLE public.business_area_memberships
  VALIDATE CONSTRAINT business_area_memberships_status_check;

DROP POLICY IF EXISTS document_metadata_restricted_business_area_guard
  ON public.document_metadata;

CREATE POLICY document_metadata_restricted_business_area_guard
  ON public.document_metadata
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    business_area_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id = business_area_id
        AND area.is_restricted = true
    )
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(business_area_id)
  );

COMMENT ON POLICY document_metadata_restricted_business_area_guard
  ON public.document_metadata IS
  'Deny-by-default guard for restricted Alleato Brain branches. Added after the additive Phase 1 foundation; Finance access_level tightening intentionally lands here, not in the Phase 2 dual-label operation.';

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.business_areas,
           public.business_area_memberships,
           public.business_area_project_map
  FROM anon, authenticated;

COMMIT;
