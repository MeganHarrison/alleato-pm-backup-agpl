# Task: Fix weekly progress report creation failure

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-974 https://linear.app/megankharrison/issue/AAI-974/weekly-progress-report-creation-fails-on-projectidprogress-reports
Related Handoff: None yet

## Objective

Make weekly progress report creation succeed from the canonical `/[projectId]/progress-reports` route so a user on project `876` can create this week's report without a silent or generic failure, with browser proof and a regression guardrail.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [ ] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | Not run            | Pending | Narrow Jest/API checks ran; no full lint/typecheck delegated yet. |
| Targeted tests        | `cd frontend && npx jest --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/progress-reports/__tests__/route.test.ts'` and `cd frontend && npx jest --runInBand --runTestsByPath 'src/app/(main)/[projectId]/progress-reports/[reportId]/__tests__/progress-report-editor.test.tsx'` | Pass | Added route guard contract coverage and detail error-state coverage. |
| Browser/user-flow     | Local browser attempt + route inspection | Blocked by local dev instability | Route-level browser closeout still needed after the dev server stops dropping `.next/routes-manifest.json`. |
| DB/provider read-back | Bearer-authenticated read-back on `/api/projects/876/progress-reports` and `/api/projects/876/progress-reports/3e04da87-983a-4e83-97f0-164fae263c38` | Pass | Both endpoints returned HTTP 200 after switching progress-report APIs to `getApiRouteUserFromRequest(request)`. |
| End-to-end proof      | Bearer POST create attempt plus DB row inspection | Partial | A fresh weekly row already exists for project `876` (`3e04da87-983a-4e83-97f0-164fae263c38`), but a final browser click-through proof is still outstanding. |

## Files Changed

- `docs/ops/tasks/2026-07-06-progress-report-weekly-create-failure.md` - task ledger and verification contract
- `frontend/src/app/api/projects/[projectId]/progress-reports/route.ts` - canonical create API owner under investigation
- `frontend/src/lib/progress-reports/server.ts` - draft creation runtime under investigation
- `frontend/src/app/(main)/[projectId]/progress-reports/progress-reports-client.tsx` - route action surface under investigation
- `frontend/src/hooks/use-progress-reports.ts` - client mutation path under investigation
- `frontend/src/app/api/projects/[projectId]/progress-reports/[reportId]/route.ts` - detail API now resolves bearer-authenticated users consistently
- `frontend/src/app/api/projects/[projectId]/progress-reports/[reportId]/email/route.ts` - email API now resolves bearer-authenticated users consistently
- `frontend/src/app/api/projects/[projectId]/progress-reports/[reportId]/ai-generate/route.ts` - AI generate API now resolves bearer-authenticated users consistently
- `frontend/src/app/api/progress-reports/route.ts` - global progress-report table API now resolves bearer-authenticated users consistently
- `frontend/src/app/(main)/[projectId]/progress-reports/[reportId]/progress-report-editor.tsx` - detail page now fails loudly instead of showing an endless skeleton
- `frontend/src/app/api/projects/[projectId]/progress-reports/__tests__/route.test.ts` - route guardrail coverage
- `frontend/src/app/(main)/[projectId]/progress-reports/[reportId]/__tests__/progress-report-editor.test.tsx` - editor error-state guardrail coverage

## Risks / Gaps

- Existing checkout is dirty in unrelated files; task-owned changes must stay isolated.
- Local `localhost:3001` was not running at task start, and later hit unrelated `.next/routes-manifest.json` cache instability during browser closeout.
- The exact browser create-click path is not fully re-proven yet; remaining risk is limited to route-level UX after the API now returns immediately and the detail page fails loudly.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
