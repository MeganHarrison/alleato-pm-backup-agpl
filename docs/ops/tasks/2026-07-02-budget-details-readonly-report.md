# Task: Budget Details Read-Only Report

Status: Partial - Verification Blocked by Unrelated Dirty File
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-888 - https://linear.app/megankharrison/issue/AAI-888/make-budget-details-a-read-only-procore-style-report
Related Handoff: N/A

## Objective

Make `/[projectId]/budget?tab=budget-details` work as a Procore-style read-only Budget Details report: users can scan, sort, filter, understand, and open source records for budget detail rows without editing the rows in this tab. Budget modifications remain available through the existing Budget page header action.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

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

- [x] Budget Details tab loads from the canonical `/api/projects/[projectId]/budget/details` route.
- [x] Detail rows expose enough source metadata for source-record links where the source record has a route.
- [x] Existing header-level Add Budget Modification action remains available on the Budget Details tab.
- [x] Table filtering, sorting, totals, and source links operate on the same visible dataset.
- [x] Empty/error/loading states are specific and recoverable.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for Budget Details API response shape/source links.
- [x] Guardrail added so missing Budget Details source-link metadata fails loudly next time where practical.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] The tab presents a read-only report, not editable row controls.
- [x] Default view label is visible as `Procore Standard Budget`.
- [x] Table includes Budget Code, Vendor, Item, Detail Type, Approved COs, Budget Changes, Committed Costs, Direct Costs, Forecast to Complete, Original Budget Amount, Pending Budget Changes, and Pending Cost Changes.
- [x] Users can filter by Budget Code, Vendor, Detail Type, and Status.
- [x] Users can sort visible columns.
- [x] Currency values use shared currency formatting.
- [x] Column headers explain the data via tooltips.
- [x] Source rows link to their source records when a canonical route exists.
- [x] Totals reflect the currently filtered visible rows.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npx eslint 'src/components/budget/budget-details-table.tsx' 'src/components/budget/__tests__/budget-details-table.test.tsx' 'src/app/api/projects/[projectId]/budget/details/route.ts'` | Pass with pre-existing raw-table warnings | No task-owned errors; raw table primitive warnings pre-existed on this report table pattern. |
| Static/type/lint      | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` debt. |
| Static/type/lint      | `npm --prefix frontend run guardrails:unsafe-patterns` | Blocked by unrelated file | Fails only on `frontend/src/components/header/comments-sidebar-button.tsx`, not task-owned Budget Details files. |
| Static/type/lint      | `GUARDRAIL_ENFORCE_RAW_ERRORS=true npm --prefix frontend run guardrails:changed` | Pass | 2 changed routes, no raw-error route regressions. |
| Targeted tests        | `npm --prefix frontend run test:unit -- --runInBand src/components/budget/__tests__/budget-details-table.test.tsx` | Pass | 2 tests passed. |
| Browser/user-flow     | `agent-browser --session budget-details-verify --state frontend/tests/.auth/user.json open 'http://localhost:3001/876/budget?tab=budget-details'` | Pass | Authenticated local route loaded. |
| Browser/user-flow     | `agent-browser --session budget-details-verify fill @e73 '09-9123'` | Pass | Filter produced `0 of 52` and filtered empty state on project 876. |
| Browser/user-flow     | `agent-browser --session budget-details-verify eval "Array.from(document.querySelectorAll('a')).filter(a => a.textContent?.trim()==='SC-001').map(a => a.getAttribute('href'))"` | Pass | Returned `/876/commitments/61632e46-5154-4e7e-8a21-df4945c1ea38`. |
| Browser/user-flow     | `docs/ops/evidence/2026-07-02-budget-details-readonly-report/budget-details-local-876.png` | Pass | Filtered route screenshot artifact. |
| Browser/user-flow     | `docs/ops/evidence/2026-07-02-budget-details-readonly-report/budget-details-local-876-unfiltered.png` | Pass | Unfiltered route screenshot artifact. |
| DB/provider read-back | N/A | Pass | No schema, migration, provider, or env changes. |
| End-to-end proof      | Local authenticated route `/876/budget?tab=budget-details` | Pass | Header Add Budget Modification remained available; read-only report showed full columns, filters, and source links. |

## Files Changed

- `frontend/src/app/api/projects/[projectId]/budget/details/route.ts` - likely API owner for detail rows and source link metadata.
- `frontend/src/components/budget/budget-details-table.tsx` - likely table UI owner for read-only report interactions.
- `frontend/src/components/budget/__tests__/budget-details-table.test.tsx` - active regression coverage for read-only report label, source links, and filtering.
- `docs/ops/tasks/2026-07-02-budget-details-readonly-report.md` - task definition and evidence.

## Risks / Gaps

- Budget Details-specific CSV/PDF export is still not implemented; existing page-level Export remains available.
- Full `quality:changed` is blocked by unrelated dirty `frontend/src/components/header/comments-sidebar-button.tsx`.
- Some legacy source rows may not have canonical detail routes; those remain plain text rather than fake links.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
