-- Alleato Brain document access boundary.
--
-- Historical document_metadata policies treat access_level='team' as visible
-- to every authenticated identity. Business Area documents are company-internal
-- records, so a restrictive policy must reject external contacts even when an
-- older permissive policy matches.

BEGIN;

DROP POLICY IF EXISTS document_metadata_business_area_internal_guard
  ON public.document_metadata;
CREATE POLICY document_metadata_business_area_internal_guard
  ON public.document_metadata
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    business_area_id IS NULL
    OR public.current_is_active_internal_employee()
  )
  WITH CHECK (
    business_area_id IS NULL
    OR public.current_is_active_internal_employee()
  );

COMMENT ON POLICY document_metadata_business_area_internal_guard
  ON public.document_metadata IS
  'Business Area documents require an active internal employee identity even when a legacy permissive team policy also matches.';

-- The foundation guard originally protected restricted branches on SELECT
-- only. Apply the same deny-by-default membership/admin contract to every
-- operation so a legacy project_id-null write policy cannot bypass Finance.
DROP POLICY IF EXISTS document_metadata_restricted_business_area_guard
  ON public.document_metadata;
CREATE POLICY document_metadata_restricted_business_area_guard
  ON public.document_metadata
  AS RESTRICTIVE
  FOR ALL
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
  )
  WITH CHECK (
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
  'Restricted Business Area documents require active membership or app-admin authorization for reads and writes.';

COMMIT;
