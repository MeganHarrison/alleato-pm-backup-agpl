# Task: Submittal Workflow Email Settings Gate

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Objective

Respect project-level submittal email notification settings when sending workflow handoff emails.

## Done Checklist

- [x] Existing submittal settings contract reviewed.
- [x] Workflow handoff email skips when `email_notify_submittal_updated` is false.
- [x] Missing settings row defaults to sending, matching the settings API defaults.
- [x] Settings lookup failures fail visibly in the returned email status and history.
- [x] Focused tests/static checks pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Focused service tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/submittals/__tests__/workflow-response-service.test.ts` | PASS | 1 suite, 8 tests passed. |
| Focused lint | `cd frontend && npx eslint --quiet src/lib/submittals/workflow-response-service.ts src/lib/submittals/__tests__/workflow-response-service.test.ts` | PASS | Touched service/test files lint clean. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 2 changed routes passed structured error handling guard. |

## Risks / Gaps

- This only gates workflow handoff email. The existing distribution endpoint still needs a separate settings pass if distribution emails should respect `email_notify_submittal_distributed`.
- Existing unrelated unstaged checkout dirt remains outside this task and is not owned by this work.
