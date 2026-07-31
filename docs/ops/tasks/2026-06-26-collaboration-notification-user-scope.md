# Task: Collaboration Notification User Scope

Status: Complete
Owner: Codex
Created: 2026-06-26

## Objective

Ensure collaboration notification GET/PATCH operations only read or mutate notifications owned by the authenticated user.

## Done Checklist

- [x] Existing notification route reviewed.
- [x] GET notification list and unread count scope to `user_id`.
- [x] PATCH mark-read, mark-reviewed, mark-all-read, delete, and delete-all scope to `user_id`.
- [x] Focused route tests cover user scoping.
- [x] Targeted lint/type/route checks pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Unit test | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/app/api/collaboration/notifications/__tests__/route.test.ts` | Pass | Confirms GET list/count, mark-all-read, and mark-reviewed queries include authenticated `user_id`. |
| Lint | `cd frontend && npx eslint --quiet src/app/api/collaboration/notifications/route.ts src/app/api/collaboration/notifications/__tests__/route.test.ts` | Pass | Focused route and regression test lint. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt. |
| Route conflicts | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Route guardrails | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | Pass | Changed routes have structured handling and no raw errors. |

## Risks / Gaps

- This is not submittal-specific, but it directly protects the new submittal workflow notifications.
- Full project-wide typecheck/build was not run in the main thread; targeted checks covered the touched route and regression test.
