# Handoff: Remove Disabled Acumatica Admin Action

Session: SROOT-AUTOSYNC-UI-20260723
Task: LOCAL-2026-07-22-DISABLE-AUTO-SYNCS-UI

## Scope

- Removed the Acumatica action card from the admin actions surface.
- The card was no longer actionable after automatic and frontend-triggered
  imports were disabled.
- A separate exact-path workspace removed the AI OS automatic-sync tool entry
  and changed accounting copy to the latest approved manual import.

## Reason

Independent review found that the card still claimed Acumatica ran twice daily
and would reduce the API's actionable 409 response to generic `Conflict`.
Removing the unsupported action follows the existing admin card composition and
the Alleato product noise gate.

## Verification

- `audit-surface-complexity.mjs`: pass.
- Static removal contract and `git diff --check`: pass.
- Independent combined-release review: pass.
- Browser evidence remains pending until the backend sync shutdown change is
  published into the same main revision.

## Noise Gate

- Primary user: admin or support operator.
- Primary job: run a supported operational action.
- Removed: one dead card, one mode selector, one button, and false schedule copy.
- Failure-loudly path: `/api/accounting/sync` remains a specific 409
  manual-only guard for accidental callers.
