-- Stop auto-creating people contacts from communications (emails + meetings).
--
-- The trigger `document_metadata_auto_people_contacts_trg` (added in
-- 20260430110000_auto_people_contacts_from_comms.sql) inserted a
-- people row (person_type='contact') for every email sender and meeting
-- attendee/speaker. This flooded the directory with junk contacts
-- ("Accounts Receivable", "BuildingConnected Profiles", raw email fragments,
-- etc.). The directory's source of truth for contacts is Acumatica /
-- job-planner sync, so this side-channel is being retired.
--
-- We DROP the trigger only. The helper functions
-- (upsert_people_contact_from_comms, backfill_people_contacts_from_comms, ...)
-- are intentionally left in place so the backfill RPC can still be invoked
-- manually if ever needed, but nothing fires automatically anymore.

DROP TRIGGER IF EXISTS document_metadata_auto_people_contacts_trg
  ON public.document_metadata;
