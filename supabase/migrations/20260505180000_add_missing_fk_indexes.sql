-- Add missing indexes on FK columns across change-event and change-order tables.
--
-- PostgreSQL does NOT automatically create indexes for FK columns. Each missing
-- index here means:
--   - Cascade operations (ON DELETE SET NULL / CASCADE) do a full table scan
--   - Joins from the parent table to the child table do a full table scan
--
-- All indexes are partial (WHERE col IS NOT NULL) for nullable FKs to keep
-- the index smaller and match the only query pattern that benefits from it.
-- Non-nullable FKs use a plain index.
--
-- Tables covered:
--   change_event_rfqs          → assigned_contact_id, assigned_company_id
--   change_event_rfq_responses → responder_company_id, line_item_id
--   change_events              → prime_contract_id
--   change_order_lines         → sub_job_id
--   commitment_change_order_lines → cost_code_id, cost_type_id

-- change_event_rfqs.assigned_contact_id
-- Added by 20260501000000_add_change_event_rfqs_assigned_contact_fk.sql with no index.
CREATE INDEX IF NOT EXISTS idx_change_event_rfqs_assigned_contact
  ON public.change_event_rfqs (assigned_contact_id)
  WHERE assigned_contact_id IS NOT NULL;

-- change_event_rfqs.assigned_company_id
-- FK: change_event_rfqs_assigned_company_id_fkey → companies(id) ON DELETE SET NULL
CREATE INDEX IF NOT EXISTS idx_change_event_rfqs_assigned_company
  ON public.change_event_rfqs (assigned_company_id)
  WHERE assigned_company_id IS NOT NULL;

-- change_event_rfq_responses.responder_company_id
-- FK: change_event_rfq_responses_responder_company_id_fkey → companies(id) ON DELETE SET NULL
CREATE INDEX IF NOT EXISTS idx_change_event_rfq_responses_responder_company
  ON public.change_event_rfq_responses (responder_company_id)
  WHERE responder_company_id IS NOT NULL;

-- change_event_rfq_responses.line_item_id
-- FK: change_event_rfq_responses_line_item_id_fkey → change_event_line_items(id) ON DELETE SET NULL
CREATE INDEX IF NOT EXISTS idx_change_event_rfq_responses_line_item
  ON public.change_event_rfq_responses (line_item_id)
  WHERE line_item_id IS NOT NULL;

-- change_events.prime_contract_id
-- FK: change_events_prime_contract_id_fkey → contracts(id) ON DELETE SET NULL
-- Used in financial joins when filtering change events by prime contract.
CREATE INDEX IF NOT EXISTS idx_change_events_prime_contract_id
  ON public.change_events (prime_contract_id)
  WHERE prime_contract_id IS NOT NULL;

-- commitment_change_order_lines.cost_code_id
-- FK: commitment_change_order_lines_cost_code_id_fkey → cost_codes(id)
CREATE INDEX IF NOT EXISTS idx_commitment_co_lines_cost_code
  ON public.commitment_change_order_lines (cost_code_id);

-- commitment_change_order_lines.cost_type_id
-- FK: commitment_change_order_lines_cost_type_id_fkey → cost_code_types(id)
CREATE INDEX IF NOT EXISTS idx_commitment_co_lines_cost_type
  ON public.commitment_change_order_lines (cost_type_id);
