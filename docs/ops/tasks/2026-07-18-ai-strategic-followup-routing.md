# Task: Preserve Conversational AI Follow-Ups

Status: In Progress
Owner: Codex
Created: 2026-07-18
Task ID: AI-CHAT-FOLLOWUP-2026-07-18
Linear Issue: Unavailable: no Linear connector is exposed in this session.
Related Handoff: `docs/ops/handoffs/2026-07-18-S185-ai-strategic-followup-routing.md`

## Objective

Strategic AI-chat follow-ups retain their prior conversational context instead
of restarting the Render executive workflow or returning an inbox dump.

## Scope

- `frontend/src/lib/ai/retrieval/planner.ts`: canonical retrieval routing.
- `frontend/src/lib/ai/deep-agent-bridge.ts`: bounded specialist bridge policy.
- Chat handler and focused regression tests.
- Excludes redesigning the chat UI and changing Outlook source data.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`.
- Shared routing/bridge owners: `frontend/src/lib/ai/retrieval/planner.ts` and
  `frontend/src/lib/ai/deep-agent-bridge.ts`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] A prompt beginning "Based on that" stays on the conversational seam.
- [x] A conversational follow-up does not launch a new executive bridge run.
- [x] Live Outlook follow-up returns evidence-qualified strategic guidance.
- [x] Specialist bridge cannot hold a chat stream longer than 45 seconds.

## Implementation Checklist

- [x] Planner and bridge owner modules are changed directly.
- [x] Regression tests cover history-present and history-missing follow-ups.
- [x] The executive bridge requires the explicit broad-operator plan reason.
- [x] Timeout recovery is bounded and retains the existing local fallback path.

## Integration and Verification

- [x] Focused planner and bridge unit tests pass (82 assertions).
- [x] Isolated authenticated browser flow proves inbox triage and strategic follow-up.
- [x] Screenshot and transcript artifacts are recorded in the handoff.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a bounded deep-agent timeout returns control to the existing
  local source-backed response path instead of holding the chat stream open.
- Detection path: live browser flow, Render request timing, and focused routing tests.
- Recovery path: use the conversational specialist path; investigate Render only
  if an explicitly broad first-turn executive question exceeds the 45-second cap.

## Incident Learning

- Failure fingerprint: `N/A` (existing shared learning registry has unrelated edits).
- Root cause: follow-up planning was evaluated after broad executive intent, and
  the handler could reselect the executive bridge from intent alone. A first
  production patch still left broad executive detection ahead of the follow-up
  check; the deployed two-turn test caught that ordering defect.
- Detection gap: prior testing covered a first-turn inbox request but not its
  exact strategic continuation on the deployed route.
- Prevention: the exact deployed wording now has a regression test and the
  planner evaluates outbound/follow-up paths before broad executive detection.
- Guardrail evidence: focused unit suite plus isolated browser transcript.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Unit routing | `npm run test:unit -- --runInBand --runTestsByPath src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/__tests__/deep-agent-bridge.test.ts` | Pass | 2 suites, 82 tests. |
| Lint and patch shape | focused ESLint + `git diff --check` | Pass | No static errors. |
| Live user flow | `docs/ops/evidence/2026-07-18-ai-strategic-followup-routing/strategic-followup.png` | Pass | Authenticated two-turn Outlook strategy flow; no Render executive wait state. |
| Render diagnosis | `/api/intelligence/research` returned 499 at 44.8 seconds | Observed | Prior live failure localized to the executive bridge path. |
| Production regression | `https://projects.alleatogroup.com/ai` two-turn flow | Failed then fixed | First deploy still reached Render; ordering correction is pending this follow-up deploy. |

## Remaining Risk

- The first inbox answer and its fresh live follow-up can disagree when Outlook
  data changes between reads. The chat now says so rather than fabricating
  certainty; source-snapshot consistency is a separate product decision.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
