-- Add Job Planner provenance + external-key column to punch_items so the
-- Job Planner punch-list import (scripts/jobplanner/import-punch-list.mjs) can
-- upsert idempotently instead of inserting duplicates on every re-run.
--
-- punch_items (unlike rfis) has no source_system/source_metadata columns, so we
-- add a typed external key. The partial unique index guarantees one app row per
-- Job Planner punchlist item while leaving hand-entered rows (NULL) unconstrained.

ALTER TABLE public.punch_items
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS jobplanner_punchlist_item_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS uq_punch_items_jobplanner_punchlist_item_id
  ON public.punch_items (jobplanner_punchlist_item_id)
  WHERE jobplanner_punchlist_item_id IS NOT NULL;

COMMENT ON COLUMN public.punch_items.jobplanner_punchlist_item_id IS
  'Job Planner punchlistItemId for JP-sourced rows. Idempotency key for the JP import. NULL for app-entered rows.';
COMMENT ON COLUMN public.punch_items.source_system IS
  'Origin of the row, e.g. ''jobplanner''. NULL for app-entered rows.';
