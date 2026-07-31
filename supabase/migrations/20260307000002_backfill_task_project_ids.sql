-- Backfill tasks.project_ids from linked document_metadata.project_id
--
-- ~83% of tasks have empty project_ids arrays despite being linked to
-- document_metadata records that have a project_id set. This migration
-- copies the project_id from document_metadata into the task's project_ids
-- array for all tasks that:
--   1. Have an empty project_ids array (= '{}')
--   2. Have a metadata_id linking to document_metadata
--   3. The linked document_metadata has a non-null project_id

UPDATE tasks t
SET project_ids = ARRAY[dm.project_id]
FROM document_metadata dm
WHERE t.metadata_id = dm.id
  AND dm.project_id IS NOT NULL
  AND (t.project_ids IS NULL OR t.project_ids = '{}');
