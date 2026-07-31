# Task: Prime Change-Order Detail Mobile Responsiveness

Status: In Progress
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-900 - https://linear.app/megankharrison/issue/AAI-900/fix-prime-change-order-detail-page-mobile-responsiveness-and-density
Related Handoff: N/A

## Objective

Fix `/876/change-orders/prime/4797` so the prime change-order detail page reads cleanly on mobile and tablet instead of collapsing into a desktop-only layout with broken density, wrapping, and scanability.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: Prime change-order detail page.
One purpose: Read and act on a single change-order record across mobile and desktop.
Primary user job: Scan the record, confirm financial/date metadata, and move into the correct next action without fighting layout.
Primary action: Read the record and use canonical actions or tabs.
Secondary actions: Edit, approve, reject, export, email, review related items and line items.
Next action after success: Continue record work from the current page without zooming or horizontal layout confusion.
Correction path: Use existing edit/action flows and keep failure states visible.
Keyboard path: Tabs and action menu remain reachable; long content wraps without clipping.
Information that belongs elsewhere: Dashboard summaries, decorative cards, duplicate CTA bars, page-local responsive hacks.
Blessed pattern: Quiet mobile-first detail page with open canvas sections, constrained typography, and responsive tables/lists only where needed.
Complexity budget: Shared layout primitives only, no nested page cards, no new one-off visual systems.
Pass/fail: Current page fails on small screens; revised page must pass before closeout.

## Noise Gate Brief

Primary user: PM/accounting/admin reviewing a change order in the field or on a laptop.
Primary job: Read the record quickly and trust what they see.
Primary decision: What this change order is, what it is worth, what state it is in, and what to do next.
Tier 1: Title, status, amount, contract, dates, line items, actions.
Tier 2: Change reason, reviewer metadata, flags.
Tier 3: Rejection notes and extended description.
Hide until requested: Overflow actions and secondary tabs.
Remove: Desktop-only spacing assumptions, excessive two-column density on small screens, clipping/wrapping breakage.
Primary action: Use the record, not fight the layout.
Failure-loudly behavior: If data is missing or a section is empty, show explicit empty values without collapsing the page into broken structure.

## Scope Checklist

- [x] Existing architecture and related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Header/title/actions layout updated for small screens.
- [x] Tab strip remains usable on mobile without clipping or unusable touch targets.
- [x] General information / financial summary / key dates reflow into a mobile-first layout.
- [x] Long values wrap cleanly without breaking row alignment.
- [x] Line items receive an intentional small-screen presentation instead of a squeezed desktop table.
- [x] User-facing UI remains within product noise gate and shared primitive rules.

## Integration Checklist

- [x] Existing API contract remains compatible with the page.
- [ ] Existing page actions still work.
- [x] Existing tabs still switch correctly.
- [x] Empty/loading/error states remain recoverable.

## Regression Guardrails

- [x] Targeted lint/check run for changed files.
- [x] Browser evidence captured for the actual requested route or a local authenticated equivalent.

## Verification Checklist

- [x] Static/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] Small-screen users can read the header/title/actions area without overlap or clipped controls.
- [x] The General tab content reads as a clean one-column flow on mobile and a sensible multi-column flow on larger screens.
- [x] Long strings like the contract link and creator name wrap without causing horizontal instability.
- [x] Line items remain understandable on smaller screens without forcing a broken compressed table.
- [x] No new one-off page wrapper or decorative card system is introduced.

## Files Changed

- `frontend/src/app/(main)/[projectId]/change-orders/prime/[primeCoId]/page.tsx` - prime change-order detail surface and responsive layout owner.
- `docs/ops/tasks/2026-07-02-prime-co-detail-mobile-responsive.md` - task definition and evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Linear kickoff | `AAI-900` | Pass | Issue created before responsive layout edits. |
| Linear kickoff comment | Linear comment `2758a0df-1340-4d8d-8b55-8b92620d0017` | Pass | Scope, planned files, and next action recorded. |
| Targeted lint | `pnpm --dir frontend exec eslint 'src/app/(main)/[projectId]/change-orders/prime/[primeCoId]/page.tsx'` | Pass with warnings | No errors. Remaining warnings are pre-existing page-level design-system debt on this legacy page file. |
| Local route auth | `agent-browser --session-name prime-co-mobile auth login alleato-test-3001` | Pass | Saved auth profile reopened the local route successfully. |
| Mobile browser proof | `agent-browser --session-name prime-co-mobile open 'http://localhost:3001/876/change-orders/prime/4797'` then `set viewport 390 844` and `screenshot` | Pass | Verified the exact route at mobile width after local auth. |
| Mobile artifact | `docs/ops/evidence/2026-07-02-prime-co-detail-mobile-responsive/prime-co-detail-mobile-local.png` | Pass | Screenshot shows one-column detail flow, wrapped title, and usable tabs on mobile. |
| Secondary mobile artifact | `docs/ops/evidence/2026-07-02-prime-co-detail-mobile-responsive/prime-co-detail-mobile-line-items-local.png` | Pass | Additional mobile screenshot captured from the same verified route/session. |

## Risks / Gaps

- The current checkout has unrelated dirt; publish/finish work must isolate task-owned files only.
- Production browser proof may still depend on auth/session behavior; local authenticated fallback may be required.
- I did not re-click every overflow action after the responsive refactor; primary browser proof covered layout, tab usability, and route rendering rather than every action path.
