# Task: Alleato Brain RAG scope synchronization

Status: Approved for Publication
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-RAG-SCOPE-SYNC
Linear Issue: ALL-11 (connector unavailable in this session; work remains linked by the existing issue ID)
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINSCOPE-alleato-brain-rag-scope-sync.md`

## Objective

Make PM APP `document_metadata.project_id` and `business_area_id` authoritative
when copying shared document scope to RAG metadata and chunks.

## Scope

- `scripts/database/rag/copy-document-metadata-to-rag.mjs`
- Focused payload regression tests
- Explicitly excludes content, embedding, and standalone-memory changes

## Source of Truth

- Canonical runtime/data owner: PM APP `public.document_metadata`
- Existing shared primitives/services: legacy metadata copier and cross-database foundation verifier
- Deprecated or parallel paths: independent RAG scope edits are not an authority for shared document IDs

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Full copy selects and explicitly projects `business_area_id`.
- [x] Explicit PM APP de-scoping clears stale RAG Business Area scope.
- [x] `--scope-only` updates only existing RAG document/chunk scope.
- [x] Scope-only updates preserve content, embeddings, and unrelated metadata.
- [x] Normal copy and scope-only copy both reconcile linked chunk scope.
- [x] A repeatable-read source snapshot, keyset pagination, scanned-count check, per-batch RAG postcondition, and final whole-snapshot postcondition fail on drift.
- [x] Live cross-database verifier reports zero shared scope mismatches.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] The canonical copier owns shared PM-to-RAG projection.
- [x] Missing database URLs fail with specific required-variable messages.
- [x] Scope reconciliation is idempotent and updates only mismatched rows.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures are documented.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing PM/RAG database URL, failed batch query, or nonzero cross-database mismatch.
- Detection path: copier process exit plus `ALLEATO_ENV_FILE=.env node scripts/database/verify-alleato-brain-foundation.mjs`
- Recovery path: restore the pre-repair scope snapshot or rerun `--scope-only`, then require a clean verifier.

## Incident Learning

- Failure fingerprint: `data.rag-scope-replication-drift`
- Root cause: The legacy copier selected project scope but omitted the separate Business Area column.
- Detection gap: Prior parity queries prefiltered each catalog and could not see an existing de-scoped counterpart.
- Prevention: Explicitly copy both scope dimensions, reconcile chunks, and compare complete catalogs.
- Guardrail evidence: verifier `live-verifier.json` and focused payload tests

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Syntax | `node --check scripts/database/rag/copy-document-metadata-to-rag.mjs` | Pass | Executable module syntax is valid. |
| Unit | `node --test scripts/database/rag/__tests__/copy-document-metadata-to-rag.test.mjs` | Pass | 7/7 payload, transaction, keyset, and failure-loudly contracts pass. |
| Live repair | Verifier `--repair-rag-scope --confirm-app-authoritative` | Pass | Reconciled 175 documents and 2,068 chunks; exact snapshot retained. |
| Live readback | `docs/ops/evidence/2026-07-24-alleato-brain-verifier-v2/live-verifier.json` | Pass | Zero shared, malformed, document/chunk, and standalone scope mismatches. |

## Remaining Risk

- The session has no direct PM/RAG database URLs, so the new copier mode was
  not itself used for the live repair. The equivalent guarded SQL was executed
  through the Supabase Management API and is covered by the same live verifier.
- Fireflies runtime deployment proof remains tracked by its separate task.

## Final Status

- [x] All required checklist items are complete except the publication receipt updated by `codex:finish`.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred provider/runtime proof names its owner and next action.
