# Task: Production Meeting Agenda Export Fix

Status: Complete
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-921
Linear URL: https://linear.app/megankharrison/issue/AAI-921/fix-production-meeting-agenda-build-export-regression

## Objective

Restore the current `main` production deploy by fixing the missing `MeetingActionItemsSection` export used by the meeting agenda page.

## Root Cause

Vercel production deployment `dpl_EnVKUVpeG3xnTDQnXMN5icFoGHuk` built commit `3eeab0d` and failed because `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx` imports `MeetingActionItemsSection` from `frontend/src/components/domain/meetings/agenda-section.tsx`, but that module only exports `AgendaSection`.

## Acceptance Criteria

- [x] `MeetingActionItemsSection` exists at the imported module boundary.
- [x] The action-items section stays quiet and uses existing meeting detail data.
- [x] Focused tests cover the restored export behavior.
- [x] Focused lint/type/route guardrails pass.
- [x] Commit is pushed to `origin/main`.
- [x] Vercel production deploy for fixed `main` is Ready and assigned to `projects.alleatogroup.com`.
- [x] Meeting prep source-first behavior remains live on production.

## Implementation Checklist

- [x] Use clean worktree from current `origin/main`.
- [x] No schema or migration changes.
- [x] No new page-level visual container or duplicate CTA.
- [x] Failure and verification evidence posted to Linear.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Vercel failure | `vercel inspect dpl_EnVKUVpeG3xnTDQnXMN5icFoGHuk --logs` | Fail reproduced | Missing `MeetingActionItemsSection` export from `agenda-section.tsx`. |
| Focused unit test | `npm run test:unit -- --runInBand --runTestsByPath 'src/components/domain/meetings/__tests__/agenda-section.test.tsx'` | Pass | 6 tests passed, including restored action-items export behavior. |
| Targeted ESLint | `./node_modules/.bin/eslint 'src/components/domain/meetings/agenda-section.tsx' 'src/components/domain/meetings/__tests__/agenda-section.test.tsx'` | Pass | No ESLint errors for changed files. |
| Changed type debt guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Changed ESLint debt guard | `cd frontend && npm run lint:changed:debt` | Pass | No new ESLint debt detected across changed frontend files. |
| Route conflict guard | `npm run check:routes` | Pass | No route conflicts found. |
| Changed API route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | Pass | No changed API routes to validate. |
| Whitespace check | `git diff --check -- docs/ops/tasks/2026-07-04-production-meeting-agenda-export-fix.md frontend/src/components/domain/meetings/agenda-section.tsx frontend/src/components/domain/meetings/__tests__/agenda-section.test.tsx` | Pass | No whitespace errors. |
| Production build | `CI=true npm run build:production` | Pass | Build worker reported exit 0, compiled successfully, and restored non-production routes. |
| Clean production build | `rm -rf .next && CI=true npm run build:production` | Pass | Single foreground build compiled successfully and restored non-production routes. |
| Publish | `git push origin HEAD:main && git fetch origin main && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"` | Pass | Commit `829fe3a2f` pushed and verified as `origin/main`. |
| Linear update | Linear comment on `AAI-921` | Pass | Posted root cause, implementation, checks, pushed commit, and remaining Vercel verification. |
| Vercel deployment | `vercel inspect alleato-omepe2jue-meganharrisons-projects.vercel.app --scope meganharrisons-projects --wait --timeout 10m` | Pass | Deployment `dpl_8SdNB1iRr9KAxEV5hkAcaxeZ6iFU` reached Ready. |
| Production alias | `vercel inspect projects.alleatogroup.com --scope meganharrisons-projects` | Pass | `projects.alleatogroup.com` resolves to Ready deployment `dpl_8SdNB1iRr9KAxEV5hkAcaxeZ6iFU`. |
| Production auth setup | `PLAYWRIGHT_BASE_URL=https://projects.alleatogroup.com npx playwright test tests/auth.setup.ts --config=config/playwright/playwright.no-webserver.config.ts --project=chromium` | Pass | Fresh production-scoped auth session generated and verified against a protected route. |
| Live source-first prep API | `POST https://projects.alleatogroup.com/api/projects/760/meetings/prep-suggestions` with authenticated production cookie and `{"mode":"source"}` | Pass | HTTP 200, `generatedBy: "source"`, `model: null`, and 8 suggestions returned. |
