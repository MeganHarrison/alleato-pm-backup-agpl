# Detail Page Deviation Ledger

This file is the source of truth for intentional UI deviations on detail pages.

Rule:
- Any deviation from core layout/component primitives must be annotated inline in code with `@ui-exception <id>`.
- Any unannotated deviation is a design-system violation.

## Active Deviations

| Exception ID | File | Reason | Status |
| --- | --- | --- | --- |
| `prime-contract-history-timeline` | `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx` | No shared timeline/list primitive currently supports the contract-history row shape (label + timestamp + details). Local shell retained until shared component extraction. | Active |

## Cleared / None

- No other intentional deviations are currently annotated for Prime Contract detail.
