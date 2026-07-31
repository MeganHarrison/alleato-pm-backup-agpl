# Task: Shared Record-Detail Template Migration

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1109
Linear Issue: [Migrate punch-item detail to the shared record-detail template](https://linear.app/megankharrison/issue/AAI-1109/migrate-punch-item-detail-to-the-shared-record-detail-template)
Related Handoff: `docs/ops/handoffs/2026-07-16-S157-shared-record-detail-template.md`

## Objective

Establish one canonical record-detail template owner, migrate the hand-rolled punch-item detail route to it, and prove template-level changes are inherited by every adopting route.

## Confirmed Design Brief

- Primary user: project manager closing or coordinating a punch item under time pressure.
- Primary job: see the current record state, ownership, due date, and next valid action, then act without parsing a database-field dump.
- Primary decision: which lifecycle action or edit is needed now.
- Visual direction: restrained, quiet Alleato product UI in the existing application shell.
- Required outcome: one shared template/component owns detail layout, property presentation, and action placement; routes supply record data and behavior only.
- Anti-goals: route-local page shells, metadata grids, action bars, or styling that can drift from sibling detail pages.
- Image gate: skipped. This is a migration to an existing canonical application pattern, not an open-ended visual direction problem.

## Scope

- Locate the current reusable record-detail primitives and the canonical sibling reference.
- Make the shared template the owner of the common detail-page structure.
- Migrate the punch-item detail route without preserving its local layout reimplementation.
- Add explicit query and mutation failure recovery.
- Add a regression test proving template consumers inherit the shared structure.
- Capture browser evidence on the exact punch-item route once authenticated access is available.

## Acceptance Criteria

- [x] A named shared record-detail template owns the common shell, primary action placement, property presentation, and progressive disclosure boundary.
- [x] The punch-item detail route contains domain data/actions only, not page-local detail layout primitives.
- [x] At least one additional existing detail route adopts the same template, or evidence records why no sibling is compatible.
- [x] Query and lifecycle-update errors are distinct, specific, and recoverable.
- [x] A regression test fails if a consumer bypasses the shared template contract.
- [x] Targeted checks pass.
- [x] Independent review and exact-route desktop/mobile screenshot evidence are attached.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: detail query or lifecycle mutation failure.
- Detection path: explicit retryable UI state plus mutation error feedback, and a shared-template contract test.
- Recovery path: retry the failed request or return to the canonical punch-list route; no failure may render as a missing record.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Created before implementation. |
| Orchestration claim | `docs/ops/orchestration/session-board.md` S157 | Pass | Single ownership scope claimed. |
| Linear kickoff | AAI-1109 | Pass | Issue created and active. |
| Focused contract test | `npm exec jest -- --runInBand --runTestsByPath src/components/layout/__tests__/record-detail-page.test.tsx` | Pass | 2 tests passed. |
| Changed-file lint | `npm exec eslint …` | Pass | Shared template, both consumers, and test lint clean. |
| Surface complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs …` | Pass | The template and both consumers meet the noise-gate checks. |
| Exact route, desktop | `shared-record-detail/punch-item-desktop.png` | Pass | Authenticated local render of `/1142/punch-list/a9e0139a-ceb1-4ace-b81c-28a27dd217cc`. |
| Exact route, mobile | `shared-record-detail/punch-item-mobile.png` | Pass | Same route at 390×844; no clipping or horizontal overflow observed. |
| Independent review | `/root/typecheck` re-review | Pass | Confirmed all direct-cost states use the template and both route consumers are protected from shell/property-bar bypasses. |
| Full frontend typecheck | `npm run typecheck` | Blocked by existing debt | 241 unrelated diagnostics; no diagnostics in the shared-template or punch/direct-cost owner files. |
| Scoped publish | `npm run codex:finish -- --staged-only --message "Standardize record detail template"` | Pass | Commit `294bca7ef5` pushed to `origin/main`; changed-file quality and route gates passed. |

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is started.
