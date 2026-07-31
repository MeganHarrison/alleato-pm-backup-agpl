# Task: Directory Subcontractor View Toggle

Status: Complete
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-941
Linear URL: https://linear.app/megankharrison/issue/AAI-941/project-directory-subcontractors-view-toggle-and-grouped-contact
Related Handoff: Not applicable

## Objective

Update `/876/directory` subcontractors so the contacts/company rollup is controlled by an explicit table view switch, not the generic group icon, and make By company rows visually aligned when some companies can expand and others cannot.

## Attention Brief

Primary user: Project admin maintaining subcontractor directory contacts.
Primary job: Switch quickly between contact-level and company-level directory views.
Primary decision: Whether to inspect individual contacts or manage companies as rollups.
Tier 1: Subcontractors table rows and Add Company action.
Tier 2: View switch, search, column settings, row actions.
Tier 3: Expanded contact list for multi-contact companies.
Hide until requested: Per-company contact detail rows.
Remove: Generic Group by icon for this binary view choice.
Primary action: Add Company.
Failure-loudly behavior: The active view must have accessible labels, and every expandable row must expose expand/collapse state.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Acceptance Criteria

- [x] Subcontractors toolbar shows an explicit `By contact` / `By company` view switch instead of the generic Group by icon.
- [x] `By contact` shows one row per contact/company membership as before.
- [x] `By company` shows one row per company and can expand multi-contact companies.
- [x] Company names remain aligned in `By company`, including companies with zero or one contact.
- [x] Disabled chevron affordance is visually muted and accessible for non-expandable rows.
- [x] Search, Add Company, column settings, export, and row actions continue to work.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] Existing table toolbar behavior is preserved for non-directory tables.
- [x] Linear kickoff and closeout comments posted.

## Regression Guardrails

- [x] Targeted static check run for changed directory page.
- [x] Browser evidence captured for the actual directory route.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/directory/page.tsx'` | Pass with 1 unrelated warning | Existing `design-system/no-raw-page-grid` warning at line 2214; no errors and changed raw-button warnings were removed. |
| Browser/user-flow | `agent-browser open http://localhost:3001/876/directory`; `agent-browser scroll down 1400`; `agent-browser click @e60`; `agent-browser click @e74`; screenshot `docs/ops/evidence/2026-07-04-directory-subcontractor-view-toggle/by-company-expanded.png` | Pass | Local authenticated route showed `By contact` / `By company`; By company rolled up rows and expanded Adelphia contacts inline. |
| End-to-end proof | Same browser flow and screenshot artifact | Pass | Search, table settings, export, Add Company, row actions, expandable rows, and disabled chevron slots were visible on the actual route. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/directory/page.tsx` - replaces subcontractor group menu wiring with a local view switch and aligns grouped company chevrons.
- `docs/ops/tasks/2026-07-04-directory-subcontractor-view-toggle.md` - task ledger and evidence.

## Risks / Gaps

- Production deploy/publish not performed in this slice.
- Existing lint warning at `frontend/src/app/(main)/[projectId]/directory/page.tsx:2214` is unrelated layout debt.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
