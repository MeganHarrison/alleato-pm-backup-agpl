-- Lift the 2026-06-17 Outlook-ingestion incident block.
--
-- APPLIED LIVE to the PM APP project (lgveqfnpkxvzbnnwuled) on 2026-06-24; this
-- file commits it to the repo so it is no longer a hand-applied ghost.
--
-- Background: on 2026-06-17 13:35 UTC a hand-applied (untracked) trigger set was
-- installed to pause Outlook writes into document_metadata while the
-- document_type_classifier was being rebuilt (migrations document_type_classifier
-- / document_metadata_classify_trigger, same afternoon). The block was never
-- lifted. It silently dropped writes (RETURN null, NO exception raised) for 7
-- days: ~4,085 inserts/updates rejected app-wide, still firing 2026-06-24 06:54.
-- Net effect: no new Outlook email/attachment documents entered the AI's
-- document store (document_metadata -> document_chunks) for a week, even though
-- the inbox UI looked current (it reads outlook_email_intake live, a different
-- table that was never blocked).
--
-- The classifier rebuild that prompted the block is long since stable. This
-- removes the block on all three tables it covered. The two evidence/audit tables
-- (db_incident_outlook_write_block_log, db_incident_write_log) are KEPT as the
-- historical record of the incident.
--
-- GUARDRAIL NOTE: a guard that needs to reject writes must RAISE EXCEPTION (loud)
-- — never RETURN null (silent). Silent drops violate the project's first rule
-- ("Never ship silent failures") and are how this went unnoticed for a week.

DROP TRIGGER IF EXISTS trg_db_incident_block_outlook_document_metadata ON public.document_metadata;
DROP TRIGGER IF EXISTS trg_db_incident_block_outlook_intake            ON public.outlook_email_intake;
DROP TRIGGER IF EXISTS trg_db_incident_block_outlook_attachments       ON public.outlook_email_intake_attachments;

DROP TRIGGER IF EXISTS trg_db_incident_write_log_outlook_document_metadata ON public.document_metadata;
DROP TRIGGER IF EXISTS trg_db_incident_write_log_outlook_intake            ON public.outlook_email_intake;
DROP TRIGGER IF EXISTS trg_db_incident_write_log_outlook_attachments       ON public.outlook_email_intake_attachments;

DROP FUNCTION IF EXISTS public.block_outlook_ingestion_during_incident();
DROP FUNCTION IF EXISTS public.log_db_incident_write();
