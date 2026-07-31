# Task: Close Subcontractor Invoice PDF Right Edge

Status: Complete
Owner: Codex SROOT3J
Created: 2026-07-31
Task ID: invoice-pdf-right-edge
Linear Issue: Related prior issue [AAI-934](https://linear.app/megankharrison/issue/AAI-934/match-subcontractor-invoice-pdf-export-to-procore-commitment-invoice)

## Objective

Ensure every financial table in the shared subcontractor invoice PDF renderer has a visible right boundary and fits inside the landscape Letter page.

## Scope

- Shared React-PDF subcontractor invoice renderer and its focused unit contract.
- Source PDF `C:/Users/Brandon/Downloads/Right Construction-invoice-APP-01.pdf`.
- Excludes invoice data, SOV calculations, workflow state, and accounting synchronization.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/subcontractor-invoice-pdf.tsx`
- Existing shared renderer: `SubcontractorInvoicePdfDocument`
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Page-one application and change-order tables have closed right borders.
- [x] All three continuation-sheet tables have closed right borders.
- [x] Continuation columns total exactly 100% inside the existing 98.5%-wide frame.
- [x] Both PDF pages remain landscape Letter with no text outside the page box.
- [x] A corrected APP-01 PDF is rendered and visually inspected after the final source change.

## Implementation Checklist

- [x] Shared renderer owns the correction; no one-off PDF patch was introduced.
- [x] The three shared table-frame styles add the missing right border.
- [x] Structural regression tests cover both page-one tables and all three continuation tables.
- [x] The final cells remain borderless on their own so the outer frame does not double the edge.

## Integration and Verification

- [x] Focused Jest passes.
- [x] Targeted ESLint passes.
- [x] Both pages of the corrected PDF were rasterized and visually inspected.
- [x] PDF geometry confirms the right boundary and page containment.
- [x] Independent code and React reviews approved the change with no blockers.
- [x] Known unrelated full-repository type errors are recorded below.
- [x] Task-owned files are published through the exact-file main-branch finish flow.

## Failure-Loudly Contract

- Cause surfaced as: a unit failure when a financial table frame omits `borderRightWidth` or continuation columns no longer total 100%.
- Detection path: focused Jest plus rendered two-page PDF inspection and PDF geometry readback.
- Recovery path: correct the shared renderer styles, regenerate the PDF, and inspect both pages before publication.

## Incident Learning

- Failure fingerprint: N/A
- Registry note: The lookup returned no applicable invoice-layout fingerprint, and the shared registry file already contains unrelated staged work that must not be overwritten.
- Root cause: the financial table frames had top and left borders but no right border, so the last column appeared clipped even though its values remained inside the page.
- Detection gap: the earlier regression asserted only the 98.5% continuation-table width and did not assert a closed right boundary on either page.
- Prevention: test the outer right border on all five financial tables and verify continuation widths total exactly 100%.
- Guardrail evidence: `frontend/src/lib/__tests__/subcontractor-invoice-pdf.unit.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Source reproduction | `C:/Users/Brandon/Downloads/Right Construction-invoice-APP-01.pdf` | Confirmed | Page 2's rightmost vertical boundary stopped at x=712.64. |
| Focused Jest | `node node_modules/jest/bin/jest.js --runInBand src/lib/__tests__/subcontractor-invoice-pdf.unit.test.ts` | Pass | 1 suite, 7 tests. |
| Targeted ESLint | `node node_modules/eslint/bin/eslint.js src/lib/subcontractor-invoice-pdf.tsx src/lib/__tests__/subcontractor-invoice-pdf.unit.test.ts` | Pass | 0 errors and 0 warnings. |
| Corrected PDF | `output/pdf/Right Construction-invoice-APP-01-fixed.pdf` | Pass | Two-page landscape Letter PDF from the final shared renderer. |
| Rendered pages | `tmp/pdfs/right-construction-app-01-fixed/page-1.png` and `page-2.png` | Pass | All five tables have closed right borders without clipping or overflow. |
| Geometry readback | `pdfplumber` page/object inspection | Pass | Fixed page 2 reaches x=760.72; 0 characters fall outside the 792-point page. |
| Independent review | Code and React reviewers | Approved | No correctness, layout, or regression blockers. |
| Full repository typecheck | `node scripts/run-typecheck-bounded.mjs` | Unrelated failure | Existing errors occur outside the two task-owned invoice PDF files. |

## Remaining Risk

- The final sample PDF was rendered from the values visible in APP-01. Future exports use live invoice data through the same corrected renderer.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is documented without altering unrelated staged registry work.
- [x] No deferred product fix remains.
