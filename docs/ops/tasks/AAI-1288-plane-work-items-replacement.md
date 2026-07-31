# Task: Plane-derived Work Items replacement

Status: In Progress
Owner: Codex
Created: 2026-07-30
Task ID: AAI-1288-REPLACEMENT
Linear Issue: AAI-1288 (scope corrected by user)
Related Handoff: N/A

## Objective

Ship a reusable Work Items replacement surface directly derived from Plane's
project issue templates, connected to Alleato's live Tasks APIs, while leaving
the old Tasks route intact until the replacement is accepted. The shared Plane
dispatcher owns the canonical `/[projectId]/plane/work-items` route.

## Scope

- Reusable `PlaneWorkItemsPage` feature for the shared
  `/[projectId]/plane/work-items` dispatcher, with Plane-derived
  shell/list/board/detail patterns, live task reads/create/status updates, AGPL
  notices, and source offer.
- Excludes modification or retirement of `/[projectId]/tasks`, RAG Project
  Intelligence, schema, and production data migration.

## Source of Truth

- Canonical runtime/data owner: `/api/tasks` and `/api/tasks/[taskId]`
- Plane template owner: `makeplane/plane` revision `39856932cd6b9bd17eab0920506d628190b47af2` (v1.4.0-rc1-11) project sidebar, command search, issue filters, analytics modal, mobile header, and issue layouts
- Existing shared services: `apiFetch`, Tasks API guardrails
- Dispatcher import: `@/features/plane-work-items/plane-work-items-page`
- Dispatcher export: `PlaneWorkItemsPage`
- Source-offer import: `@/features/plane-license/source-offer-page`
- Source-offer export: `PlaneSourceOfferPage`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] Shared dispatcher route visually matches Plane at desktop and mobile widths.
- [x] Live project tasks load from the existing Supabase-backed API.
- [ ] Inline creation and status update work and fail loudly.
- [x] List, board, and detail peek preserve the Plane interaction model.
- [x] Existing Tasks page remains unchanged.
- [ ] Copied files preserve notices and the deployed app prominently offers exact corresponding source.
- [ ] Side-by-side Plane/Alleato screenshots and visual-difference report are recorded.

## Failure-Loudly Contract

- Cause surfaced as: specific authenticated Tasks API error with retry or mutation rollback.
- Detection path: authenticated local browser flow and production readback.
- Recovery path: retry the read or correct and repeat the failed mutation without losing the current surface.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Corrected replacement and dispatcher scope captured before integration. |
| Targeted lint | `npx eslint ... --quiet` | Pass | Plane-derived feature, model/test, and source-offer page have no lint errors. |
| Presentation model | `npx jest --runInBand --runTestsByPath src/features/plane-work-items/plane-work-items-model.unit.test.ts` | Pass | 10/10 state, label, title, and identifier cases passed. |
| Command/display/analytics guards | Focused Jest over the Work Items page, controls, model, and shell unit tests | Pass | 4 suites / 16 tests cover production control rendering, command filtering, exact search copy, corresponding-source command, live analytics summaries, display property contract, presentation mapping, and full-shell guard. |
| Live authenticated read | `http://localhost:3021/31/work-items` (temporary pre-dispatcher harness) | Pass | Loaded 234 project tasks through `GET /api/tasks?project_id=31&scope=all`; the temporary wrapper was removed before commit so central integration can own `/31/plane/work-items`. |
| List desktop | `evidence/AAI-1288-plane-work-items/work-items-desktop.png` | Pass | Full Plane-style shell and live work-item rows at 1414x910. |
| Board desktop | `evidence/AAI-1288-plane-work-items/work-items-board-desktop.png` | Superseded visual | Proves the same 234 live tasks rendered in status columns, but the historical capture still exposes a narrow host-shell strip. The current portal/inert isolation fix must receive a fresh dispatcher-route capture in the central batch. |
| List mobile | `evidence/AAI-1288-plane-work-items/work-items-mobile.png` | Pass | Compact header and live rows at 390x844. |
| Detail interaction | Browser click on first live work item | Pass | Opened the non-destructive right-side work-item detail peek. |
| Upstream live comparison | Hostinger Plane issues URL | Blocked | Plane reference session returned 401; the user-provided authenticated screenshot remains the desktop target. |
| Mutation verification | Create/status update against live API | Deferred | Not executed because it would change production-backed task data without explicit approval. |
| Independent review | Read-only `pr_explorer` review | Pass after fixes | Calendar/filter controls are functional and accessible; the feature is isolated from the host shell. |
| Final screenshot attempt | Authenticated Playwright against the temporary harness | Blocked by local runtime pressure | The expired test JWT was refreshed without changing users/tasks, but the workspace dev server was terminated during route compilation (`ERR_CONNECTION_RESET`) while six parallel page builds were active. Existing screenshots remain current evidence; central integration will batch fresh captures on the shared dispatcher. |

