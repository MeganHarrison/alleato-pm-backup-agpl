# Handoff — AIA G702 Line 5 & Line 9 correctness fixes (invoice financials)

> **STATUS (2026-07-09): IMPLEMENTED** on branch `feat/g702-correctness-line5-line9`
> (stacked on the Card 1 module PR). Both fixes landed via one shared core `g702Rollup`:
> Line 5 is now cumulative (a proven no-op on all current subcontractor data — every real
> invoice has zero carried-forward retainage), and the prime side adopts the module with the
> corrected Line 9 (`payment-application-summary.ts` retired). Verification note: production
> exposure is near-zero (subcontractor multi-period retainage = 1 test invoice; prime payment
> applications = 3 rows), so before/after proof is via unit tests + a preview screenshot of a
> test record rather than a real invoice. The sections below are retained as the rationale.

**Created:** 2026-07-09
**Source:** Card 1 deepening (`/improve-codebase-architecture`). Surfaced while unifying the
subcontractor + prime payment math into `frontend/src/lib/invoicing/payment-application.ts`.
**Type:** Correctness fixes on a LIVE money surface — Large tier. Each needs real-invoice proof.
**Prerequisite:** the behavior-preserving extraction (Slice 1) is merged. This module is now
the single owner of the G702 math, so each fix is a one-place change + a test.

---

## Why these are separate from the refactor

Slice 1 deliberately preserved existing numbers (old == new), so it was verifiable as a pure
refactor. Unifying the two forks exposed that they embedded **different bugs**. Changing either
alters live payment-due amounts, so they must be fixed deliberately, each verified against a
known-correct invoice (Procore or a hand-computed G702), never bundled into a refactor.

Reference for the AIA line definitions: `CONTEXT.md` → "Invoicing / payment applications".
Procore confirms retainage release is a first-class subcontractor-invoice type
(https://v2.support.procore.com/product-manuals/invoicing-project/tutorials/create-an-invoice-for-release-of-retainage).

---

## Bug A — subcontractor Line 5 sums THIS-period retainage, not cumulative held

**Where:** `computeSubcontractorRollup` in `frontend/src/lib/invoicing/payment-application.ts`
(reproduces the original subcontractor route behavior).

**Current:** `total_work_retainage = Σ retainage_amount` and
`total_materials_retainage = Σ materials_retainage_amount` — i.e. only **this period's**
retainage. Line 6 (`total_earned_less_retainage`) then subtracts only this-period retainage
from **cumulative** completed-and-stored (Line 4), which mixes cumulative and per-period.

**AIA G702:** Line 5 is retainage **held to date** (cumulative), so Line 6 =
cumulative earned less cumulative retainage. The module already exposes the correct
cumulative figure per line via `workCurrentlyRetained` / `materialsCurrentlyRetained`
(`previous + this-period − released`).

**Fix (once, in the module):** compute Line 5 from the cumulative held amounts:
`total_work_retainage = Σ workCurrentlyRetained(line)`,
`total_materials_retainage = Σ materialsCurrentlyRetained(line)`. This requires the rollup to
receive `previous_work_retainage`, `retainage_amount`, `work_retainage_released` (+ materials)
per line — currently the rollup only takes the four summed fields, so widen
`PaymentApplicationRollupLine`.

**Blast radius:** changes Line 5, 6, and 8 (current payment due) on any invoice where prior
retainage exists. Verify against a real multi-period subcontractor invoice with retainage.

**Guardrail:** add a rollup fixture test with ≥2 billing periods asserting Line 5 = cumulative.

---

## Bug B — prime-side Line 9 is non-AIA

**Where:** `calculatePaymentApplicationSummary` in
`frontend/src/lib/prime-contracts/payment-application-summary.ts` (the OLD canonical calc,
still used by the prime side until it adopts the new module).

**Current (line ~82):** `balanceToFinish = totalScheduledValue − totalCompletedAndStored`.
This drops change orders and retainage.

**AIA G702:** Line 9 "Balance to Finish, Including Retainage" =
`contractSumToDate − totalEarnedLessRetainage`. The subcontractor path already does this
correctly (and the new module does too).

**Fix:** this is folded into the **prime fast-follow** — point the prime side
(`InvoiceG702Summary` + the payment-applications route) at
`computeSubcontractorRollup` / a prime variant in the new module, retiring
`payment-application-summary.ts`. The correct Line 9 comes for free once prime adopts the module.

**Also missing on the prime side:** retainage-release handling (Line 8 special case). The new
module has it; `payment-application-summary.ts` does not.

**Blast radius:** live prime-contract payment applications. Verify against a known prime G702.

---

## Suggested order

1. Prime fast-follow first (adopt the module on the prime side) — resolves Bug B + adds
   retainage release, and gives a second real consumer that proves the module.
2. Then Bug A (cumulative Line 5) as its own PR with multi-period fixtures + real-invoice proof.

Each is a separate branch/PR off fresh `main` with a Vercel preview + VISUAL-PROOF screenshots
(both the rollup panel and a known-correct reference), per `.claude/rules/VISUAL-PROOF-GATE.md`.
