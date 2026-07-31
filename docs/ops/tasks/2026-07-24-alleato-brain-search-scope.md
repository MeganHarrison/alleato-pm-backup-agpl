# Task: Alleato Brain server-side search scope

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-PHASE3-SEARCH
Linear Issue: ALL-11
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINSEARCH-alleato-brain-search-scope.md`

## Objective

Complete the Phase 3 RAG boundary by adding an exact Business Area filter to
the canonical AI Database search RPC and exposing that filter through the
canonical retrieval and semantic-search owners.

Delivery lane: High-risk

Verification contract: Required

## Scope

- AI Database `search_document_chunks` signature and implementation
- Canonical frontend RAG retrieval helper
- Semantic-search Business Area input and authorization
- Exact live function/ACL readback and rolled-back filter proof

Phase 2 relabeling, rule cloning, owner assignment, memberships, UI, and cutover
are excluded.

## Acceptance Criteria

- [x] The RPC accepts one optional `filter_business_area_id`.
- [x] Project and Business Area filters are mutually exclusive and fail loudly.
- [x] The RPC filters on `document_chunks.metadata.business_area_id` before
      vector candidate limiting.
- [x] Returned rows include the typed Business Area ID.
- [x] Telemetry records the Business Area filter.
- [x] `PUBLIC`, anonymous, and authenticated execution remain revoked;
      service-role execution remains available.
- [x] The canonical retrieval helper forwards the exact filter.
- [x] Semantic search rejects unauthorized Business Area requests before RAG
      execution.
- [x] Live readback, focused tests, and negative paths pass.

## Failure-Loudly Contract

- Cause surfaced as: a named mutually-exclusive-filter error, RPC error, or
  Business Area access error.
- Detection path: migration verifier, focused frontend tests, and live
  rolled-back SQL probes.
- Recovery path: revert the single RPC migration and frontend filter argument;
  the existing post-filter authorization remains in place.

## Incident Learning

- Failure fingerprint: N/A
- Context: new RAG authorization boundary.
- Detection gap: application post-filtering can discard unauthorized top
  candidates after the RPC limit, starving authorized branch recall.
- Prevention: filter the candidate set inside the canonical RPC while keeping
  the application authorization post-filter as defense in depth.

## Evidence

- Live contract:
  `docs/ops/evidence/2026-07-24-alleato-brain-search-scope/database-readback.json`
- Negative paths:
  `docs/ops/evidence/2026-07-24-alleato-brain-search-scope/negative-path.md`
- Focused checks:
  `docs/ops/evidence/2026-07-24-alleato-brain-search-scope/regression-test.txt`
- Independent review:
  `docs/ops/evidence/2026-07-24-alleato-brain-search-scope/independent-review.md`
- Verification contract:
  `docs/ops/evidence/2026-07-24-alleato-brain-search-scope/verification-result.json`

## Final Status

- [x] Acceptance criteria complete.
- [x] Migration applied and ledger/readback verified.
- [x] Independent review and verification contract pass.
- [x] Exact paths are ready for publication to `origin/main`.
