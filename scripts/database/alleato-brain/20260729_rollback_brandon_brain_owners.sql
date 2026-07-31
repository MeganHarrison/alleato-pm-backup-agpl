-- Roll back only the ownership/membership introduced by
-- 20260729_assign_brandon_brain_owners.sql.

BEGIN;

UPDATE public.business_areas
SET
  owner_person_id = NULL,
  updated_at = now()
WHERE key IN ('leads', 'ai', 'finance', 'internal-operations', 'marketing')
  AND owner_person_id = 'a2a3eaf6-b0bf-46de-b406-493289136877'::uuid;

DELETE FROM public.business_area_memberships AS membership
USING public.business_areas AS area
WHERE area.id = membership.business_area_id
  AND area.key = 'finance'
  AND membership.person_id = 'a2a3eaf6-b0bf-46de-b406-493289136877'::uuid
  AND membership.role = 'owner';

COMMIT;
