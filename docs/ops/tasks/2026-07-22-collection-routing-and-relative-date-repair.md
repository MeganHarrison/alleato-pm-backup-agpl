# Task: Repair Daily-Activity Collection Routing

Status: Ready to publish
Owner: Codex SROOT-COLLECTION-ROUTING-0722
Created: 2026-07-22
Task ID: AI-COLLECTION-ROUTING-0722
Linear Issue: Untracked production incident; no Linear issue requested
Related Handoff: N/A — single-session repair

## Objective

Keep broad daily-activity questions on the executive route rather than allowing the meeting-only collection planner to invent a relative-date filter.

## Scope

- `frontend/src/lib/ai/detect-rag-request.ts`
- `frontend/src/lib/ai/retrieval/collection-planner.ts`
- Focused regression coverage.

## Source of Truth

- Canonical runtime/data owner: AI chat retrieval planner and persisted `chat_history` trace receipts.
- Existing shared primitives/services: `isBroadTemporalCatchupQuestion`, `planRetrievalWithSemanticCollections`.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] A broad daily-activity question containing `yesterday` reaches the executive route.
- [x] The semantic meeting classifier is not called for that route.
- [x] Focused regression tests pass.
- [ ] Production deployment identity and repaired behavior are verified after publish.

## Failure-Loudly Contract

- Cause surfaced as: persisted retrieval-plan and tool-trace receipt.
- Detection path: focused unit test plus production chat trace read-back.
- Recovery path: preserve the authoritative executive route before semantic collection planning.

## Incident Learning

- Failure fingerprint: `ai.collection-analysis-source-free-fallback`
- Root cause: the daily catch-up detector omitted standalone `yesterday`, so the semantic meeting classifier replaced the intended executive route and supplied a model-invented historical date.
- Detection gap: route regression coverage omitted a standalone `yesterday` variant.
- Prevention: shared temporal detector now includes `yesterday`, and the collection boundary test asserts classifier non-invocation.
- Guardrail evidence: focused collection planner test suite.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production localization | `chat_history` receipt at 2026-07-22T13:05:51Z | Pass | Confirmed 1,938 enumerated, model date `2024-06-17`, zero candidates. |
| Focused regression | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/retrieval/__tests__/collection-planner.test.ts` | PASS | 10 tests passed. |
| Independent review | `docs/ops/evidence/2026-07-22-collection-routing-and-relative-date-repair/independent-review.md` | PASS | Approval after the source-lookup boundary was narrowed. |

## Remaining Risk

- The current Vercel production queue is saturated; verify the canonical alias after the repair reaches Ready.
