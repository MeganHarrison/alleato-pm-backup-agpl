-- Job Planner change-management import: idempotency + traceability keys.
--
-- The Job Planner change-request importer (scripts/jobplanner/import-change-requests.mjs)
-- needs a stable key on every row it writes so re-runs update in place instead of
-- duplicating. No change-management table has a jobplanner_* / source_system column
-- today (only the Acumatica-owned executed-CO tables carry acumatica_external_key).
-- This mirrors the punch_items.jobplanner_punchlist_item_id precedent.
--
-- Additive, nullable, no backfill — zero risk to existing rows. Partial-unique index
-- (WHERE jobplanner_id IS NOT NULL) enforces one app row per JP object without
-- constraining the many pre-existing rows that have no JP origin.

ALTER TABLE public.change_events            ADD COLUMN IF NOT EXISTS jobplanner_id bigint;
ALTER TABLE public.change_event_line_items  ADD COLUMN IF NOT EXISTS jobplanner_id bigint;
ALTER TABLE public.prime_contract_pcos      ADD COLUMN IF NOT EXISTS jobplanner_id bigint;
ALTER TABLE public.commitment_pcos          ADD COLUMN IF NOT EXISTS jobplanner_id bigint;
ALTER TABLE public.pco_line_items           ADD COLUMN IF NOT EXISTS jobplanner_id bigint;
ALTER TABLE public.change_event_pco_links   ADD COLUMN IF NOT EXISTS jobplanner_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS uq_change_events_jobplanner_id
  ON public.change_events (jobplanner_id) WHERE jobplanner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_change_event_line_items_jobplanner_id
  ON public.change_event_line_items (jobplanner_id) WHERE jobplanner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_prime_contract_pcos_jobplanner_id
  ON public.prime_contract_pcos (jobplanner_id) WHERE jobplanner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_commitment_pcos_jobplanner_id
  ON public.commitment_pcos (jobplanner_id) WHERE jobplanner_id IS NOT NULL;
-- pco_line_items is keyed by (jobplanner_id, pco_type): a single JP change-request line
-- can fork to BOTH a prime PCO and a commitment PCO, producing one pco_line_item per side.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pco_line_items_jobplanner_id_type
  ON public.pco_line_items (jobplanner_id, pco_type) WHERE jobplanner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_change_event_pco_links_jobplanner_id
  ON public.change_event_pco_links (jobplanner_id) WHERE jobplanner_id IS NOT NULL;
