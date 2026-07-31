# Handoff: Alleato Brain RAG scope synchronization

Status: Approved for Publication
Task: ALL-11-RAG-SCOPE-SYNC
Delivery lane: High-risk

## Outcome

The canonical legacy PM-to-RAG copier now selects and projects
`business_area_id`, and a scope-only mode reconciles existing RAG metadata and
linked chunks without touching content or embeddings. Normal copy also
reconciles chunks. Both modes use a repeatable-read source snapshot, keyset
pagination, per-batch assertions, and a final whole-snapshot scope assertion.

## Root cause

The copier selected `project_id` but omitted the separate Business Area column.
The old verifier also prefiltered both catalogs, hiding existing counterparts
whose scope had been removed.

## Verification

- Syntax: pass
- Focused Node tests: 7/7 pass
- Live reconciliation equivalent: 175 documents and 2,068 chunks
- Live full verifier: pass at `2026-07-24T05:46:05.764Z`
- Independent high-risk review: APPROVED

## Migration ledger evidence

N/A; this slice does not add a database migration.

## Remaining risk

Render commit/scheduled-run proof for Fireflies remains a separate deployment
gate. The session also lacks direct database URLs, so the live correction used
the equivalent guarded Supabase Management API transaction rather than invoking
the new CLI mode.
