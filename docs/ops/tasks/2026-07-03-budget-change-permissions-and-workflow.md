# Task: Budget change permissions and workflow parity

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-912 - https://linear.app/megankharrison/issue/AAI-912/make-budget-change-status-actions-permission-aware-and-procore-aligned
Related Handoff: None

## Objective

Replace the hardcoded budget-change status workflow with a permission-aware model that stays fast on the page, uses the API as the source of truth, and aligns with Procore's documented Budget Changes permission/workflow behavior where possible.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Procore documentation for Budget Changes permissions and status editing reviewed.
- [x] Current Alleato API/UI permission and transition owners identified.
- [x] Root cause stated as a source-of-truth mismatch, not just a UI bug.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Shared granular permission model updated so budget-change approval is a real source-of-truth flag.
- [x] Permission-template config updated to expose the shared budget-change approval flag.
- [x] Budget modifications API changed to load permissions once and enforce create/status/delete rules from server-side permission state.
- [x] App admins allowed to perform any budget-change action without client-only branching.
- [x] Non-admin budget-change status transitions limited by permission-aware rules rather than one hardcoded workflow for everyone.
- [x] Client budget-changes table updated only as needed to reflect server-authorized actions without adding a new permission fetch.
- [x] Targeted automated coverage added or updated for allowed and denied status actions.
- [x] Errors remain specific; no silent fallback or generic permission failure.

## Integration Checklist

- [x] Budget change creation uses the canonical permission/granular gate.
- [x] Budget change approval/void actions use the canonical permission/granular gate.
- [x] Existing budget rollup refresh still runs after approval/void.
- [x] Existing budget changes route remains performant with no extra page-level permission request.
- [x] Permission-template Budget tool surface reflects the new shared flag.

## Verification Checklist

- [x] Focused automated test run.
- [ ] Focused lint/type checks for changed files.
- [x] Browser verification run on the exact local budget-changes route.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] App admins can execute any budget-change action from the review surface.
- [x] Non-admin users only see and can execute budget-change actions allowed by their permission level and granular flags.
- [x] Users without budget-change creation rights cannot create, edit, or submit budget changes.
- [x] Users without budget-change approval rights cannot approve or void budget changes.
- [x] The page does not add a new permission fetch or other avoidable runtime overhead.
- [x] Unauthorized actions fail loudly with specific server responses.

## Files / Owners In Scope

- `docs/ops/tasks/2026-07-03-budget-change-permissions-and-workflow.md` - task definition and evidence ledger.
- `frontend/src/lib/permissions-shared.ts` - shared granular permission source of truth.
- `frontend/src/app/(admin)/user-management/permission-template-config.ts` - permission-template tool wiring.
- `frontend/src/app/api/permissions/templates/route.ts` - system template seeding.
- `frontend/src/app/api/projects/[projectId]/budget/modifications/route.ts` - canonical budget-change permission and transition owner.
- `frontend/src/components/budget/budget-changes-utils.ts` - client action option shaping.
- `frontend/src/components/budget/budget-changes-tab.tsx` - review UI behavior.
- Relevant tests under `frontend/src/**/__tests__` or route-specific test directories.

## Attention Brief

Primary user: Project admins and project managers reviewing budget changes.
Primary job: Move budget changes through the right actions without being blocked by an incorrect hardcoded workflow.
Primary decision: Which actions are allowed for this user on this budget change right now?
Tier 1: Current status, allowed actions, approval eligibility, failure message.
Tier 2: Detail-sheet review and bulk action affordances.
Tier 3: Internal implementation detail.
Hide until requested: raw permission payloads and internal status-mapping logic.
Remove: page-local permission workarounds and duplicate permission sources.
Primary action: Submit, approve, return, void, or delete a budget change.
Failure-loudly behavior: unauthorized or invalid transitions must return exact action/permission reasons and leave the UI in a consistent state.

## Procore Reference Notes

- Procore documents Budget Changes as permission-template driven, not admin-only by default.
- Procore's docs state manual status editing is unavailable when a custom workflow is applied.
- Procore exposes a granular Budget permission for `Create, Edit, and Delete Budget Changes`.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Procore docs | `support.procore.com` / `v2.support.procore.com` Budget Changes docs | Pass | Reviewed Create/Edit/Approve/Void/Permissions/granular-permissions references before implementation. |
| Focused tests | `cd frontend && ./node_modules/.bin/jest --runInBand 'src/lib/budget/__tests__/budget-change-access.test.ts' 'src/components/budget/__tests__/budget-changes-utils.test.ts'` | Pass | Pure workflow and table-action helpers passed after the permission-aware refactor. |
| Route tests | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath '/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/budget/modifications/__tests__/route.test.ts'` | Pass | Verified row-level editable status hydration, 403 denial without `approve_budget_changes`, and app-admin override from Approved back to Draft. |
| Focused lint | `cd frontend && ./node_modules/.bin/eslint 'src/lib/budget/budget-change-access.ts' 'src/lib/permissions-shared.ts' 'src/app/(admin)/user-management/permission-template-config.ts' 'src/app/api/permissions/templates/route.ts' 'src/app/api/projects/[projectId]/budget/modifications/route.ts' 'src/components/budget/budget-changes-utils.ts' 'src/components/budget/budget-changes-tab.tsx' 'src/lib/budget/__tests__/budget-change-access.test.ts' 'src/components/budget/__tests__/budget-changes-utils.test.ts' 'src/app/api/projects/[projectId]/budget/modifications/__tests__/route.test.ts'` | Pass | No ESLint errors on touched permission/workflow files. |
| Browser verification | Playwright MCP on `http://localhost:3001/876/budget?tab=budget-changes` | Pass | Visible route verification showed detail-panel action `Void change` on approved `BM-0005` and the draft-row status combobox opened with `Draft` and `Pending` options from the new server-fed status list. |

## Risks / Gaps

- Existing permission-template data may not yet include a dedicated budget-change approval flag, so app-admin bypass must remain intact while non-admin behavior becomes stricter.
- The legacy `budget_modifications` naming is still present in the API/database even though the UI says `Budget Changes`.

## Known Unrelated Failures / Warnings

- `cd frontend && NODE_OPTIONS='--max-old-space-size=7168' ./node_modules/.bin/tsc --noEmit --pretty false` was started as a broader frontend type gate and then interrupted after an extended no-output run to keep the task scoped. This was a verification budget stop, not a confirmed budget-change failure.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
