-- ============================================================
-- Drop legacy change order tables
-- ============================================================
-- These tables are unused (0 rows each) and all code references
-- have been removed. The real data lives in:
--   - prime_contract_change_orders (PCCOs)
--   - contract_change_orders (CCOs / commitment COs)
--
-- Drop order respects FK dependencies (children first).
-- ============================================================

-- 1. Children of change_orders (all have FK → change_orders.id)
DROP TABLE IF EXISTS public.change_order_approvals CASCADE;
DROP TABLE IF EXISTS public.change_order_attachments CASCADE;
DROP TABLE IF EXISTS public.change_order_costs CASCADE;
DROP TABLE IF EXISTS public.change_order_lines CASCADE;
-- 2. The parent legacy table
DROP TABLE IF EXISTS public.change_orders CASCADE;
-- 3. Other orphaned tables (0 rows, 0 code references)
DROP TABLE IF EXISTS public.prime_potential_change_orders CASCADE;
DROP TABLE IF EXISTS public.change_event_rfq_attachments CASCADE;
-- Note: acumatica_change_orders (1817 rows) is NOT dropped here.
-- It may still be used by the Python sync pipeline. Drop separately
-- after confirming with the backend team.;
