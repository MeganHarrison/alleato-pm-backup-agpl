# Task: Submittal Distribution Email Settings Gate

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Objective

Respect `email_notify_submittal_distributed` when distributing a submittal so project settings control outbound distribution emails.

## Done Checklist

- [x] Existing distribution endpoint and settings contract reviewed.
- [x] Distribution endpoint reads project submittal email settings.
- [x] Distribution still records the distribution and recipients when emails are disabled.
- [x] No-valid-email failure only applies when distribution emails are enabled.
- [x] Focused helper tests/static checks pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Focused helper tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/submittals/__tests__/distribution-email-settings.test.ts` | PASS | 1 suite, 3 tests passed. |
| Focused lint | `cd frontend && npx eslint --quiet src/lib/submittals/distribution-email-settings.ts src/lib/submittals/__tests__/distribution-email-settings.test.ts 'src/app/api/projects/[projectId]/submittals/[submittalId]/distribute/route.ts'` | PASS | Touched helper, test, and route lint clean. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 3 changed routes passed structured error handling guard. |

## Risks / Gaps

- This does not add a full route integration test for distribution. The route currently lacks a test harness; this slice adds a focused settings helper guard plus lint/type/route checks.
- Existing unrelated unstaged checkout dirt remains outside this task and is not owned by this work.
