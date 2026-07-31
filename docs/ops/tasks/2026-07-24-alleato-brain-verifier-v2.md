# Task: Alleato Brain transition verifier

Status: Approved for Publication
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-VERIFIER-V2
Linear Issue: ALL-11 (connector unavailable in this session; work remains linked by the existing issue ID)
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINVERIFY-alleato-brain-verifier-v2.md`

## Objective

Prove that mapped legacy documents retain exact dual scope during migration while new documents can safely use Business-Area-only scope in both PM APP and the AI Database.

## Scope

- `scripts/database/verify-alleato-brain-foundation.mjs`
- Live PM APP and AI Database verification, exact constrained scope repairs, and a rolled-back Finance project-member persona fixture
- Explicitly excludes ingestion deployment and cutover/archive actions

## Source of Truth

- Canonical runtime/data owner: PM APP `document_metadata`; AI Database `rag_document_metadata` and `document_chunks`
- Existing shared primitives/services: `business_area_project_map`, Business Area RLS helpers, `SupabaseRagStore.set_document_scope`
- Deprecated or parallel paths: legacy mapped project scope is transition-only

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Mapped legacy rows without their exact Business Area fail loudly.
- [x] Business-Area-only rows pass when project scope is null.
- [x] A Business Area paired with the wrong legacy project fails loudly.
- [x] RAG documents and chunks require the same exact Business Area label.
- [x] Matching IDs have exact cross-database scope and every Business-Area-only row has a replica.
- [x] Effective table/function grants bind to exact roles and function signatures.
- [x] Finance denial tests use actual principal IDs, including a rolled-back project-membership fixture.
- [x] Live readback passes after narrowly scoped drift repair.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared verifier owns the cross-database contract.
- [x] Errors are specific and actionable.
- [x] Database and authorization checks are read-only except an explicit, double-confirmed RAG scope repair and a rolled-back Finance persona fixture.

## Integration and Verification

- [x] Targeted transition-fixture checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an assertion naming PM APP or AI Database scope parity.
- Detection path: `ALLEATO_ENV_FILE=/home/friday/code/project-management/.env node scripts/database/verify-alleato-brain-foundation.mjs`
- Recovery path: re-run the owning ingestion path or apply an exact-ID/data-invariant repair, then repeat live readback.

## Incident Learning

- Failure fingerprint: `data.rag-scope-replication-drift`
- Root cause: The legacy copier omitted `business_area_id`, and the prior verifier prefiltered each catalog before matching counterparts.
- Detection gap: No transition-state assertion compared a scoped row with an existing counterpart whose scope had been removed.
- Prevention: Compare complete catalogs, assert exact mapped legacy parity, allow null project scope, reject mismatched pairings, and explicitly replicate both scope dimensions.
- Guardrail evidence: `live-verifier.json`, transition self-test, and exact pre-repair scope snapshot

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Baseline live verifier | `ALLEATO_ENV_FILE=... node scripts/database/verify-alleato-brain-foundation.mjs` | Fail as expected | Detected a newly arrived Outlook mapped-project row missing Business Area scope. |
| Transition fixtures | `node scripts/database/verify-alleato-brain-foundation.mjs --self-test` | Pass | Accepts Business-Area-only state and rejects mismatched dual scope. |
| Repair guard negative path | `ALLEATO_ENV_FILE=.env node scripts/database/verify-alleato-brain-foundation.mjs --self-test-repair-guard` | Pass | Live AI Database transaction surfaced `RAG_SCOPE_REPAIR_COUNT_MISMATCH expected=2 candidates=1 documents=1`; fixture timestamp readback proved rollback. |
| Scoped drift repair | Exact-ID PM APP and AI Database update | Pass | One Outlook Finance email repaired; one RAG document and one chunk updated. |
| Live verifier | `docs/ops/evidence/2026-07-24-alleato-brain-verifier-v2/live-verifier.json` | Pass | At `2026-07-24T05:46:05.764Z`: zero PM APP/RAG mismatches; Finance deny-by-default and all six migration ledgers verified. |
| Repair evidence | `docs/ops/evidence/2026-07-24-alleato-brain-verifier-v2/scoped-drift-repair.md` | Pass | Exact ID, pre-state, constrained statements, row counts, after-state, and rollback recorded. |
| Catalog scope reconciliation | `docs/ops/evidence/2026-07-24-alleato-brain-verifier-v2/rag-scope-reconciliation.md` | Pass | 175 RAG documents and 2,068 chunks reconciled from PM APP; exact scope-key snapshot and count-guarded rollback generator retained. |

## Remaining Risk

- Legacy catalog coverage remains transitional: 9 legacy PM APP rows lack a RAG metadata replica and 1,913 legacy RAG rows lack a PM APP catalog replica. Shared IDs have zero scope mismatches, and Business-Area-only rows have zero missing replicas. Catalog reconciliation is required before legacy-container cutover.
- The verifier caught recurring Fireflies RAG metadata drift after the first repair. Four exact rows were repaired, but runtime closure requires Render commit readback and a clean scheduled run. No Render credential is present in this session.
- Independent high-risk review approved the final code and evidence. Publication is the remaining mechanical closeout; Fireflies production commit readback is tracked by the separate Fireflies routing task.

## Final Status

- [x] All required checklist items are complete except the publication receipt updated by `codex:finish`.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred work has cause, detection gap, prevention step, owner, and next action.
