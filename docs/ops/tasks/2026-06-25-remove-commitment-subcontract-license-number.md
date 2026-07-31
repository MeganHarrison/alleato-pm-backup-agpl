# Task: Remove License Number Field on Commitments New (Subcontract)

Status: In Progress
Owner: Codex
Created: 2026-06-25

## Objective

Remove the License Number field from the `/commitments/new?type=subcontract` creation flow.

## Non-Negotiable Done Rule

This task is not done until all checklist items are complete and evidence is added.

## Scope Checklist

- [x] Identify the field in the new commitment subcontract path.
- [x] Remove License Number input from the subcontract general information UI.
- [x] Remove field-specific form state plumbing in the subcontract form state layer.
- [x] Ensure no build-breaking changes from shared `subcontract-form` typings.

## Implementation Checklist

- [ ] Update `frontent` task-specific validation defaults to stop seeding the field.
- [x] Update form section rendering to remove the field.
- [x] Remove unused field mapping from vendor option/selection state.
- [ ] Re-run at least one targeted typecheck or scoped frontend check.

## Verification Checklist

- [ ] Browser verification for `/25125/commitments/new?type=subcontract` confirms License Number field is not rendered.
- [ ] Confirm existing submit path still works for subcontract creation.

## Planned Files

- `docs/ops/tasks/2026-06-25-remove-commitment-subcontract-license-number.md`
- `frontend/src/components/domain/contracts/subcontract-form/GeneralInfoSection.tsx`
- `frontend/src/components/domain/contracts/subcontract-form/useSubcontractFormState.ts`
- `frontend/src/components/domain/contracts/subcontract-form/types.ts`
