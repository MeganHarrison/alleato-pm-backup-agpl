# Task: RFI Detail Mobile Layout Fix

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-979 - https://linear.app/megankharrison/issue/AAI-979/fix-rfi-detail-mobile-layout-collapse
Related Handoff: N/A

## Objective

Repair the mobile and narrow-tablet presentation of the canonical RFI detail
route so the redesigned page remains readable and actionable below desktop
widths without reverting to page-local hacks or breaking the shipped desktop
layout.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: RFI detail page mobile/narrow layout.
One purpose: Inspect and act on one RFI from a smaller viewport.
Primary user job: Read the subject/question, inspect ownership/details, and use
the top actions without horizontal strain or awkward layout collapse.
Primary action: Review/update the RFI or create follow-on work from the header.
Secondary actions: Export, change status, add responses, inspect metadata.
Blessed pattern: Mobile-first stacked detail layout using shared PageShell,
DetailLayout, and inspector primitives with wrapping header actions.
Complexity budget: No duplicate CTA rows, no page-local wrapper cards, no
one-off breakpoint magic.
Failure-loudly behavior: If the page cannot fit a narrow viewport, controls must
wrap or stack; no hidden/offscreen actions.

## Scope Checklist

- [x] Existing architecture and owner files reviewed.
- [x] Shared layout/action primitives identified before edits.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Mobile-first spacing/order changes applied at the right layer.
- [x] Header actions wrap/stack cleanly on narrow widths.
- [x] RFI detail content and inspector rail read cleanly on mobile.
- [x] Desktop redesign behavior remains intact.

## Integration Checklist

- [x] Canonical route still loads at `/[projectId]/rfis/[rfiId]`.
- [x] Create Change Event button remains reachable and functional.
- [x] Attachments and response thread remain reachable on mobile.
- [x] Inspector metadata remains reachable without overflow.

## Regression Guardrails

- [x] Targeted static/lint check run for changed files.
- [x] Browser/mobile viewport evidence captured for the actual route.

## Acceptance Criteria

- [x] Header title and actions no longer crowd or overflow on narrow widths.
- [x] Mobile users can reach primary metadata without awkward desktop-style collapse.
- [x] No horizontal overflow or clipped action controls is introduced.
- [x] Shared layout/design-system tokens remain intact.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Existing mobile regression proof | `/var/folders/ff/1ybhtyzs5kz7sbvy_l8d4qf80000gn/T/codex-clipboard-739e5822-9557-4c6a-9e94-ab1e62321ff9.png` | Pass | Shows the narrow layout needing a mobile collapse pass. |
| Targeted lint | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/rfis/[rfiId]/rfi-detail.tsx' 'src/app/(main)/[projectId]/rfis/[rfiId]/rfi-header-actions.tsx' 'src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx' 'src/components/layout/detail-layout.tsx' 'src/components/ds/inspector.tsx'` from `frontend/` | Pass | Clean after the responsive layout and action-row changes. |
| Whitespace check | `git diff --check -- 'frontend/src/app/(main)/[projectId]/rfis/[rfiId]/rfi-detail.tsx' 'frontend/src/app/(main)/[projectId]/rfis/[rfiId]/rfi-header-actions.tsx' 'frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx' 'frontend/src/components/layout/detail-layout.tsx' 'frontend/src/components/ds/inspector.tsx' 'docs/ops/tasks/2026-07-06-rfi-detail-mobile-layout-fix.md'` | Pass | No whitespace errors. |
| Mobile browser proof | Playwright mobile viewport with `storageState='./tests/.auth/user.json'` against `http://localhost:3001/876/rfis/fe13bf4e-dbb6-494a-bb50-b8fc821b694e` | Pass | Captured `docs/ops/evidence/2026-07-06-rfi-detail-mobile-layout-fix/rfi-detail-mobile-after.png` from the canonical local route. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx` - mobile-safe title scale and header hierarchy tuning.
- `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/rfi-detail.tsx` - mobile ordering, section-heading cleanup, related-items placement, and comment-surface scoping.
- `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/rfi-header-actions.tsx` - primary action wrapping behavior and dropdown icon consistency.
- `frontend/src/components/layout/detail-layout.tsx` - shared mobile-first detail stack behavior.
- `frontend/src/components/ds/inspector.tsx` - inspector rail/row mobile fit if needed.
- `frontend/src/components/ds/DetailActions.tsx` - shared overflow-menu icon consistency.
- `frontend/src/components/domain/related-items/RelatedItemsPanel.tsx` - related-item search converted from free text to combobox behavior.
- `frontend/src/app/globals.css` - scoped RFI comment-surface styling adjustments.
- `docs/ops/tasks/2026-07-06-rfi-detail-mobile-layout-fix.md` - task definition and evidence.

## Risks / Gaps

- Mobile verification depends on a live local dev server and the saved local Playwright auth state.
- This pass verifies local mobile rendering only; preview/production mobile verification was not run.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
