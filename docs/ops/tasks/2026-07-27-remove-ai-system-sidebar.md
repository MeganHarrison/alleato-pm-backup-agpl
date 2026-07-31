# Task: Remove AI System From AI Dashboard Sidebar

Status: Complete
Owner: Codex
Created: 2026-07-27
Task ID: local-remove-ai-system-sidebar
Linear Issue: Unavailable; explicit user request
Related Handoff: N/A (single-session change)

## Objective

Remove the AI System navigation item from the AI dashboard sidebar while preserving its route and all other workspace navigation.

## Scope

- Shared AI dashboard workspace sidebar and its navigation regression test.
- Preserve `/ai-dashboard/ai-os` and `/ai-dashboard/company-brain` routes.

## Source of Truth

- Sidebar owner: `frontend/src/app/(main)/ai-dashboard/workspace-shell.tsx`

Delivery lane: Standard
Verification contract: Optional

## Acceptance Criteria

- [x] AI System is absent from desktop and mobile sidebar navigation.
- [x] Company Brain and remaining navigation items remain available.
- [x] `/ai-dashboard/ai-os` remains an intact route.
- [x] Route and changed-file quality checks pass; 6/7 focused workspace tests pass, with one unrelated existing responsive-padding assertion failing.
- [x] Task-owned files are published to `origin/main`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Route guard | `npm run check:routes` | Pass | No route conflicts. |
| Changed-file quality | `npm --prefix frontend run quality:changed` | Pass | No new lint/type/unsafe-pattern debt. |
| Focused test | `npx jest --runTestsByPath ...workspace-pages.test.tsx --runInBand --silent` | Partial | 6/7 pass; existing workspace canvas padding assertion is unrelated. |

## Remaining Risk

- Authenticated live sidebar proof remains after deployment if the public URLs redirect to login.
