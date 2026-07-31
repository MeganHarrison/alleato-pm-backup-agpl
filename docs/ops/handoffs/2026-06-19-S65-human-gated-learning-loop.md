# Handoff: 2026-06-19 - Human-Gated Learning Loop

## Intake Block

1) Session ID: S65
2) Task ID: AAI-564
3) Linear issue: AAI-564
4) Linear URL: https://linear.app/megankharrison/issue/AAI-564/goal-7-g3-human-gated-learning-proposal-loop
5) Current status: Published to `origin/main` at `864d36f9f5b247a23571d82fe50f73d5f3922947`
6) Files changed (absolute paths):
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-19-human-gated-learning-loop.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-19-S65-human-gated-learning-loop.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/review-queue.md`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/learning-proposals/human-gated-learning.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/learning-proposals/__tests__/human-gated-learning.test.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/bot-core.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-RAG-ARCHITECTURE.md`
7) Commands run and outcome (pass/fail counts):
- PASS: Goal 7 document reviewed.
- PASS: Hermes references reviewed: `background_review.py`, `curator.py`, `memory_provider.py`.
- PASS: Alleato learning anchors reviewed: `ai_learning_promotions`, memory extraction, feedback-event service, Memory Center feedback, Skill Library feedback/apply path.
- PASS: `npm run linear:codex:check -- docs/ops/handoffs/2026-06-19-S65-human-gated-learning-loop.md`.
- PASS: `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/learning-proposals/__tests__/human-gated-learning.test.ts --runInBand`.
- PASS: `cd frontend && npm run quality:changed`.
- PASS: `npm run codex:finish -- --message "Add human-gated learning proposals" --files ...` published commit `864d36f9f5b247a23571d82fe50f73d5f3922947` and verified `HEAD == origin/main`.
8) Evidence artifacts (screenshot/video/report/log paths):
- Task evidence: `docs/ops/tasks/2026-06-19-human-gated-learning-loop.md`.
- Test proof: focused Jest learning proposal suite, 1 suite / 4 tests.
9) Top 3 findings (frontend-visible issues first):
- No user-facing UI is expected for this slice; it should reuse the existing human review queue.
- Goal 7 explicitly forbids copying Hermes daemon/threading; Alleato needs a Next/Render-native proposal job.
- No direct write to approved memory or skill stores is allowed in this slice.
10) Recommended next action (one line): Start Goal 7 G6 as the next separate high-risk slice.
11) Handoff file path: docs/ops/handoffs/2026-06-19-S65-human-gated-learning-loop.md
12) Migration ledger evidence: Not applicable unless implementation discovers a schema gap.

## Linear Updates

- Kickoff comment: 7c24280c-2767-4ff7-9987-39da3a18cf3f
- Milestone comments: 33075db1-01a7-43b1-88f1-ce3a852a8edf
- Completion/blocker comment: `715b81bf-a2a2-4f69-ad1c-c450e70d0e24`

## Current Status

Goal 7 G3 is published and verified as a proposal-only learning loop.
`frontend/src/lib/ai/learning-proposals/human-gated-learning.ts` owns the
default-off feature flag, recent chat-history inspection, AI SDK structured
candidate extraction, duplicate suppression, feedback-event source record,
promotion candidate creation, and response metadata update. `runPostResponseTasks`
calls it after existing memory tasks, and the normal streamed chat path passes
the AI SDK response message id so result metadata can attach to the saved
assistant row.

## Known Pitfalls

- Do not copy Hermes's daemon/threading model.
- Do not auto-promote memory or skill candidates.
- Do not create a parallel review queue if `ai_learning_promotions` already owns review.
- Do not stage unrelated local worktree dirt.
- If a migration is needed, apply it and verify the Supabase ledger before closeout.
- Existing direct memory extraction remains pre-existing behavior. This slice
  adds a separate proposal-only loop and should not be treated as replacing the
  older extractor until a future product decision explicitly changes that path.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
git status --short
npm run linear:codex:check -- docs/ops/handoffs/2026-06-19-S65-human-gated-learning-loop.md
cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/learning-proposals/__tests__/human-gated-learning.test.ts --runInBand
cd frontend && npm run quality:changed
```

## Evidence

- Goal 7 plan reviewed from `docs/ai-plan/hermes-openclaw-goals/goal-07-later-high-risk-work.md`.
- Linear kickoff comment posted to AAI-564.
- Source clone usage documented as REFERENCE/ADAPT in `docs/architecture/AI-RAG-ARCHITECTURE.md`; no Hermes daemon/threading model copied.
- Focused tests passed for default-off, proposal-only memory/skill destinations, duplicate skip, and persistence failure reporting.
- Changed-file quality passed.
- `codex:finish` published commit `864d36f9f5b247a23571d82fe50f73d5f3922947` and verified `HEAD == origin/main`.
