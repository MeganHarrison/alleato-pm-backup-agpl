-- =============================================================================
-- Drop dead legacy tables (Phase 6 of CONSOLIDATED-IMPLEMENTATION-PLAN.md)
-- =============================================================================
--
-- DO NOT APPLY without human review. This migration drops tables that have been
-- verified as fully dead via the following audit performed 2026-05-15:
--
--   For each table below, all of the following were verified:
--     1. Row count via SQL.
--     2. Code grep across frontend/src, backend/src, supabase/, scripts/
--        — only hits were generated database.types.ts entries (auto-regenerated
--        from schema) and one stale comment in frontend/src/lib/bot/index.ts.
--        No `.from("<table>")` callsite. No backend ORM usage.
--     3. pg_policies — no RLS policies reference these tables.
--     4. pg_constraint — FK references catalogued; child tables also dead and
--        included in this migration.
--     5. pg_views — no views reference these tables.
--     6. pg_trigger — no user triggers on these tables.
--
-- Verdict matrix:
--   chat_messages              0 rows, no refs, no RLS, no FKs in, no views, no triggers
--   chat_sessions              0 rows, no refs (FK from chat_messages — dropped first)
--   chat_threads               8 rows, no refs (3 child tables — all dead, dropped first)
--   chat_thread_items          6 rows, no refs
--   chat_thread_attachments    0 rows, no refs (1 child — chat_thread_attachment_files)
--   chat_thread_attachment_files 0 rows, no refs
--   chat_thread_feedback       0 rows, no refs
--   subcontractor_contacts     0 rows, no refs, FK to subcontractors (kept)
--
-- NOTE: A prior migration 20260322200000_drop_dead_tables.sql attempted the same
-- drops but evidently never ran (tables still present). This migration supersedes
-- it for the subset that is still live. The stale comment in
-- frontend/src/lib/bot/index.ts referring to "Supabase chat_messages table"
-- should be removed in a follow-up (it is a comment only — no functional impact).
--
-- subcontractor_companies was listed as a candidate but DOES NOT EXIST in the
-- database — nothing to drop. The active table is `subcontractors`, which is
-- KEPT (only `subcontractor_contacts` is dropped here).
--
-- All drops use IF EXISTS + CASCADE for safety.
-- =============================================================================

begin;

-- Child tables first (FK dependencies)
drop table if exists public.chat_thread_attachment_files cascade;
drop table if exists public.chat_thread_attachments cascade;
drop table if exists public.chat_thread_feedback cascade;
drop table if exists public.chat_thread_items cascade;

-- Parent chat_threads
drop table if exists public.chat_threads cascade;

-- chat_messages -> chat_sessions FK chain
drop table if exists public.chat_messages cascade;
drop table if exists public.chat_sessions cascade;

-- Subcontractor contacts (FKs to subcontractors which is preserved)
drop table if exists public.subcontractor_contacts cascade;

commit;
