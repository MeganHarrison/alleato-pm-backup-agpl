# Task: Plane Cycles Visual Parity Correction

Status: Ready for Shared-Route Verification
Owner: S20260730-CYCLESPARITY
Created: 2026-07-30
Task ID: AAI-PLANE-CYCLES-PARITY

## Objective

Replace the generic Alleato Cycles composition with the actual Plane Cycles
list-page template while preserving the shared Plane workspace shell and the
existing real schedule adapter, project permissions, and mutations.

Delivery lane: Standard

## Owned Scope

- `frontend/src/features/plane-cycles/**`
- `docs/ops/tasks/AAI-PLANE-CYCLES-PARITY.md`
- `docs/ops/tasks/evidence/AAI-PLANE-CYCLES-PARITY/**`

Shared shell, dispatcher, database schema, production data, and legacy routes
are explicitly excluded.

## Plane Source Baseline

Repository: `C:\Users\KimiClaw\Desktop\mkh-main\plane`

Revision: `39856932cd6b9bd17eab0920506d628190b47af2`
(`v1.4.0-rc1-11-g39856932cd`)

Direct composition sources reused:

- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/page.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/layout.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/header.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(list)/mobile-header.tsx`
- `apps/web/core/components/cycles/cycles-view.tsx`
- `apps/web/core/components/cycles/cycles-view-header.tsx`
- `apps/web/core/components/cycles/list/root.tsx`
- `apps/web/core/components/cycles/list/cycles-list-map.tsx`
- `apps/web/core/components/cycles/list/cycle-list-group-header.tsx`
- `apps/web/core/components/cycles/list/cycles-list-item.tsx`
- `apps/web/core/components/cycles/active-cycle/root.tsx`
- `apps/web/core/components/cycles/active-cycle/progress.tsx`
- `apps/web/core/components/cycles/active-cycle/productivity.tsx`
- `apps/web/core/components/cycles/active-cycle/cycle-stats.tsx`
- `apps/web/core/components/cycles/form.tsx`
- `apps/web/core/components/cycles/modal.tsx`

## Acceptance Contract

- [x] No generic `PageShell`, `ProjectPageHeader`, or legacy Alleato page
      composition remains inside the Cycles surface.
- [x] Plane's compact breadcrumb/action header, collapsed search, progressive
      filters, mobile layout strip, applied-filter strip, full-height scroll
      canvas, and grouped disclosures own the composition.
- [x] The Active cycle group expands to Plane's cycle row plus three-column
      progress, burndown, and work-item analytics region.
- [x] Upcoming is open by default and Completed is collapsed by default.
- [x] Existing real read, create, edit, complete, and delete adapter behavior is
      preserved and gated by Schedule write permission.
- [x] AGPL copyright, SPDX, exact source revision, source offer, and reused
      source paths are prominent in derivative files and this record.
- [x] Focused model tests, syntax transpilation, complexity audit, and patch
      integrity pass.
- [ ] Desktop and mobile proof is captured by the shared-route verification
      owner after integration.

## Expected Route Screenshot Criteria

Target route: `http://localhost:<port>/31/plane/cycles` with
`PLANE_SCHEDULE_ADAPTER_PREVIEW=true`.

Desktop at 1440 x 900:

- Shared Plane sidebar and global command header are the only host chrome.
- Cycles owns a single 44px compact breadcrumb/action header, not an Alleato
  title/description page header.
- Active, Upcoming, and Completed group headers span the content canvas.
- An active cycle shows its progress row and three analytics panels.
- No boxed page-level wrapper or excess outer padding surrounds the list.

Mobile at 390 x 844:

- Workspace sidebar is closed and shared mobile navigation remains usable.
- Cycles header retains title, filter, and `Add`; search expands without
  horizontal overflow.
- Plane's centered `Layout` strip appears below the header.
- Cycle rows stack their secondary metadata and retain 44px action targets.
- Active analytics collapse to one column with no clipping or horizontal scroll.

Side-by-side comparison must use the same populated project state. Any remaining
differences in typography, spacing, icons, analytics data, or breakpoints must
be listed rather than hidden.

## Failure-Loudly Contract

- Read failures render the server-provided error and retry action.
- Mutation failures preserve the modal state and display the actionable error.
- Overlapping dated cycles are rejected before mutation with the conflicting
  cycle name.
- Permission loading or missing Schedule write permission removes mutation
  affordances.

## Evidence

| Check                       | Result   | Notes                                                                                                |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Exact Plane source revision | Pass     | Local checkout read at `39856932cd`.                                                                 |
| Ownership lease             | Pass     | Fresh isolated Cycles-only workspace created.                                                        |
| Targeted model tests        | Pass     | Jest, 1 suite and 3 tests.                                                                           |
| TypeScript/TSX syntax       | Pass     | TypeScript transpilation covered every task-owned TS/TSX file.                                       |
| Surface complexity          | Pass     | Both changed UI files passed the Alleato complexity audit.                                           |
| Focused lint                | Pass     | The repository staged-file wrapper completed ESLint fix and strict modes for all five feature files. |
| Patch integrity             | Pass     | `git diff --check` returned no whitespace errors.                                                    |
| Desktop/mobile route proof  | Deferred | Shared dispatcher integration and authenticated preview required.                                    |

## Noise Gate

Pass for the explicitly requested Plane parity target. The generic Alleato
title/description header, redundant toolbar border/padding, and simplified
active-cycle treatment were removed. Plane's three analytics panels remain
because they are the core active-cycle workflow explicitly requested for
source parity, not decorative metrics.

## Remaining Risk

- The feature is route-free by design. The shared dispatcher must integrate this
  commit before authenticated desktop/mobile screenshots can be accepted.
- The existing schedule adapter remains the live data boundary until the
  dedicated Cycle persistence migration is approved, applied, typed, and wired.
- A direct ad hoc ESLint invocation could not resolve the shared Windows
  dependency tree, but the canonical staged-file wrapper completed both ESLint
  fix and strict modes. Jest, syntax transpilation, the doctrine complexity
  audit, and patch integrity also pass.
