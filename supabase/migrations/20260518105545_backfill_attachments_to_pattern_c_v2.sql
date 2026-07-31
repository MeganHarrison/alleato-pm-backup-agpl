-- Ledger repair: backfill_attachments_to_pattern_c_v2
--
-- This migration version exists in the linked Supabase migration ledger:
--   20260518105545 | backfill_attachments_to_pattern_c_v2
--
-- The original SQL was applied remotely before this file was present in the
-- checkout. It migrated legacy public.attachments rows for commitments and
-- prime contracts into Pattern C document_metadata + junction rows.
--
-- Important ordering note:
-- This timestamp sorts before the local Pattern C base migrations
-- (document_type_taxonomy and junction-table creation). Replaying the original
-- DML here would break local reset order, so this file is intentionally a
-- ledger placeholder. The replay-safe, idempotent reconciliation lives in:
--   20260524010000_reconcile_pattern_c_attachment_backfills.sql

do $$
begin
  raise notice 'Ledger placeholder for remotely applied backfill_attachments_to_pattern_c_v2. See 20260524010000 reconciliation migration.';
end $$;
