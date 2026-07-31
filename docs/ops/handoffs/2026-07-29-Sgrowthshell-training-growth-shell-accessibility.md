# Sgrowthshell Handoff: Training Growth Shell Accessibility

## Scope

- `frontend/src/components/ui/sidebar.tsx`
- `frontend/src/components/ui/__tests__/sidebar-inset.test.tsx`
- `frontend/src/app/(main)/training/training-theme.module.css`

## Root Cause

`SidebarInset` rendered a `main` landmark even though every standard application shell already renders its route content inside a nested `main`. The training theme also used `#9c9998` for normal-size muted text on white, below WCAG AA.

## Changes

- Made `SidebarInset` a layout-only `div`.
- Added a one-main-landmark regression test.
- Darkened the canonical muted training color and raised assessment input/helper typography to mobile-readable sizes.

## Verification

Targeted landmark test passes. Muted text computes to 6.10:1 on white and 5.84:1 on the training paper surface. Independent review confirmed the layout-only inset is correct with the explicit immersive-route main landmark. Browser evidence and publication remain.
