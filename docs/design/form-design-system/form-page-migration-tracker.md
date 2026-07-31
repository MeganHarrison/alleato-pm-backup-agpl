# Form Page Migration Tracker

_Last updated: 2026-03-10 (migration batch 3)_

## Status legend

- `Migrated (form system)`: Uses shared form-system components (`FormSection`, `FormGrid`, RHF field wrappers) directly or via a dedicated form component.
- `Layout only`: Uses `ProjectFormPageLayout` for consistent page spacing/alignment, but field migration to the shared form system is still pending.
- `Not migrated`: Still on a bespoke layout and/or bespoke field system.

## Form pages

| Route | Page file | `ProjectFormPageLayout` | Shared form system in page file | Migration status | Notes |
|---|---|---|---|---|---|
| `/[projectId]/budget/line-item/new` | `frontend/src/app/(main)/[projectId]/budget/line-item/new/page.tsx` | Yes | Yes | Migrated (form system) | Uses `ProjectFormPageLayout`, `FormSection`, `FormActions`, `BudgetCodeSelector` |
| `/[projectId]/change-events/[changeEventId]` | `frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/page.tsx` | No | Yes | Migrated (form system) | Same-page edit mode on detail page (`?edit=1`) |
| `change-events - edit` | `frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/edit/page.tsx` | N/A | N/A | Migrated (redirect-only) | Redirects to detail page `?edit=1` |
| `change-events - new` | `frontend/src/app/(main)/[projectId]/change-events/new/page.tsx` | Yes | Yes | Migrated (form system) | Uses shared `ChangeEventForm` |
| `/[projectId]/change-orders/[changeOrderId]` | `frontend/src/app/(main)/[projectId]/change-orders/[changeOrderId]/page.tsx` | No | Yes | Migrated (form system) | Same-page edit mode on detail page (`?edit=1`) |
| `change-orders - edit` | `frontend/src/app/(main)/[projectId]/change-orders/[changeOrderId]/edit/page.tsx` | N/A | N/A | Migrated (redirect-only) | Redirects to detail page `?edit=1` |
| `change-orders - new` | `frontend/src/app/(main)/[projectId]/change-orders/new/page.tsx` | Yes | No | Layout only | |
| `/[projectId]/commitments/[commitmentId]` | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx` | No | Yes | Migrated (form system) | Same-page edit mode on detail page (`?edit=1`) |
| `/[projectId]/commitments/[commitmentId]/edit` | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx` | N/A | N/A | Migrated (redirect-only) | Redirects to detail page `?edit=1` |
| `/[projectId]/commitments/configure` | `frontend/src/app/(main)/[projectId]/commitments/configure/page.tsx` | Yes | No | Layout only | Shell migrated to `ProjectFormPageLayout`; field wrappers pending |
| `/[projectId]/commitments/new` | `frontend/src/app/(main)/[projectId]/commitments/new/page.tsx` | Yes | No | Layout only | |
| `/[projectId]/direct-costs/new` | `frontend/src/app/(main)/[projectId]/direct-costs/new/page.tsx` | Yes | No | Migrated (form system) | Uses `CreateDirectCostForm` -> `DirectCostForm` (shared form system) |
| `/[projectId]/invoices/new` | `frontend/src/app/(main)/[projectId]/invoices/new/page.tsx` | Yes | Yes | Migrated (form system) | Uses `FormSection` + `FormActions` across invoice tabs |
| `/[projectId]/invoicing/[invoiceId]` | `frontend/src/app/(main)/[projectId]/invoicing/[invoiceId]/page.tsx` | No | Yes | Migrated (form system) | Edit slideover uses RHF form-system fields + `FormSection`/`FormActions` |
| `/[projectId]/invoicing/new` | `frontend/src/app/(main)/[projectId]/invoicing/new/page.tsx` | Yes | Yes | Migrated (form system) | Form content moved to `FormSection` + `FormGrid` + `FormActions` |
| `/[projectId]/meetings/schedule` | `frontend/src/app/(main)/[projectId]/meetings/schedule/page.tsx` | Yes | Yes | Migrated (form system) | Uses `FormSection` + `FormGrid` + `FormActions` |
| `/[projectId]/prime-contracts/[contractId]` | `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx` | No | Yes | Migrated (form system) | Same-page edit mode on detail page (`?edit=1`) |
| `/[projectId]/prime-contracts/[contractId]/edit` | `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/edit/page.tsx` | N/A | N/A | Migrated (redirect-only) | Redirects to detail page `?edit=1` |
| `/[projectId]/prime-contracts/configure` | `frontend/src/app/(main)/[projectId]/prime-contracts/configure/page.tsx` | Yes | Yes | Migrated (form system) | |
| `/[projectId]/prime-contracts/new` | `frontend/src/app/(main)/[projectId]/prime-contracts/new/page.tsx` | Yes | Yes | Migrated (form system) | Uses shared `ContractForm` |
| `/[projectId]/rfis/new` | `frontend/src/app/(main)/[projectId]/rfis/new/page.tsx` | Yes | Yes | Migrated (form system) | Uses `FormSection`, `FormGrid`, `FormActions`, and RHF field wrappers |
| `/admin/company-knowledge` | `frontend/src/app/(main)/admin/company-knowledge/page.tsx` | No | Yes | Migrated (form system) | Profile/article forms now use shared field components (`TextField`, `TextareaField`, `SelectField`) |
| `/create-project` | `frontend/src/app/(main)/create-project/page.tsx` | No | Yes | Migrated (form system) | |
| `/form-template` | `frontend/src/app/(main)/form-template/page.tsx` | No | Yes | Migrated (form system) | Reference template |

## Suggested workflow

1. Migrate `Not migrated` pages to `ProjectFormPageLayout` first.
2. Migrate fields/sections to shared form-system components next.
3. Update this table row-by-row as each page is completed.