## Visual Difference Report

- Matched: 250px project sidebar, compact command bar, project/work-item breadcrumb,
  view controls, thin row dividers, status controls, assignee/date metadata, list
  density, board columns, and right-side detail interaction.
- Intentional data differences: Alleato displays the selected live project and 234
  real tasks; the reference screenshot displays Plane's AI Implementation project
  with one sample task.
- Remaining proof gap: a fresh authenticated Plane mobile capture is unavailable
  because the reference session is signed out. Mobile was validated against the
  same copied template behavior and the supplied desktop reference.

## Direct Plane Source Fidelity Audit

Compared directly against Plane revision
`39856932cd6b9bd17eab0920506d628190b47af2`:

- `apps/web/app/(all)/[workspaceSlug]/(projects)/sidebar.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/extended-project-sidebar.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/layout.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/mobile-header.tsx`
- `apps/web/ce/components/issues/header.tsx`
- `apps/web/ce/components/issues/quick-add/root.tsx`
- `apps/web/core/components/issues/filters.tsx`
- `apps/web/core/components/issues/issue-layouts/list/default.tsx`
- `apps/web/core/components/issues/issue-layouts/list/list-group.tsx`
- `apps/web/core/components/issues/issue-layouts/list/block.tsx`
- `apps/web/core/components/issues/issue-layouts/quick-add/form/list.tsx`
- `apps/web/core/components/issues/issue-layouts/quick-add/button/list.tsx`
- `apps/web/core/components/issues/issue-layouts/kanban/default.tsx`
- `apps/web/core/components/issues/issue-layouts/kanban/kanban-group.tsx`
- `apps/web/core/components/issues/issue-layouts/kanban/block.tsx`
- `apps/web/core/components/issues/peek-overview/header.tsx`
- `apps/web/core/components/navigation/top-nav-power-k.tsx`

Gaps closed without schema changes:

- Restored Plane's five desktop layout controls: list, kanban, calendar,
  spreadsheet, and Gantt. Calendar no longer incorrectly navigates to Cycles.
- Added the Plane mobile layout/display/analytics control strip.
- Replaced task-text filtering in the top bar with Plane's command-palette copy,
  Ctrl/Cmd+K shortcut, command filtering, Enter/Escape behavior, project
  surface navigation, and corresponding-source command.
- Replaced placeholder desktop/mobile Display buttons with a shared dropdown
  that changes the real status filter and assignee, due-date, and priority
  visibility.
- Replaced the analytics toast/placeholder with one shared desktop/mobile modal
  derived from live task state and showing state distribution, total,
  unassigned, and overdue work.
- Matched Plane quick-add open/focus, Enter submit, Escape close, and empty blur
  close behavior in list and status-scoped kanban columns.
- Added kanban identifiers, due-date/property metadata, per-column quick add, and
  status-column drag/drop using the existing authenticated task mutation.
- Added peek-header close, copy-link, and quick-action affordances while
  retaining the existing status mutation and rollback behavior.

Remaining adapter gaps:

- Plane bulk selection, drag reordering within one state, sub-groups, and
  pagination require corresponding Tasks API contracts that do not exist yet.
- Calendar and Gantt adapt existing `due_date`/`created_at` fields; they do not
  provide Plane's full scheduling engine.
- Display settings are route-local because Alleato does not yet expose Plane's
  persisted per-user issue-display preference contract.

## Remaining Risk

- Production deployment is blocked until the public corresponding-source repository exists and matches the deployed revision.
- The visible Source code footer and command remain an intentional AGPL
  compliance delta from Plane's screenshot. They must stay prominent even
  though this is a minor pixel-parity difference.
- Fresh dispatcher-route captures must be batched after central integration because
  the isolated dev server was killed during compilation under concurrent runtime
  pressure. This did not change product code or production data.
