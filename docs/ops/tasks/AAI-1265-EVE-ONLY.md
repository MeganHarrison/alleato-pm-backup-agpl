# Task: Make Eve the Only AI Assistant Runtime

Status: Complete
Owner: Codex
Created: 2026-07-28
Task ID: AAI-1265-EVE-ONLY
Linear Issue: AAI-1265
Related Handoff: `docs/ops/handoffs/2026-07-28-S20260728-EVEONLY.md`

## Objective

The `/ai` assistant has one generation owner: `agents/alleato-assistant`. No
legacy multi-agent fallback, duplicate Eve implementation, rollback runtime, or
stale assistant route remains in the product source.

## Scope

- Canonical Eve agent, frontend proxy, durable turn persistence, tools, skills,
  assistant UI, local launcher, tests, and assistant architecture documentation.
- Remove the legacy chat generator, strategist/specialist agents, old Eve app
  expert lab, obsolete route namespace, stale generated frontend route entries,
  and duplicate local template/example repositories.
- Preserve separate backend automation agents that are demonstrably invoked by
  non-chat workflows; they are outside the interactive `/ai` generation path.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-assistant`
- Existing shared primitives/services:
  `frontend/src/lib/ai/assistant-turn`,
  `frontend/src/lib/ai/tools`,
  `frontend/src/app/api/ai-assistant/eve`
- Deprecated or parallel paths:
  `frontend/src/app/api/ai-assistant/chat`,
  `frontend/src/lib/ai/agents`,
  `frontend/src/lib/ai/orchestrator.ts`,
  `frontend/src/lib/ai/bot-core.ts`,
  `agents/app-expert-eve-lab`

Delivery lane: High-risk

Verification contract: Required

## Integration Contract

- Browser entry point: `GET /ai`.
- Runtime selection: none. `/ai` always instantiates `useEveAgent` through
  `POST/GET /api/ai-assistant/eve/proxy/**`.
- Durable state owner: `AssistantTurn`; Eve session state and app conversation
  state remain distinct.
- Tools: Eve fetches an authenticated request-scoped catalog from
  `/api/ai-assistant/eve/tools`. Existing read/write/delivery permission
  metadata remains authoritative.
- Errors: Eve startup, authentication, tool-catalog, stream, and persistence
  failures return structured actionable errors. No fallback runtime is allowed.
- Skills: the six executive Markdown skills under the canonical Eve agent are
  the only executive-specialist behavior used by `/ai`.

## Acceptance Criteria

- [x] `/ai` has no `eve | legacy` runtime assignment.
- [x] `/api/ai-assistant/chat` and the legacy generator are removed.
- [x] CFO, COO, CRO, CHRO, CMO, VPBD, and strategist runtime files are removed.
- [x] `bot-core.ts` and `orchestrator.ts` are removed or proven required by a
      non-assistant active owner and renamed away from assistant ownership.
- [x] Root Eve startup launches `agents/alleato-assistant`.
- [x] `agents/app-expert-eve-lab` is removed.
- [x] Old `/ai-assistant` pages are migrated to `/ai` or removed.
- [x] No source or generated route inventory advertises removed assistant paths.
- [x] No nested template/example repository remains in the canonical checkout.
- [x] A source guardrail fails if legacy assistant owners are reintroduced.
- [x] Real authenticated browser questions complete through Eve and evidence
      shows a real tool call and source-backed answer.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Provider, authentication, permission, and durable-stream contracts remain intact.

## Integration and Verification

- [x] Focused unit and contract tests pass.
- [x] Canonical Eve typecheck/build passes.
- [x] Frontend targeted compile/test boundary passes.
- [x] Agent-browser validates first message, follow-up, refresh/resume, and a
      real data-backed project-risk question.
- [x] Evidence artifacts are recorded.
- [x] Independent review finds no executable legacy assistant path.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a structured Eve/proxy/tool/persistence error naming the
  failed boundary.
- Detection path: focused tests, source guardrail, startup logs, and authenticated
  browser evidence.
- Recovery path: repair the canonical Eve boundary; never route to another
  generation runtime.

## Incident Learning

- Failure fingerprint: `eve-parallel-runtime-retention`
- Root cause: The prior migration added Eve as a canary while retaining the
  entire legacy execution graph and multiple launchers.
- Detection gap: Completion checks allowed fallback code and duplicate runtimes
  to remain reachable.
- Prevention: Add a source-level sole-runtime guardrail and browser proof that
  identifies the Eve turn and tool evidence.
- Guardrail evidence: `npm run verify:eve-only-runtime` passes and rejects every
  removed owner, route, runtime selector, canary namespace, and parity scaffold.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Atomic deletion contract recorded before edits. |
| Sole-runtime source guard | `npm run verify:eve-only-runtime` | Pass | One canonical generation owner; retired owners and comparison scaffolding absent. |
| Frontend focused tests | 11 Jest suites / 85 tests | Pass | Eve transport, proxy tools, durable turns, Ask Alleato, memory, feedback, handoffs, and middleware. |
| Runtime gates | `tsx --test frontend/src/lib/performance/__tests__/runtime-gates.test.ts` | Pass | 5/5. |
| Eve agent | `pnpm --dir agents/alleato-assistant typecheck` | Pass | Canonical Eve workspace compiles. |
| Eve contracts | Agent auth/tool tests plus protocol eval | Pass | 39 tests; 24 cases and 192 gates. |
| Tool registry | Focused registry tests and daily-brief verifier | Pass | 32 tests; verifier passed. |
| Browser first turn | `agent-browser --session eveonly` at `/ai` | Pass | Eve ran `Load_skill`, `Get Projects With Risks`, and `Get Portfolio Overview`; returned Nexcom and Test July 2026 with live contract/risk evidence. |
| Browser continuation | Same authenticated session | Pass | Follow-up correctly compared $65,000 and $24,050 and calculated $40,950 without a continuation precondition failure. |
| Browser persistence | Reload session `42295220-c9cf-4f45-9e6e-b29509cb00b0` | Pass | Both turns and tool-backed response restored after full reload. |
| Browser artifact | `docs/ops/tasks/evidence/AAI-1265-eve-risk-answer.png` | Pass | Full-page authenticated screenshot. |
| Published-main smoke | `docs/ops/tasks/evidence/AAI-1265-published-main-smoke.png` | Pass | Canonical `main` was restarted, authenticated, and returned live contract values through Eve for Nexcom and Test July 2026. |
| Ask Alleato cancellation | `docs/ops/tasks/evidence/AAI-1265-ask-alleato-stop.png` | Pass | A real in-flight Ask Alleato Eve request exposed Stop; stopping re-enabled the composer without reporting a completed turn. |
| Ask Alleato regression | Canonical Jest 30.2 runner; 2 suites / 9 tests | Pass | Covers identity, sole Eve transport, reconnect isolation, auth failure, and the live Stop action. |
| Independent review | Final reviewer re-review | Pass | No executable legacy owner remains; `/ai` and Ask Alleato resolve to Eve; ASRS confirmed as a separate active product. |
| Runtime logs | `%TEMP%\alleato-frontend-local.log` | Pass | Eve session 202, stream 200, two authenticated tool POSTs 200, message persistence POST 200. |
| Frontend full typecheck | `npm run typecheck` wrapper | Unrelated debt | Wrapper fails before TypeScript because it invokes Unix `rm` on Windows; direct full check exceeded the bounded verification window. Focused changed-boundary compilation/tests passed. |

## Remaining Risk

- ASRS remains a separate, actively used dedicated runtime at `/api/asrs/chat`;
  it is not an archived or alternate `/ai` generator.
- Another active isolated workspace owns `backend/src/services` and
  `docs/architecture/AI-RAG-ARCHITECTURE.md`; this task did not overlap those
  paths. The Eve-only architecture references owned by this task are current.

## Final Status

- [x] All required implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
