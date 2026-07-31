# Task: Deepen AI Chat Research Contract

Status: In Progress — FMDS revision pinning verified; publication pending
Owner: Codex SROOT-AAI-1248
Created: 2026-07-22
Task ID: AAI-1248
Linear Issue: AAI-1248 — https://linear.app/megankharrison/issue/AAI-1248/deepen-ai-chat-mixed-source-research-contract
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-aai-1248-chat-turn-research-contract.md`

## Objective

One Chat-turn research contract must carry requested source families through authorization, tool visibility, execution, evidence receipts, trace, citations, and answer-quality verification so a downstream module cannot silently remove or misreport requested research.

## Scope

- Own the typed contract for FMDS, meeting, email, Teams, and OneDrive research.
- Replace the AAI-1244 FMDS-specific communication exception with projections from the shared contract.
- Preserve FMDS revision isolation: communication evidence may support operating/process findings, never FMDS engineering conclusions.
- Persist explicit per-source requested/available/attempted/outcome evidence in the Chat turn.
- Exclude write/delivery actions and Microsoft operator workflows; the specialist remains an optional analysis/operator adapter.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` and the retrieval modules under `frontend/src/lib/ai/retrieval/`
- Existing shared primitives/services: `RetrievalPlan`, `RetrievalContext`, `createStrategistTools`, registered source readers, and `ChatHistoryWriter`
- Deprecated or parallel paths: `detectCommunicationResearchSources`, `FMDS_COMMUNICATION_TOOL_NAMES`, `includeMicrosoftSourceReadTools`, and prompt-local tool-name reconstruction

Verification contract: Required

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.
- [x] A mixed FMDS/process prompt executes meetings, email, Teams, and FMDS research without a specialist quota dependency.
- [x] The Chat turn records a typed receipt for every requested research source.
- [x] A missing, denied, timed-out, or failed requested source prevents a full-coverage claim.
- [x] The exact mixed-source prompt completes the primary meetings receipt without relying on a later model retry.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.
- [x] Root `CONTEXT.md` defines the Chat-turn research contract and Research receipt.
- [x] ADR-0003 records the FMDS mixed-research amendment and specialist separation.
- [x] Recurring-failure fingerprint blocks reintroduction of distributed source policy.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a typed Research receipt outcome naming the requested source and `unavailable`, `denied`, `timed_out`, or `failed` state
- Detection path: focused contract tests, persisted Chat-turn metadata, live tool trace, and authenticated `/ai` result
- Recovery path: restore the named adapter/authorization/provider path and rerun the same Chat turn; never substitute another corpus silently

## Incident Learning

