# Financial Workflow QA Evidence

- Task: `QA-FINANCIAL-2026-07-14`
- Date: 2026-07-14
- Environment: local frontend on `http://localhost:3000`, authenticated saved state
- Project: `876`
- Overall result: `INCONCLUSIVE`

## Journey results

| Step | Result | Runtime evidence |
| --- | --- | --- |
| Budget | PASS | `/876/budget` loaded authenticated; budget controls, lock state, tabs, and cost-code groups rendered. Screenshot: `tests/agent-browser-runs/2026-07-14-financial-workflow/budget-initial.png` |
| Prime contract and SOV | PASS (surface only) | `/876/prime-contracts` loaded with table controls and two rows. Screenshot: `prime-contracts.png`. SOV creation/persistence was not exercised. |
| Commitment | PASS (read path) | `/876/commitments` loaded 18 rows after a 5-second data wait; totals rendered as `$4,506,643.43` original and `$4,321,573.43` remaining. Desktop and mobile screenshots captured. |
| Change event | BLOCKED | `/876/change-events` loaded but remained `0 rows` after 5 seconds and displayed “No change events found.” The visible `Create` and `Add change event` controls did not navigate or open a form during this run. |
| Change order | INCONCLUSIVE | `/876/change-orders` loaded 1 Draft PCO (`PCO for CE 001 - Added Opening`, `$700.00`) while Change Events showed 0 rows. This is a cross-surface data-integrity mismatch requiring investigation. |
| Invoice | PASS (read/reload path) | `/876/invoicing` loaded; reload normalized to canonical `/876/invoices` and rendered 5 rows with invoice totals. Screenshots: `invoicing.png`, `invoicing-reload.png`. |

## Required evidence

- Screenshots: captured for budget, prime contracts, commitments, change events, change orders, invoices, invoice reload, and commitments at mobile viewport `390x844`.
- Reload proof: invoice route reloaded successfully, normalized from `/876/invoicing` to `/876/invoices`, and rendered 5 persisted rows.
- Negative path: attempted the Change Events empty-state creation controls without submitting data; controls produced no navigation/form, so validation behavior is not proven.
- Database/readback: no new records were written in this safe read-only run. Visible persisted rows/totals were recorded, but no write-to-database reconciliation claim is made.
- Regression test: blocked in auth setup. Exact command and failure are recorded in `financial-workflow-regression.txt`.

## Failure learning

- Cause: the downstream Change Orders surface exposes a PCO referencing a change event that the Change Events surface cannot list; the Change Events creation path also did not become actionable.
- Detection gap: route-level smoke checks can pass while cross-surface lineage and creation affordances fail.
- Prevention: add a deterministic change-event creation test with API/database readback, then assert the created event is visible from both Change Events and Change Orders; add a guard that rejects or surfaces orphan PCO references.

## Remaining risk

The financial chain is not trusted end-to-end. The highest-risk unresolved boundary is Change Events → Change Orders, followed by the auth setup timeout that prevented the targeted Playwright regression from running.
