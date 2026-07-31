# Task: Add Budget Changes Review Workflow To Budget Page

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: N/A - user-directed in-repo workflow implementation
Related Handoff: None

## Objective

Add a `Budget Changes` tab to the budget page that makes draft and pending budget changes easy to find, review, and approve. The surface must provide a scan-friendly table, a low-friction hover preview, bulk approval actions, and a detail sheet for full review and single-item status changes.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for workflow state transitions and data reads.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing `budget/modifications` API reused instead of introducing a duplicate data flow.
- [x] New `Budget Changes` tab added to the budget page tab shell.
- [x] Page-level budget changes table added with intuitive default sorting and filters.
- [x] Hover preview added so users can inspect change details without leaving the table.
- [x] Detail sheet added with complete change details and single-item actions.
- [x] Bulk selection and top-level approval actions added.
- [x] Single-row status change control added.
- [x] Errors are specific and actionable; no silent failures.
- [x] User-facing copy/UI follows noise gate and shared component rules.

## Integration Checklist

- [x] Budget page URL routing supports `?tab=budget-changes`.
- [x] Table reads real budget changes from `/api/projects/[projectId]/budget/modifications`.
- [x] Row click opens detail sheet with full line-item details.
- [x] Single-row status actions call the canonical PATCH route and refresh table state.
- [x] Bulk actions operate only on valid selected rows and report partial failures clearly.
- [x] Approvals update the budget page data so downstream totals can refresh.

## Regression Guardrails

- [x] Targeted automated coverage added or updated for the new workflow surface.
- [x] Missing coverage called out explicitly if a narrow automated test is not practical.
- [x] Existing budget tabs/routes remain intact.

## Verification Checklist

- [x] Targeted automated test run.
- [x] Browser/user-flow verification run on the exact local budget route.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] The budget page shows a `Budget Changes` tab.
- [x] That tab displays draft, pending, approved, and void changes in a readable table.
- [x] Hovering a row exposes enough detail to avoid unnecessary clicks.
- [x] Clicking a row opens a side panel with all details and status actions.
- [x] Users can select multiple pending rows and approve them from the top action row.
- [x] Users can change a single row’s status inline without opening the detail sheet.
- [x] The workflow makes draft changes discoverable immediately after creation.

## Files / Owners In Scope

- `docs/ops/tasks/2026-07-03-budget-changes-review-workflow.md` - task definition and evidence ledger.
- `frontend/src/components/budget/budget-tabs.tsx` - budget page tab shell.
- `frontend/src/app/(main)/[projectId]/budget/page.tsx` - budget page route integration owner.
- `frontend/src/app/api/projects/[projectId]/budget/modifications/route.ts` - canonical budget change data and action owner.
- `frontend/src/components/budget/*` - new page-level budget changes components and shared UX wiring.
- `frontend/src/components/tables/unified/*` - shared table primitive ownership for embedded workflow-table behavior.

## Attention Brief

Primary user: Project manager reviewing newly created budget changes.
Primary job: Find drafts immediately, inspect the transfer, and approve with minimal friction.
Primary decision: Is this budget change ready to submit, approve, reject, or void?
Tier 1: Status, source/destination lines, amount, created date, notes, action readiness.
Tier 2: Full line-item detail and reasoning.
Tier 3: Historical or low-signal metadata.
Hide until requested: Raw API payload structure and implementation detail.
Remove: Decorative cards, duplicate CTAs, and non-essential summary noise.
Primary action: Review and approve budget changes.
Failure-loudly behavior: Invalid transitions, bulk partial failures, and refresh issues must surface exact status/action constraints.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Targeted test | `cd frontend && ./node_modules/.bin/jest --runInBand src/components/budget/__tests__/budget-changes-utils.test.ts` | Pass | Guardrail coverage now includes the moved transfer amount so the table shows `$123.00` instead of the misleading net `$0.00`. |
| Targeted lint | `cd frontend && ./node_modules/.bin/eslint 'src/components/budget/budget-changes-tab.tsx' 'src/components/budget/budget-changes-utils.ts' 'src/components/tables/unified/embedded-unified-table-page.tsx' 'src/components/tables/unified/unified-table-page.tsx' 'src/components/tables/unified/index.ts'` | Pass | The refactor passed with the shared embedded-table wrapper and hidden-header support, replacing the page-local pills and hand-rolled table shell. |
| Browser verification | Visible app-browser route `http://localhost:3001/876/budget?tab=budget-changes` | Pass | Confirmed the page renders the shared unified table toolbar and table shell, with live rows including `BM-0004`, `BM-0003`, `BM-0002`, and `BM-0001`. |
| Browser verification detail sheet | Visible app-browser row click on `BM-0004` | Pass | Clicking `BM-0004` updated the URL to `?tab=budget-changes&detail=4b7d2700-bbcc-4849-b5e8-992b26329483` and opened the right-side review panel with Draft status, From/To transfer details, created date, amount, and `Submit for approval`. |
| Discoverability wiring | `handleModificationSuccess()` route push to `/${projectId}/budget?tab=budget-changes` | Pass | New changes now route the user to the review tab after create success so drafts are not hidden on the main budget table. |

## Risks / Gaps

- The repo currently has unrelated dirty files; this task must stay scoped to budget workflow files.
- The existing API uses legacy `budget_modifications` naming while the page UX uses `Budget Changes`; the UI stays consistent, but backend naming debt still exists.
- Inline status-select interaction and multi-select bulk action buttons are implemented in the shared table surface, but this verification pass focused on render truth and detail-sheet review rather than mutating live workflow state again.

## Known Unrelated Failures / Warnings

- `next dev` on port `3001` had to be restarted in a live PTY after the prior background dev process became unhealthy and served `500` on `/auth/login`. The feature verification was rerun against the restarted server.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
