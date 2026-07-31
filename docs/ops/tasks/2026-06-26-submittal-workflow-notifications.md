# Task: Submittal Workflow Handoff Notifications

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Objective

Create an inspectable in-app notification when a workflow response advances ball-in-court to the next responder, including AI Review-sourced workflow responses.

## Done Checklist

- [x] Existing notification infrastructure reviewed.
- [x] Notification owner chosen: `collaboration_notifications` via shared workflow response service.
- [x] Workflow response service creates a next-responder notification when a next pending responder exists.
- [x] Notification delivery result is returned to callers.
- [x] Notification failures are recorded in `submittal_history` instead of being silently swallowed.
- [x] Focused tests cover notification created, skipped, and failed states.
- [x] Targeted lint/type/tests pass.
- [x] Live DB proof captures a created notification or an explicitly inspectable failure state.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Focused lint | `cd frontend && npx eslint --quiet src/lib/submittals/workflow-response-service.ts src/lib/submittals/__tests__/workflow-response-service.test.ts` | PASS | Service and focused test lint clean. |
| Focused service/API tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/submittals/__tests__/workflow-response-service.test.ts 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/__tests__/route.test.ts'` | PASS | 2 suites, 6 tests passed. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 2 changed routes passed structured error handling guard. |
| Live notification proof | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... temporary two-step workflow handoff ... EOF` | PASS | Created and read notification `8d03f875-357b-44c4-a9bc-589dae7f6648` with `kind = submittal_workflow_action` and matching `metadata.eventKey`; temporary notification/steps/responses were removed. |
| Fixture cleanup proof | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... cleanup proof history and restore fixture ... EOF` | PASS | Deleted 1 temporary proof history row; fixture restored to `Open` with `ball_in_court = 283f156c-4528-4003-a215-6e5e5452fff8`. |

## Risks / Gaps

- This slice handles in-app collaboration notification only. External email delivery remains a separate follow-up because existing workflow response APIs currently return JSON only and submittal-specific email delivery is wired for distribution, not every workflow handoff.
- Live schema drift found: `submittal_workflow_steps.required` exists in some UI/test shapes but not in the remote schema cache. The notification proof avoided the field; a separate cleanup should reconcile UI assumptions with the database schema.
- Existing unrelated staged and unstaged checkout dirt remains outside this task and is not owned by this work.
