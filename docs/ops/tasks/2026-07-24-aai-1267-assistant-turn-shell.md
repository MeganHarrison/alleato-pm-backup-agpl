# Task: Salvage the narrow AssistantTurn shell

Status: Complete
Owner: Codex S20260724-aai-1267
Created: 2026-07-24
Task ID: AAI-1267
Linear Issue: AAI-1267
Related Handoff: isolated-session manifest for `S20260724-aai-1267 / AAI-1267`

## Objective

Route one authenticated, read-only Alleato AI turn through a durable,
provider-neutral lifecycle shell without moving generation, retrieval, tool
selection, or answer synthesis out of the existing production handler.

## Scope

- Durable acceptance, idempotency, observation, cancellation, and terminal state.
- The existing `/api/ai-assistant/chat` route and `handler-v2.ts` generation adapter.
- Explicitly excludes Workflow model loops, a parallel chat surface, atomic
  cutover, and legacy deletion.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- Existing shared primitives/services: `chat-history-writer.ts`,
  `conversationBelongsToSurface`, AI SDK UI-message stream response
- Deprecated or parallel paths: `origin/codex/durable-ai-chat-canary` is
  reference-only and must not be cherry-picked wholesale.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] One authenticated read-only request returns the existing AI SDK stream.
- [x] Duplicate accepted commands reuse one receipt and never rerun generation.
- [x] A disconnected client can observe the existing receipt without restarting.
- [x] Cancellation and terminal transitions are explicit and fail loudly.
- [x] History rows carry the durable turn identity.
- [x] No Workflow-owned model loop, parallel UI, atomic cutover, or legacy deletion.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared AssistantTurn abstraction owns lifecycle only.
- [x] Errors are specific and actionable.
- [x] Database, authentication, and stream contracts are handled.

## Integration and Verification

- [x] Focused unit and architecture tests pass.
- [x] Database migration ledger and row read-back pass.
- [x] Authenticated live request proves stream, running observation, explicit
  cancellation, duplicate suppression, and history.
- [x] Independent standards and spec reviews reach a fixed point.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: typed receipt state plus HTTP `401`, `404`, or `409`
- Detection path: public route tests, migration ledger, authenticated API smoke
- Recovery path: observe the receipt; retry only a failed/canceled turn with a
  new client message ID

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Acceptance and exclusions captured before implementation. |
| Supabase type generation | `npx supabase gen types ...` | Blocked, non-material | The configured access token lacks access to project `lgveqfnpkxvzbnnwuled`; the checked-in generated type already contains the unchanged `durable_ai_turns` row/insert/update contract. |
| Migration application | Atomic DDL plus `schema_migrations` ledger write | Pass | `20260724170000_harden_assistant_turn_shell` applied; status constraint and user read policy read back. |
| Migration ledger | `npm run db:migrations:verify-applied -- <migration>` for both versions | Pass | Both `20260722175451` and `20260724170000` present remotely. |
| Focused unit/API tests | Jest AssistantTurn, public route, receipt route, writer, boundary suites | Pass | 31 tests passed. |
| Live database contract | Jest `assistant-turn-persistence.contract.test.ts` | Pass | Concurrent duplicate, two linked history rows, completed and canceled read-back; 2 tests passed. |
| Architecture verifier | `node scripts/verify/verify_ai_chat_architecture.mjs` | Pass | Existing handler remains generation owner; shell owns lifecycle only. |
| Targeted lint | ESLint on every changed TS/TSX file | Pass | No errors or warnings. |
| Authenticated live API | Playwright `assistant-turn.api.spec.ts --project=chromium --no-deps` | Pass | 2 tests: successful AI SDK stream/idempotency/history and running observe/cancel terminal read-back. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ... --root . --require-pass` | Pass | Required manifest and result validate with all declared checks passing. |
| Bounded typecheck | `node scripts/run-typecheck-bounded.mjs` | Unrelated debt | No new errors in task-owned lines. Existing `handler-v2.ts` string `.message` errors and its pre-existing `RESOURCE_NOT_FOUND` code remain on `origin/main`; other repository errors also remain. |
| Response contract verifier | `node scripts/verify/verify_ai_assistant_response_contract.mjs` | Expected existing failure | It requires removing retrieval/tool planning from `handler-v2.ts`, which this ticket explicitly defers to preserve the current production generation owner. |

## Remaining Risk

- Cancellation makes the receipt terminal and prevents a late completion from
  overwriting it; the legacy in-flight provider call is not yet cross-instance
  interruptible.
- Supabase CLI type regeneration needs a token authorized for the legacy project;
  owner: platform administration. Detection is the project-scoped CLI command;
  prevention is a credential capability check before future schema work.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
