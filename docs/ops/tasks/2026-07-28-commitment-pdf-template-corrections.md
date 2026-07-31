# Task: Correct Commitment PDF Template Data

Status: Implemented and verified; commitments can download before the project Client or prime contract is set
Owner: Codex S019fabcf
Created: 2026-07-28
Task ID: LOCAL-2026-07-28-COMMITMENT-PDF
Linear Issue: Not created; this is a bounded same-session production bug fix.
Related Handoff: N/A

## Objective

Generate commitment PDFs from the current commitment and project records so the Owner, Subcontractor, contract amount, canonical job number, and project address match the job, with no legacy sample values leaking into new contracts.

## Scope

- Own the commitment document data adapter and legal-template rendering contract.
- Add focused regression coverage for Owner/Client mapping, amount, retainage, job-number precedence, address normalization, and legacy sample-data removal.
- Verify the supplied Avita at Bradenton commitment as a rendered PDF.
- Exclude edits to the Avita project record or commitment financial record.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/documents/record-documents.ts`
- Existing shared primitives/services: `frontend/src/lib/documents/legal-template-primitives.ts`, `frontend/src/lib/documents/pdf.ts`
- Deprecated or parallel paths: legacy sample values embedded in `frontend/src/lib/documents/templates/commitment-subcontract-template.html`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The legal payment clause uses the commitment's current SOV total and retainage.
- [x] The PDF uses `projects."job number"` before the legacy `project_number` field.
- [x] A complete address already stored in `projects.address` is not duplicated with malformed metadata.
- [x] The contract Owner resolves from the project Client, while the Subcontractor resolves from the commitment Contract Company.
- [x] A missing Owner renders as a blank legal fill-in line rather than `Not set`; missing Subcontractor, amount, retainage, or required template markers still block generation with an actionable error.
- [x] Legacy sample amount, job number, company, contact, and project values do not appear in rendered commitment HTML.
- [x] The Avita regression fixture renders with `$27,600.00`, `26-127`, and one `105 15th St E, Bradenton, FL 34208` address when a test Owner is supplied.
- [x] A commitment created before any prime contract exists still renders Alleato as Contractor with the canonical company address.
- [x] A commitment created before the project Client is selected still downloads with a blank Owner line.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual rendered-page and extracted-text inspection proves the corrected template behavior.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published through the exact-file finish gate and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: focused rendering tests fail when a legacy sample value survives, a canonical project field is bypassed, a missing draft-stage Owner is rendered as text instead of a blank line, or a required financial/party/template input is missing.
- Detection path: targeted Jest contract plus extracted-text and rendered-page inspection of an Avita fixture PDF.
- Recovery path: correct the shared commitment adapter/template renderer; do not patch one generated PDF or one project.

## Incident Learning

- Failure fingerprint: `documents.commitment-template-sample-data-leak`
- Root cause: The legal template used CRLF while replacement markers expected LF, so entire sample sections survived. The adapter also queried legacy project fields, composed an already-complete address twice, did not treat the project Client as the Owner, and populated the Contractor profile only through a prime contract.
- Detection gap: Existing tests checked only that some current values appeared, not that authoritative legal/financial/project fields replaced all sample data or that a commitment without a prime contract retained a complete Contractor identity.
- Prevention: Normalize template line endings and project identity/address once, render legal sections from the bundle, map Owner from Client when available, use the shared blank-line primitive while Owner is unset, resolve Contractor through the canonical Alleato company fallback when no prime contract exists, and fail before PDF generation only for required financial, Subcontractor, or template data.
- Guardrail evidence: `frontend/src/lib/documents/__tests__/record-documents.unit.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and high-risk done gate captured before implementation. |
| Runtime observation | Supplied `SC-001-Shoring .pdf` pages 1, 8, and 14 | Failed before fix | Page 1 showed job `1149` and a duplicated address; page 8 showed `$293,174.53`; page 14 showed the correct `$27,600.00`. |
| Source observation | Supplied Avita job screenshot | Failed before fix | UI showed canonical job number `26-127`; the PDF adapter did not query that column. |
| Contract comparison | Supplied `Commitment - Cooper Roofing.pdf` | Confirmed mapping | Filled reference shows Owner from the job/client context and a single Subcontractor notice block. |
| Focused tests | `cd frontend && pnpm.cmd exec jest src/lib/documents/__tests__/record-documents.unit.test.ts --runInBand` | Passed | 12 tests cover current amount, retainage, exclusive Client-to-Owner mapping, a blank Owner line when Client is unset, prime-contract-independent Contractor identity, canonical job number query, address behavior, forbidden sample content, required marker failure, and missing required inputs. |
| Independent review | Commitment PDF review agent | Passed after fixes | Final re-review found no remaining actionable findings and confirmed no-prime Contractor fallback/override behavior, Owner/Subcontractor mapping, current rendered proof, and fail-loud guards. |
| Verification contract | `docs/ops/verification/2026-07-28-commitment-pdf-template-corrections.manifest.json` and `.result.json` | Pass | High-risk claims are bound to rendered-page, negative-path, regression, action-log, and independent-review evidence. |
| Focused lint | `cd frontend && npx.cmd eslint src/lib/documents/record-documents.ts src/lib/documents/__tests__/record-documents.unit.test.ts` | Passed with warnings | Zero errors; six pre-existing `no-explicit-any` warnings remain in the large shared source file. |
| Diff hygiene | `git diff --check -- <four task-owned files>` | Passed | No whitespace errors. |
| Current missing-Owner rendered proof | `docs/ops/verification/2026-07-28-commitment-pdf-template-corrections-rendered-contact-sheet.png` | Passed visual inspection | Current revision shows a clean blank Owner line, Alleato as Contractor with `8383 Craig Street, Suite 150, Indianapolis IN 46250`, one Americast Subcontractor notice, and the correct Avita project/job/address without Client or prime-contract fixtures. |
| Bounded typecheck | `cd frontend && node scripts/run-typecheck-bounded.mjs` | Timed out | Existing frontend full-program typecheck exceeded 300 seconds; the bounded script identified the admitted generated/app surface as the known owner. |

## Remaining Risk

- The Avita project Client is still unset, so the generated contract intentionally leaves the Owner line blank for later completion.
- The correct Client should still be selected before final contract execution, but it no longer blocks drafting or PDF download.

## Final Status

- [x] All implementation checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred live regeneration names the cause, prevention, owner, and next action.
