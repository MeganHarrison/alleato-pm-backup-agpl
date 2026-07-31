-- AAI-1108: split summary briefing access from sensitive executive detail.
-- Existing briefing-authorized templates retain their current full experience;
-- administrators can remove this capability to create a summary-only role.
BEGIN;
UPDATE public.permission_templates
SET granular_flags = array_append(granular_flags, 'view_executive_details'),
    updated_at = now()
WHERE 'view_executive_briefing' = ANY(granular_flags)
  AND NOT ('view_executive_details' = ANY(granular_flags));
COMMIT;
