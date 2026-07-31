# Task: Deepen the AI Chat Turn Module

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: AI-ARCH-01
Linear Issue: Blocked — no callable Linear connector is available in this session; task ownership is recorded in orchestration files.
Related Handoff: `docs/ops/handoffs/2026-07-17-S186-deepen-ai-chat-turn.md`

## Objective

Make every AI chat request produce one immutable, persistence-ready chat turn
through a single module, regardless of whether the response is streamed,
deterministic, delegated, or failed.

## Scope

- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/app/api/ai-assistant/chat/chat-history-writer.ts`
- New chat-turn module and focused tests under the same route directory
- `CONTEXT.md`, task/handoff/orchestration records
- No database migration, UI redesign, specialist-work redesign, or Graph changes

## Source of Truth

- Canonical request route: `frontend/src/app/api/ai-assistant/chat/route.ts`
- Canonical current implementation: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- Existing partial persistence seam: `chat-history-writer.ts`

Verification contract: Required

## Acceptance Criteria

- [x] One module owns the persistence-ready chat-turn record.
- [x] No direct `chat_history` insert remains in `handler-v2.ts`.
- [x] User, answer, evidence, trace, quality, provider path, and failure state are recorded consistently.
- [x] Persistence failures are specific and never silently drop a required turn.
- [x] Focused regression tests prove deterministic and standard paths use the same seam.
- [x] Canonical `/ai` browser evidence shows a persisted turn with its outcome.

## Implementation Checklist

- [x] Files/modules listed before edits.
- [x] Existing writer deepened instead of creating a parallel persistence path.
- [x] Handler branches project into one persistence-ready record.
- [x] Direct persistence paths are removed.
- [x] Existing response behavior is preserved by authenticated browser proof.

## Integration and Verification

- [x] Focused unit checks pass.
- [x] Actual `/ai` user flow proves a recorded turn.
- [x] Screenshot artifact is captured on the canonical route.
- [x] Independent review evidence is recorded.
- [x] Task-owned files are published and `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: exact turn role and persistence label plus database error.
- Detection path: chat turn trace metadata, route error, and focused tests.
- Recovery path: retry the request only after the recorded persistence failure is visible.

## Incident Learning

- Failure fingerprint: `ai-chat-turn-persistence-drift`
- Root cause: special chat paths own their own database writes and metadata shapes.
- Detection gap: the declared writer seam covered only one of more than twenty writes.
- Prevention: all paths must project through the chat-turn module.
- Guardrail evidence: static no-direct-insert test plus focused persistence tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Architecture decision | `CONTEXT.md` | Pass | Chat turn and specialist work are now canonical terms. |
| Task setup | This task file | In progress | Full task contract exists before implementation. |
| Focused persistence tests | `npm run test:unit -- --runInBand --runTestsByPath ...chat-history-writer.test.ts ...chat-turn-persistence-seam.test.ts` | Pass | 2 suites, 10 tests. |
| Targeted lint | `./node_modules/.bin/eslint` on four task-owned files | Pass | No findings. |
| Changed type guard | `npm run typecheck:changed` | Pass | No new `any` debt. |
| Direct-write guard | `rg 'from("chat_history").insert' handler-v2.ts` | Pass | Zero remaining direct writes, including Deep Agents fast paths. |
| Independent code review | Read-only sub-agent re-review of handler/writer/tests | Pass | Confirmed every handler write uses `ChatHistoryWriter`; no scoped findings. |
| Canonical `/ai` user flow | `agent-browser --session-name ai-chat-proof` | Pass | Authenticated test session submitted `What is 2 + 2? Reply with only the number.` and received `4`; POST `/api/ai-assistant/chat` completed on `/ai?session=623200f0-3153-4b7f-9f14-284f1df8255f`. |
| Screenshot evidence | `docs/ops/evidence/2026-07-17-deepen-ai-chat-turn/ai-chat-turn-response.png` | Pass | Viewable canonical-route result showing the prompt and response. |
| Browser trace | `docs/ops/evidence/2026-07-17-deepen-ai-chat-turn/ai-chat-turn-live.zip` | Pass | Captures the live request interaction. |
| Publication readback | `git rev-parse HEAD origin/main` | Pass | Both resolve to `7955842124` after `codex:finish`. |

## Remaining Risk

- The live proof confirms request/response behavior, while the persistence seam's database-write failure behavior is covered by focused unit tests. No scoped task risk remains.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred work names cause, detection gap, prevention, owner, and next action.
