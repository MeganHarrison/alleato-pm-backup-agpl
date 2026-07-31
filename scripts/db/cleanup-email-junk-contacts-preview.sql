-- ============================================================================
-- People/contacts cleanup — PREVIEW (read-only, safe to run)
-- ============================================================================
--
-- This file NEVER modifies data. It confirms how many "email-junk" contacts are
-- still in `people` and whether any are attached to real records.
--
--   psql "$DATABASE_URL" -f scripts/db/cleanup-email-junk-contacts-preview.sql
--   (or paste into the Supabase SQL editor)
--
-- BACKGROUND
--   The retired trigger `document_metadata_auto_people_contacts_trg`
--   (20260430110000_auto_people_contacts_from_comms.sql) auto-created a
--   `people` row for every email sender / meeting attendee / transcript speaker.
--   It was dropped on 2026-06-30 (20260630233000_stop_auto_people_contacts_from_comms.sql),
--   so NO new junk is created — but that migration dropped the trigger ONLY; the
--   existing junk rows were removed separately and externally retained under
--   governed recovery policy. This preview shows what, if any,
--   junk survived that pass.
--
-- ORIGIN MARKERS (there is no source column on `people`; origin lives in metadata)
--   * Email/meeting auto-created (JUNK):  metadata->>'auto_created_from' = 'document_metadata'
--   * JobPlanner / manual (KEEP):         person_type='contact' AND metadata->>'auto_created_from' IS NULL
--   * App users (NEVER TOUCH):            person_type='user' OR auth_user_id IS NOT NULL
--   * Acumatica: does NOT create people rows (it writes `vendors`), so it is not an origin here.
--   NOTE: metadata->>'last_auto_contact_source' flags KEEP rows merely *seen* in
--         email — it is NOT a junk marker. Only 'auto_created_from' means junk.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SUMMARY — the buckets.
-- ----------------------------------------------------------------------------
SELECT
  count(*)                                                                       AS total_people,
  count(*) FILTER (WHERE person_type = 'user' OR auth_user_id IS NOT NULL)       AS app_users_never_touch,
  count(*) FILTER (WHERE metadata->>'auto_created_from' = 'document_metadata')   AS email_junk_total,
  count(*) FILTER (WHERE metadata->>'auto_created_from' = 'document_metadata'
                     AND person_type <> 'user' AND auth_user_id IS NULL)         AS email_junk_removable,
  count(*) FILTER (WHERE person_type = 'contact'
                     AND (metadata IS NULL OR metadata->>'auto_created_from' IS NULL)) AS keep_jobplanner_or_manual
FROM public.people;

-- ----------------------------------------------------------------------------
-- REMOVABLE JUNK, annotated with whether the row is attached to a meaningful
-- record. Rows with referenced_meaningfully = true deserve a look before removal
-- (reassign the reference first); the rest are safe orphans.
-- (meeting_attendees / distribution_group_members are expected for email
--  contacts and are deliberately NOT counted as "meaningful".)
-- ----------------------------------------------------------------------------
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.metadata->>'auto_contact_source_kind' AS source_kind,   -- email | meeting | meeting_transcript
  p.created_at,
  (
    EXISTS (SELECT 1 FROM public.companies                    x WHERE x.primary_contact_id = p.id)
    OR EXISTS (SELECT 1 FROM public.project_companies         x WHERE x.primary_contact_id = p.id)
    OR EXISTS (SELECT 1 FROM public.project_contact_references x WHERE x.person_id = p.id)
    OR EXISTS (SELECT 1 FROM public.project_directory_memberships x WHERE x.person_id = p.id)
    OR EXISTS (SELECT 1 FROM public.tasks                     x WHERE x.assignee_person_id = p.id)
    OR EXISTS (SELECT 1 FROM public.meeting_items            x WHERE x.assignee_person_id = p.id)
    OR EXISTS (SELECT 1 FROM public.purchase_orders          x WHERE x.bill_to_contact_id = p.id OR x.ship_to_contact_id = p.id)
    OR EXISTS (SELECT 1 FROM public.vendor_contacts          x WHERE x.person_id = p.id)
    OR EXISTS (SELECT 1 FROM public.rfi_responses            x WHERE x.responder_person_id = p.id)
  ) AS referenced_meaningfully
FROM public.people p
WHERE p.metadata->>'auto_created_from' = 'document_metadata'
  AND p.person_type <> 'user'
  AND p.auth_user_id IS NULL
ORDER BY referenced_meaningfully DESC, p.created_at;