- Failure fingerprint: `ai.chat-research-contract-drift`
- Root cause: Requested source policy was independently reconstructed across planner, tool composition, FMDS filtering, prompt, trace, and citations.
- Detection gap: Tests proved each shallow module separately but did not assert one requested-source contract survived the entire Chat turn.
- Prevention: One typed contract and receipt projection, plus an architecture test that rejects duplicated source/tool maps.
- Guardrail evidence: contract tests cover exact-question preservation, query-count-scaled bounded budgets, merged evidence, and resolved-reader hiding; authenticated Chat row `b1950010-c9e7-49f7-bb41-f27aacf43d56` proves primary meetings completion without a live retry.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1248 | Pass | Scope and done gate captured before implementation. |
| Runtime localization | AAI-1244 live trace and 2026-07-22 architecture review | Pass | Planner requested communications; downstream tool visibility removed them and the specialist later failed on provider credit. |
| Learning lookup | `node scripts/ops/learning-registry.mjs lookup ...` | Pass | Related collection and persistence fingerprints exist; this source-policy drift needs its own fingerprint. |
| Focused tests | `cd frontend && pnpm exec jest --runInBand --runTestsByPath ...` | Pass | 6 suites, 126 tests; includes contract survival, retry reconciliation, fail-closed coverage, and fair citation allocation. |
| Targeted lint | `cd frontend && pnpm exec eslint <task-owned TS paths>` | Pass | No lint findings. |
| Changed-code type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` debt. |
| Source-specific architecture guard | `npm run rag:verify:source-specific` | Pass | Source-specific routing remains intact. |
| Authenticated runtime | `agent-browser` on `http://localhost:3000/ai` | Pass | Same mixed prompt executed FMDS, meeting, email, and Teams reads without the Microsoft specialist. Final run failed meetings loudly and separated operating evidence from FMDS engineering authority. |
| Persistence readback | Chat row `c9993b6c-8c0d-4314-8b24-bb919a9bbb5d` | Pass | Ordered receipts: FMDS complete, meetings timed_out, email complete, Teams complete; `research_coverage_complete=false`. |
| Citation readback | Same Chat row `sources` | Pass | Global 12-source budget is round-robin: FMDS, email, and Teams all persist; a high-volume early source cannot crowd out later requested evidence. |
| Final screenshot | `docs/ops/evidence/2026-07-22-aai-1248-chat-turn-research-contract/screenshot-final.png` | Pass | Canonical `/ai` outcome from the published revision; Linear attachment `98eb2582-1749-4367-8003-69e085953931`. |
| Full frontend typecheck | `cd frontend && npm run typecheck` | Known unrelated debt | Repo-wide failure includes pre-existing errors in `handler-v2.ts`, `executor.ts`, and many unrelated modules. No errors in the new contract or its tests; changed-code guard passes. |
| Broad chat architecture guard | `npm run rag:verify:chat-architecture` | Known unrelated debt | Existing failures cover registry-derived approval/resume rules, legacy `needsApproval`, and Ask Alleato visibility; not introduced by AAI-1248. |
| Independent review | `independent-review.md` | Pass after rework | Reviewer caught message-shaped meeting denials being classified as empty; exact contract fix and regression assertion were added, then re-review approved. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ...` | Pass | Declared claims are supported by screenshot, database readback, regression tests, and independent review. |
| Publication | commit `7af007a6e0afc7157b597cd1eb626664da1afff5` | Pass | Pushed to `origin/main`; local `HEAD` and `origin/main` read back equal. `codex:finish` commit succeeded but its duplicate lint/publisher paths cannot process deleted files, so targeted checks plus the verification contract were used and an explicit push completed publication. |
| Timeout localization | Last four mixed-source Chat rows | Fail detected | Three primary meeting receipts stopped at 3002–3019 ms against the executor's universal 3000 ms ceiling; the fourth succeeded only through a later live-tool retry with six results. |
| Source-specific timeout tests | Focused Jest | Pass | Per-query budgets are source-specific and the bounded aggregate scales with required query count; the exact question plus three recovery aliases own 48 seconds for meetings instead of inheriting a universal ceiling. |
| Reopened authenticated runtime | `agent-browser` on `http://localhost:3000/ai` | Pass | Exact prompt completed primary meetings, email, and Teams retrieval and rendered a process map from their evidence. |
| Reopened persistence readback | Chat row `f8ec6e63-4b29-4650-b219-6fb36b61477f` | Pass | Primary receipts: meetings `complete` in 29454 ms with 6 items; email `complete` in 2280 ms with 7; Teams `complete` in 6118 ms with 3. No later live retry of those readers appears in the trace. |
| Reopened screenshot | `docs/ops/evidence/2026-07-22-aai-1248-chat-turn-research-contract/exact-prompt-meetings-evidence.png` | Pass | Canonical `/ai` view shows the Alleato ASRS process map and meeting/email evidence from the exact prompt. |
| Exact-question authenticated runtime | `agent-browser` on `http://localhost:3000/ai` | Pass | Corrected contract searched the user's exact question plus recovery aliases and rendered a process map from named meeting/email/Teams evidence. |
| Exact-question persistence readback | Chat row `b1950010-c9e7-49f7-bb41-f27aacf43d56` | Pass | Primary receipts: meetings `complete` in 37939 ms with 6 items; email `complete` in 4246 ms with 13; Teams `complete` in 8978 ms with 9. Trace contains no later live communication-reader retry. |
| Exact-question screenshot | `docs/ops/evidence/2026-07-22-aai-1248-chat-turn-research-contract/exact-question-final.png` | Pass | Canonical `/ai` view shows the final process map and named meeting transcript evidence. |
| Reopened independent review | `aai_1248_independent_review` | Pass | Approved after requiring preservation of the user's exact question ahead of recovery aliases. |
| Screenshot attachment | Linear attachment `381bddcd-946e-4ca3-83fa-484307e5ea9a` | Pass | Viewable exact-question proof attached to AAI-1248. |

## Remaining Risk

- The canonical checkout contains unrelated active ASRS/table work. Exact-path lease and exact-file publication are mandatory.
- Full frontend typecheck and the broad chat-architecture gate still carry unrelated baseline debt named above; AAI-1248 adds no new changed-code error.
- The earlier mixed run reported FMDS candidates from a different revision because tables and figures independently selected their own latest corpus. The adapter now passes the selected vector-search revision ID into both structured-evidence loaders.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.

FMDS pinning verification: the authenticated FMDS-only request persisted Chat row `a14edd0e-f98a-43d6-b736-28827b42c408` with `complete`, 8 evidence items, 1778 ms, and `research_coverage_complete=true`. The rendered answer cites FMDS0834 rev. 2026-04. Screenshot: `docs/ops/evidence/2026-07-22-aai-1248-chat-turn-research-contract/fmds-revision-pinned-final.png`.
