# Task: Commitment Change Order PDF Parity

Status: In Progress
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-899 - https://linear.app/megankharrison/issue/AAI-899/match-commitment-change-order-pdf-export-to-procore-content-with
Related Handoff: N/A

## Objective

Update the commitment change order PDF export so the existing download route
matches the substantive content of the provided Procore subcontract change order
export while keeping Alleato letterhead/branding and merging live commitment CO
data from the linked commitment.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Canonical commitment CCO PDF route enriched with all required merge data.
- [x] PDF template updated to include Procore-parity sections using Alleato branding.
- [x] Attachment names, signer metadata, and contract-sum math sourced from live linked records.
- [x] User-facing export fails loudly when required scoped data cannot be loaded.

## Integration Checklist

- [x] Existing CCO detail-page download action continues using the same endpoint.
- [x] Export data comes from the scoped change order + linked commitment + linked attachments.
- [x] No parallel PDF/export path is introduced.
- [x] Filename and response headers remain valid attachment downloads.

## Regression Guardrails

- [x] Targeted test added or updated for the export data/template contract.
- [x] Targeted lint/test checks run for changed files.
- [x] Sample export text verified against expected parity fields.

## Verification Checklist

- [x] Static/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] The PDF includes vendor/company block, project block, workflow metadata, description, attachments, line items, contract sum math, and signature areas comparable to the Procore sample.
- [x] The PDF keeps Alleato branding/letterhead instead of Procore branding.
- [x] All rendered fields merge from the exported commitment CO and its linked commitment/company records, not hard-coded sample values.
- [x] Missing optional data renders as explicit blanks/placeholders instead of silently dropping sections.
- [x] The current detail-page `Download PDF` action works without route changes.

## Files Changed

- `frontend/src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/pdf/route.ts` - canonical export route and data loading.
- `frontend/src/lib/change-orders/commitment-change-order-pdf.ts` - shared scoped data loading + artifact assembly for the PDF route.
- `frontend/src/lib/commitment-co-pdf.ts` - commitment CCO PDF template and formatting helpers.
- `docs/ops/tasks/2026-07-02-commitment-change-order-pdf-parity.md` - task definition and evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Linear kickoff | `AAI-899` | Pass | Issue created before code edits. |
| Task template gate | `docs/ops/tasks/TASK-TEMPLATE.md` | Process gap | Referenced template path is absent in repo; this task mirrors the active `docs/ops/tasks/*` format. |
| Static/lint | `cd frontend && npx eslint 'src/app/api/projects/[projectId]/commitment-change-orders/[commitmentCoId]/pdf/route.ts' 'src/lib/change-orders/commitment-change-order-pdf.ts' 'src/lib/commitment-co-pdf.ts' 'src/lib/__tests__/commitment-co-pdf.unit.test.ts'` | Pass | No lint errors on touched export files. |
| Targeted tests | `cd frontend && npx jest --runInBand 'src/lib/__tests__/commitment-co-pdf.unit.test.ts'` | Pass | Covers Procore-parity sections, Alleato branding, and explicit placeholder rendering. |
| Render proof | `cd frontend && npx tsx ... > /tmp/commitment-co-parity-sample.pdf` plus `pdftotext /tmp/commitment-co-parity-sample.pdf -` | Pass | Rendered the updated template to a real PDF and verified extracted text includes contract company, workflow metadata, attachments, line items, contract-sum math, and signature sections. |
| Unrelated repo state | `git status --short` | Warning | Checkout contains broad unrelated dirt and conflicts outside this task, including `UU frontend/src/app/(admin)/feedback-inbox/page.tsx`; no unrelated files were modified for this task. |

## Risks / Gaps

- Exact signature labels/placement may need one follow-up polish pass if browser/PDF rendering differs from extracted sample text.
- The current detail page UI does not expose every PDF field; this task reads from the canonical database/view layer instead of mirroring page state.
