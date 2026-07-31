-- Add a missing FK constraint on change_event_rfqs.assigned_contact_id.
--
-- Context: the RFQ create API route validates that assigned_contact_id
-- exists in public.people before insert (see
-- frontend/src/app/api/projects/[projectId]/change-events/rfqs/route.ts),
-- but the column itself has no DB-level FK. If a referenced person were
-- ever deleted, the orphan would persist silently and the RFQ would point
-- at nothing. The application FK validation (Form ↔ DB FK Audit, 2026-05-01)
-- caught this gap.
--
-- Safety: ON DELETE SET NULL preserves the RFQ row when a contact is
-- removed, matching the column's nullable contract. Existing orphans (if
-- any) are nulled before the constraint is added so the migration cannot
-- fail mid-deploy.

DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.change_event_rfqs r
  WHERE r.assigned_contact_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.people p WHERE p.id = r.assigned_contact_id
    );

  IF orphan_count > 0 THEN
    RAISE NOTICE
      'Nullifying % change_event_rfqs.assigned_contact_id rows that no longer reference an existing person.',
      orphan_count;

    UPDATE public.change_event_rfqs r
    SET assigned_contact_id = NULL
    WHERE r.assigned_contact_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.people p WHERE p.id = r.assigned_contact_id
      );
  END IF;
END
$$;

ALTER TABLE public.change_event_rfqs
  DROP CONSTRAINT IF EXISTS change_event_rfqs_assigned_contact_id_fkey;

ALTER TABLE public.change_event_rfqs
  ADD CONSTRAINT change_event_rfqs_assigned_contact_id_fkey
  FOREIGN KEY (assigned_contact_id)
  REFERENCES public.people(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.change_event_rfqs.assigned_contact_id IS
  'Person to whom the RFQ is distributed. FK to public.people; nulled on delete.';
