# Task: Unify Tasks List and Board

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: AAI-1287
Linear Issue: AAI-1287 - https://linear.app/megankharrison/issue/AAI-1287/unify-tasks-list-and-board-in-one-canonical-work-surface
Related Handoff: N/A - single-session Standard delivery

## Objective

Project users can use List or Board from the canonical Tasks route while preserving valid URL-backed view, search, filter, and sort state.

## Scope

- Canonical project Tasks list/board composition, task work-surface URL contract, task filters, and legacy kanban-route compatibility
- Focused state tests and authenticated desktop/mobile browser evidence
- Excludes task inspector behavior, task creation changes, board mutation changes, and application-sidebar changes owned by AAI-1288 through AAI-1291

## Source of Truth

- Canonical runtime/data owner: Existing Tasks inbox query and mutation boundary
- Existing shared primitives/services: `PageShell`, unified table state/page, task table configuration, and task board view
- Deprecated or parallel paths: Separate project Tasks kanban page composition

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The canonical project Tasks route offers List and Board with List as the safe default.
- [x] Valid view, search, status, assignee, priority, due-date, and sort state survives view changes and reloads.
- [x] Invalid URL state falls back safely.
- [x] Existing List and Board owners remain authoritative and use the same normalized task collection.
- [x] The separate kanban route resolves to the canonical Tasks board.
- [x] Keyboard access, responsive layout, and desktop/mobile evidence are verified.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned paths:

- Unified table URL-view normalization
- Tasks work-surface URL-state contract and focused tests
- Tasks inbox and filter configuration
- Legacy project Tasks kanban route
- This task record and evidence directory

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: Invalid URL state resolves to documented safe defaults; task loading failures retain the existing specific task failure messages.
- Detection path: Focused URL-state tests and authenticated Tasks browser journey.
- Recovery path: Use the canonical List/Board controls or clear invalid query values without losing other valid query state.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Focused URL-state contract tests and canonical-route redirect.
- Guardrail evidence: Pending

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused unit contract | `pnpm jest --runInBand --runTestsByPath src/features/tasks/__tests__/tasks-work-surface-state.test.ts` | Pass | 5 tests cover defaults, restoration, serialization, semantic view names, and shared filtering. |
| Targeted lint | `pnpm exec eslint` on the five task-owned source/test files | Pass | No diagnostics. |
| Route conflict guard | `bash -c "sed 's/\r$//' scripts/check-route-conflicts.sh \| bash"` | Pass | No dynamic route conflicts. The package wrapper fails on Windows because the tracked shell script has CRLF line endings. |
| Authenticated desktop List | `evidence/AAI-1287/tasks-list-desktop.png` | Pass | Seeded project 31, real task data, search plus status/priority/due/sort URL state. |
| Authenticated desktop Board | `evidence/AAI-1287/tasks-board-desktop.png` | Pass | Same canonical route and task collection in Board. |
| Authenticated mobile Board | `evidence/AAI-1287/tasks-board-mobile.png` | Pass | 390 x 844 viewport with actual task cards. |
| Authenticated mobile controls | `evidence/AAI-1287/tasks-board-mobile-settings.png` | Pass | Mobile settings exposes Board layout and active search/filter state. |
| View-state persistence | Browser readback | Pass | Switching List to Board preserved `scope`, `search`, `status`, `priority`, `due_from`, `due_to`, and `sort`. |
| Invalid state fallback | Browser readback | Pass | `view=split` rendered the canonical List table. |
| Legacy route | Browser readback | Pass | `/31/tasks/kanban` replaced to `/31/tasks?view=board`. |
| TypeScript | `node scripts/run-typecheck-bounded.mjs` | Timed out | No TypeScript diagnostics before the 300-second bound; existing whole-frontend typecheck performance debt. The supported npm wrapper also contains Unix-only cleanup commands on Windows. |
| Full frontend Jest | `pnpm jest --runInBand` | Unrelated failures | Existing failures in `ai-dashboard/__tests__/workspace-pages.test.tsx` (stale layout classes) and `lib/ai/tools/__tests__/action-tools.test.ts` (Supabase mock lacks `.in()`). No AAI-1287 file appeared in the failure output. |
| Standards review | Diff against `origin/main` | Pass after fixes | Replaced client spinner with server redirect; shared semantic List mode falls back to the canonical table renderer. |
| Acceptance review | Diff against AAI-1287 | Pass after fixes | Removed the stale list-renderer import after exposing accessible List/Board labels. |

## Remaining Risk

- The full frontend typecheck does not complete within the repository's five-minute bounded runner on this Windows checkout. The full Jest suite has unrelated AI-dashboard and AI-tool failures. Focused Jest, ESLint, route, review, and authenticated runtime boundaries pass.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
