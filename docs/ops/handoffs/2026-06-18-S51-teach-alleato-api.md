# Handoff: 2026-06-18 — Teach Alleato Intake API

## Intake Block

<!-- markdownlint-disable MD029 MD034 -->
1) Session ID: S51
2) Task ID: AAI-538
3) Linear issue: AAI-538
4) Linear URL: https://linear.app/megankharrison/issue/AAI-538/build-teach-alleato-intake-api
5) Current status: Accepted
6) Files changed (absolute paths):
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/ai-assistant/teach/route.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/ai-assistant/teach/__tests__/route.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/services/teach-alleato-intake-service.ts`
   - `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/services/__tests__/teach-alleato-intake-service.test.ts`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-18-S51-teach-alleato-api.md`
7) Commands run and outcome (pass/fail counts):
   - Pass: `sed -n '1,260p' AGENTS.md`
   - Pass: `sed -n '1,560p' docs/ai-plan/TASKS-AI.md`
   - Pass: read existing `ai_feedback_events` and `ai_learning_promotions` patterns in `frontend/src/lib/ai/services/feedback-event-service.ts`
   - Pass: read existing memory-feedback API pattern in `frontend/src/app/api/ai-assistant/memories/[memoryId]/feedback/route.ts`
   - Pass: read route-test pattern in `frontend/src/app/api/ai-assistant/email-draft-feedback/__tests__/route.test.ts`
   - Pass: `npm run test:unit -- --runTestsByPath src/lib/ai/services/__tests__/teach-alleato-intake-service.test.ts src/app/api/ai-assistant/teach/__tests__/route.test.ts --runInBand` (2 suites, 6 tests)
   - Pass: `npm run test:unit -- --runTestsByPath src/lib/ai/services/__tests__/teach-alleato-intake-service.test.ts src/app/api/ai-assistant/teach/__tests__/route.test.ts src/lib/ai/__tests__/learning-promotion-view-model.test.ts --runInBand` (3 suites, 11 tests)
   - Pass: `npx eslint src/app/api/ai-assistant/teach/route.ts src/app/api/ai-assistant/teach/__tests__/route.test.ts src/lib/ai/services/teach-alleato-intake-service.ts src/lib/ai/services/__tests__/teach-alleato-intake-service.test.ts`
   - Pass: `npm run check:routes`
   - Inconclusive: `npm run verify:changed-route-guardrails -- --files frontend/src/app/api/ai-assistant/teach/route.ts` returned `No changed API routes to validate` because the new route is untracked and the script appears to inspect git-tracked diffs.
   - Expected command mismatch: `npm test -- --runTestsByPath ...` failed because frontend `npm test` is Playwright, not Jest. Reran with `npm run test:unit`.
8) Evidence artifacts (screenshot/video/report/log paths):
   - Unit test output in terminal for the focused Jest command above.
   - Route conflict check output in terminal for `npm run check:routes`.
   - `tests/agent-browser-runs/2026-06-18-teach-alleato-integrated/02-teach-filter.png`
   - `tests/agent-browser-runs/2026-06-18-teach-alleato-integrated/03-teach-expanded.png`
9) Top 3 findings (frontend-visible issues first):
   - Teach Alleato now has an authenticated backend POST contract at `/api/ai-assistant/teach`; UI work can call it without direct table writes.
   - Intake creates one `ai_feedback_events` row, then stages a reviewable `ai_learning_promotions` candidate using existing promotion types before any future Skill Library schema exists.
   - If the event insert succeeds but candidate creation fails, the service throws `TeachAlleatoIntakePromotionError` with the created event id so the partial-write state is visible and recoverable.
10) Recommended next action (one line): Build the first-class Skill Library destination so approved workflow-rule candidates can become reusable skills.
11) Handoff file path: `docs/ops/handoffs/2026-06-18-S51-teach-alleato-api.md`
12) Migration ledger evidence: Not applicable; no migrations were created or changed.
<!-- markdownlint-enable MD029 MD034 -->

## Current Status

Accepted. The backend/API slice is implemented, covered by focused unit tests, and integrated with the S52/S53 UI/review slices. No migration was needed.

## Linear Updates

- Kickoff comment: Not posted by S51 per user instruction; Linear issue AAI-538 and URL are recorded in the intake block.
- Milestone comments: Not posted by S51 per user instruction.
- Completion/blocker comment: Posted acceptance summary to Linear comment `97988750-8a8b-425c-8f10-c524db376ae6`.

## Scope Completed

