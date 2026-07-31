# Task: Submittal Notification Link Routing

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Objective

Make `submittal_workflow_action` notifications actionable by routing notification rows with `entity_type = submittal` to the real submittal detail URL.

## Done Checklist

- [x] Existing notification page link behavior reviewed.
- [x] Shared notification link resolver added.
- [x] Notifications page uses the resolver.
- [x] Unit tests cover submittal, known plural entity types, unknown entity fallback, and missing project fallback.
- [x] Focused lint/type/tests pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Focused unit test | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/collaboration/__tests__/notification-links.test.ts` | PASS | 1 suite, 4 tests passed. |
| Focused lint | `cd frontend && npx eslint --quiet 'src/app/(main)/notifications/page.tsx' src/lib/collaboration/notification-links.ts src/lib/collaboration/__tests__/notification-links.test.ts` | PASS | Touched files lint clean. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 2 changed routes passed structured error handling guard. |

## Risks / Gaps

- This does not redesign the notification page; it only fixes the broken route construction.
- Existing unrelated unstaged checkout dirt remains outside this task and is not owned by this work.
