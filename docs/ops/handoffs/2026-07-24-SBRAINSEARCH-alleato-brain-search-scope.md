# Handoff: Alleato Brain server-side search scope

Date: 2026-07-24
Session: SBRAINSEARCH
Task: ALL-11-PHASE3-SEARCH
Delivery lane: High-risk
Status: Complete

## Owned paths

- `scripts/database/rag/migrations/20260724065000_add_business_area_filter_to_search_document_chunks.sql`
- `scripts/database/verify-alleato-brain-search-scope.mjs`
- Canonical frontend RAG retrieval, semantic-search, schema, and focused tests
- Task, evidence, and this handoff

## Acceptance contract

Add a mutually exclusive server-side Business Area filter, preserve RPC ACLs,
forward the filter through canonical callers, reject unauthorized requests,
and prove the live database behavior without weakening the existing
application post-filter.

## Current state

The live RPC now applies the exact Business Area filter before vector candidate
limiting, preserves all ten legacy positional arguments, and appends the branch
filter as argument eleven. Frontend semantic and category search enforce exact
authorization and retain application post-filtering as defense in depth.

## Migration ledger evidence

AI Database project `fqcvmfqldlewvbsuxdvz` contains migration version
`20260724065000` with name
`add_business_area_filter_to_search_document_chunks`. Live readback found the
single expected eleven-argument signature, service-role-only execution, 17,379
numeric Business Area labels, and zero invalid labels.

## Verification

- Focused Jest: 3 suites, 34 tests passed.
- `quality:changed`: passed.
- Transactional migration compile/rollback: passed.
- Live exact-filter proof: 5/5 results matched Business Area 3.
- Mixed scope and nonpositive branch IDs: rejected with SQLSTATE `22023`.
- Independent review: approved with no blocker/high findings.

## Rollback

Restore the preceding ten-argument function body from migration
`20260624200000`, reapply the service-role-only grants from `20260724052500`,
and remove the frontend filter argument. The application post-filter remains
fail-closed throughout rollback.