- Added authenticated `POST /api/ai-assistant/teach`.
- Added request validation for Phase 4 intake fields:
  - what Alleato should learn
  - scope
  - workflow category
  - examples
  - source/evidence link
  - upload ids
  - suggested reviewer
  - why it matters
  - perceived risk level
  - optional project/session/route metadata
- Added `submitTeachAlleatoIntake` service.
- Reused existing `recordAiFeedbackEvent` and `createLearningPromotion` writers.
- Classified candidates into existing promotion types first:
  - `user_preference` for personal intake
  - `project_lesson` for project-scoped intake with a project id
  - `agent_prevention_prompt` for correction/prevention style intake
  - `workflow_rule` as the default workflow/skill staging path
- Stored Skill Library-shaped candidate data in `proposed_learning.skillCandidate`.
- Added focused tests for success, missing required fields, auth, existing promotion-type classification, and promotion failure after event creation.

## Changed Files

- `frontend/src/app/api/ai-assistant/teach/route.ts`
- `frontend/src/app/api/ai-assistant/teach/__tests__/route.test.ts`
- `frontend/src/lib/ai/services/teach-alleato-intake-service.ts`
- `frontend/src/lib/ai/services/__tests__/teach-alleato-intake-service.test.ts`
- `docs/ops/handoffs/2026-06-18-S51-teach-alleato-api.md`

## Unrelated Dirty Files Observed

These were present in the checkout and were not edited by S51:

- `docs/ai-plan/TASKS-AI.md`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/ops/orchestration/session-board.md`
- `frontend/src/app/(admin)/ai-learning-promotions/promotions-client.tsx`
- `frontend/src/app/(main)/settings/memory/page.tsx`
- `frontend/src/components/ai-assistant/welcome-screen.tsx`
- `frontend/src/lib/ai/__tests__/learning-promotion-view-model.test.ts`
- `frontend/src/lib/ai/learning-promotion-view-model.ts`
- `scripts/jobplanner/import-prime-contract.mjs`
- untracked UI files under `frontend/src/app/(main)/ai-assistant/teach/`
- untracked UI component `frontend/src/components/ai-assistant/teach-alleato-intake.tsx`

## Risks And Blockers

- No blocker for this API/service slice.
- The changed-route guardrail script did not inspect the new untracked route; route conflict check, focused Jest, and targeted ESLint passed.
- The Skill Library schema does not exist yet, so candidates are intentionally staged in `ai_learning_promotions.proposed_learning.skillCandidate`.
- Candidate classification is deterministic and conservative, but future Skill Library work should replace the placeholder skill-candidate destination with the real table once schema lands.

## Suggested Linear Comment Body

```text
AAI-538 backend/API slice is ready for review.

Scope:
- Added authenticated POST /api/ai-assistant/teach.
- Added Teach Alleato intake service that writes ai_feedback_events and then stages ai_learning_promotions candidates.
- Reuses existing promotion types first: user_preference, project_lesson, agent_prevention_prompt, workflow_rule.
- Stores Skill Library-shaped payload under proposed_learning.skillCandidate until the Skill Library schema exists.
- Fails loudly with the created event id if promotion creation fails after event creation.

Files:
- frontend/src/app/api/ai-assistant/teach/route.ts
- frontend/src/app/api/ai-assistant/teach/__tests__/route.test.ts
- frontend/src/lib/ai/services/teach-alleato-intake-service.ts
- frontend/src/lib/ai/services/__tests__/teach-alleato-intake-service.test.ts
- docs/ops/handoffs/2026-06-18-S51-teach-alleato-api.md

Verification:
- PASS npm run test:unit -- --runTestsByPath src/lib/ai/services/__tests__/teach-alleato-intake-service.test.ts src/app/api/ai-assistant/teach/__tests__/route.test.ts --runInBand
- PASS npx eslint src/app/api/ai-assistant/teach/route.ts src/app/api/ai-assistant/teach/__tests__/route.test.ts src/lib/ai/services/teach-alleato-intake-service.ts src/lib/ai/services/__tests__/teach-alleato-intake-service.test.ts
- PASS npm run check:routes
- INCONCLUSIVE npm run verify:changed-route-guardrails -- --files frontend/src/app/api/ai-assistant/teach/route.ts returned "No changed API routes to validate" because the route is untracked.

Risks:
- Skill Library schema is not present; candidate payload is intentionally staged in ai_learning_promotions.
- UI wiring and browser verification remain next.
```

## Recommended Next Steps

1. Build the Skill Library schema and approval destination writer.
2. Add submitter-facing review status once the notification/status-back pattern is confirmed.
3. Replace the staged skill destination placeholder when the Skill Library schema lands.
