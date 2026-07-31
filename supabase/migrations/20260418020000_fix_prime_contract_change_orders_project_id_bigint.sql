-- Migration: fix prime_contract_change_orders.project_id column type integer → bigint
-- Reason: projects.id is bigint; FK columns should match to avoid potential overflow
--         and to satisfy strict type consistency checks.
--
-- This is a widening cast (integer → bigint) so it is safe with no data loss.

ALTER TABLE prime_contract_change_orders
  ALTER COLUMN project_id TYPE bigint USING project_id::bigint;
