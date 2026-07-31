-- Ledger repair: create_change_event_documents_and_backfill_v2
--
-- This migration version exists in the linked Supabase migration ledger:
--   20260518105737 | create_change_event_documents_and_backfill_v2
--
-- The original SQL was applied remotely before this file was present in the
-- checkout. It created public.change_event_documents, extended
-- public.user_can_access_entity(), and backfilled change_event_attachments plus
-- submittal_attachments into Pattern C document_metadata + junction rows.
--
-- Important ordering note:
-- This timestamp sorts before the local Pattern C base migrations
-- (document_type_taxonomy and shared junction-table creation). Replaying the
-- original DDL/DML here would make local reset order fragile, so this file is
-- intentionally a ledger placeholder. The replay-safe, idempotent
-- reconciliation lives in:
--   20260524010000_reconcile_pattern_c_attachment_backfills.sql

do $$
begin
  raise notice 'Ledger placeholder for remotely applied create_change_event_documents_and_backfill_v2. See 20260524010000 reconciliation migration.';
end $$;
