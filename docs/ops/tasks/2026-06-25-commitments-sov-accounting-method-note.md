# Task: Commitments SOV Method Notice Alignment

Status: In Progress
Owner: Codex
Created: 2026-06-25

## Objective

Align the commitments subcontract SOV accounting-method notice with the
"Schedule of Values" title row, right-align it, reduce text size, and simplify
copy while preserving the existing method toggle link.

## Scope Checklist

- [x] Locate the SOV section rendering the method notice on the subcontract form.
- [x] Move method notice to the same row as the "Schedule of Values" title.
- [x] Right-align the notice and make text smaller.
- [x] Update wording to: "method is amount based" and keep the toggle link text for Unit/Quantity.
- [ ] Confirm the notice appears in the same row on the target route and is readable.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Route target located | `/commitments/new?type=subcontract` form mapping | Pass | Route uses `CreateSubcontractForm`. |
| SOV section inspected | `frontend/src/components/domain/contracts/subcontract-form/SovSection.tsx` | Pending | Awaiting edit. |
| UI verification | Manual browser view | Pending | User-visible validation requested. |
