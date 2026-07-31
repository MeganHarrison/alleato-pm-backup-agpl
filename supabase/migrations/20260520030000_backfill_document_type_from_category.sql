-- Migration: backfill_document_type_from_category
-- Phase 4 Day 1 — Backfill document_type on document_metadata from existing category values.
-- NOTE: This migration cannot run via the Supabase MCP runner due to the
-- set_project_id_from_title_trg trigger timing out on unassigned rows.
-- Backfill was applied directly via psql (DATABASE_URL) on 2026-05-20.
--
-- Mapping applied:
--   teams_message             → teams_message
--   email                     → email_message
--   meeting/fireflies         → meeting_transcript
--   email_attachment          → email_attachment
--   contract/commitment       → executed_contract
--   drawing                   → drawing_revision
--   permit                    → permit
--   submittal                 → submittal
--   rfi/rfi_document          → rfi_response
--   financial_document/invoice → invoice_document
--   lein-waiver               → lien_waiver_progress
--   change-order/change_order → change_order_executed
--   budget/specification/knowledge/internal/etc → other
--   document / NULL           → NULL (Phase 9 will handle these)
--
-- Post-backfill distribution (PM APP):
--   teams_message:       27,286
--   email_message:        2,445
--   other:                  361
--   invoice_document:       124
--   drawing_revision:        28
--   executed_contract:       27
--   rfi_response:            12
--   permit:                   2
--   change_order_executed:    1
--   submittal:                1
--   lien_waiver_progress:     1
--   NULL (document/unknown): 6,464  ← Phase 9
--
-- Same backfill applied to rag_document_metadata in RAG project (fqcvmfqldlewvbsuxdvz).
-- RAG project updated: 361 rows (no trigger on that project).

-- If re-running manually on a fresh database (e.g. local dev restore):
-- Run these in order, scoping project_id IS NOT NULL first to avoid the trigger:

update public.document_metadata set document_type = 'teams_message'
where category = 'teams_message' and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'email_message'
where category = 'email' and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'meeting_transcript'
where category in ('meeting','fireflies','meeting_transcript') and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'email_attachment'
where category in ('email_attachment','graph_attachment') and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'executed_contract'
where lower(category) in ('contract','commitment') and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'drawing_revision'
where lower(category) = 'drawing' and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'permit'
where lower(category) = 'permit' and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'submittal'
where lower(category) = 'submittal' and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'rfi_response'
where lower(category) in ('rfi','rfi_document') and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'invoice_document'
where lower(category) in ('financial_document','invoice') and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'lien_waiver_progress'
where lower(category) in ('lein-waiver','lien_waiver') and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'change_order_executed'
where lower(category) in ('change-order','change_order') and project_id is not null and document_type is null;

update public.document_metadata set document_type = 'other'
where lower(category) in (
  'budget','specification','knowledge','internal','psr',
  'job planner','weekly exec','weekly ops','ops update','proposal'
) and project_id is not null and document_type is null;

-- For project_id IS NULL rows, use psql with no statement_timeout set
-- (the set_project_id_from_title trigger has a broken p.client reference that
--  causes every null-project update to error — fixed separately in a trigger repair migration).
