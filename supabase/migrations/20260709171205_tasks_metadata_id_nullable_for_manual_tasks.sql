-- Enable manual (ad-hoc) task creation.
--
-- Context: every row in public.tasks was historically AI-extracted from a source
-- document (meeting / email / Teams), so `metadata_id` (FK -> document_metadata.id)
-- was NOT NULL. A user-created task has no source document, so that NOT NULL
-- constraint made manual task creation impossible.
--
-- This drops the NOT NULL so a manual task can insert with metadata_id = NULL and
-- source_system = 'manual'. The FK itself is unchanged (still validates when a
-- value is present); only presence is now optional.
--
-- The tasks_enforce_quality_on_insert() trigger (20260528000000) still applies:
-- every insert must have a non-empty title, and AI source systems still require
-- extraction_prompt_version. 'manual' is not an AI source_system, so manual tasks
-- only need a non-empty title (the API derives one from the description when the
-- user leaves it blank).

ALTER TABLE public.tasks ALTER COLUMN metadata_id DROP NOT NULL;

COMMENT ON COLUMN public.tasks.metadata_id IS
  'FK -> document_metadata.id of the source document that produced this task. NULL for manual (source_system = ''manual'') tasks created by a user. Made nullable 2026-07-09 to enable ad-hoc task creation.';
