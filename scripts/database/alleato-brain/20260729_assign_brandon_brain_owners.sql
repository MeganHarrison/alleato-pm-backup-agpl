-- ALL-11 approved ownership assignment.
-- User approval: Brandon Clymer owns all current Alleato Brain branches.
-- Finance remains deny-by-default; Brandon is its only active membership.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.people
    WHERE id = 'a2a3eaf6-b0bf-46de-b406-493289136877'::uuid
      AND status = 'active'
      AND lower(email) = 'bclymer@alleatogroup.com'
  ) THEN
    RAISE EXCEPTION 'Active Brandon Clymer person record was not found';
  END IF;

  IF (
    SELECT count(*)
    FROM public.business_areas
    WHERE key IN ('leads', 'ai', 'finance', 'internal-operations', 'marketing')
  ) <> 5 THEN
    RAISE EXCEPTION 'Expected all five Alleato Brain branches';
  END IF;
END
$$;

UPDATE public.business_areas
SET
  owner_person_id = 'a2a3eaf6-b0bf-46de-b406-493289136877'::uuid,
  updated_at = now()
WHERE key IN ('leads', 'ai', 'finance', 'internal-operations', 'marketing');

INSERT INTO public.business_area_memberships (
  business_area_id,
  person_id,
  role,
  status
)
SELECT
  id,
  'a2a3eaf6-b0bf-46de-b406-493289136877'::uuid,
  'owner',
  'active'
FROM public.business_areas
WHERE key = 'finance'
ON CONFLICT (business_area_id, person_id)
DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.business_areas
    WHERE owner_person_id = 'a2a3eaf6-b0bf-46de-b406-493289136877'::uuid
      AND key IN ('leads', 'ai', 'finance', 'internal-operations', 'marketing')
  ) <> 5 THEN
    RAISE EXCEPTION 'Brandon ownership verification failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_area_memberships AS membership
    JOIN public.business_areas AS area
      ON area.id = membership.business_area_id
    WHERE area.key = 'finance'
      AND membership.person_id = 'a2a3eaf6-b0bf-46de-b406-493289136877'::uuid
      AND membership.role = 'owner'
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Brandon Finance membership verification failed';
  END IF;
END
$$;

COMMIT;
