# Task: Financial Markup Description Tooltip on Prime Contracts New Page

Status: In Progress
Owner: Codex
Created: 2026-06-25
Scope: frontend

## Objective

Convert the Financial Markup section helper text on
`/projects/[projectId]/prime-contracts/new` into a tooltip so users view the
helper copy on-demand instead of a permanent description line.

## Non-Negotiable Done Rule

This task is not done until all checklist items are complete and evidence is added.

## Scope Checklist

- [x] Locate the exact Financial Markup section on the Prime Contract creation flow.
- [x] Reuse shared tooltip primitives (no one-off tooltip implementation).
- [x] Ensure the section still communicates the same helper meaning when hovered/focused.

## Implementation Checklist

- [x] Add shared-safe support for ReactNode section descriptions in the shared `FormSection` component.
- [x] Replace Financial Markup description text with a tooltip trigger on
  `/prime-contracts/new` (shared form section used by contract form).
- [ ] Capture a user-flow verification artifact for the updated screen.
- [x] Avoid introducing new design-system exceptions or local style overrides.

## Verification Checklist

- [ ] Browser verification screenshot/video of the Prime Contract new page with tooltip
  interaction.
- [ ] Confirm no compile/type errors from the updated shared component signature.

## Planned Files

- `docs/ops/tasks/2026-06-25-financial-markup-tooltip-on-prime-contract-new.md`
- `frontend/src/components/forms/FormSection.tsx`
- `frontend/src/components/domain/contracts/prime-contract-form/financial-markup-form-section.tsx`

## Risks / Open Items

- No backend or database changes are involved.
- Browser verification is deferred to a follow-up check.
