# Task: Commitment Contract Template And Letterhead

Status: Ready to Publish
Owner: Codex
Created: 2026-07-01
Linear Issue: Not created yet - GitHub issue #596 reopened for commitment contract template follow-up
Related Handoff: None

## Objective

Replace the current commitment PDF export with a contract-grade template that
matches the provided commitment source document, merges the correct commitment
and project fields, and renders with Alleato-branded letterhead for the live
commitment download workflow.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/lib/documents/record-documents.ts src/lib/documents/__tests__/record-documents.unit.test.ts src/lib/documents/branded-letterhead.ts 'src/app/api/document-center/[recordType]/[recordId]/pdf/route.ts' 'src/app/api/document-center/[recordType]/[recordId]/email/route.ts' 'src/app/api/document-center/[recordType]/[recordId]/pdf/__tests__/route.unit.test.ts'` | Pass with warnings | Existing `@typescript-eslint/no-explicit-any` warnings only in `frontend/src/lib/documents/record-documents.ts` lines 397, 416, 1697, 1734, 1736, 1742. No lint errors. |
| Targeted tests        | `cd frontend && npx jest --runInBand 'src/lib/documents/__tests__/record-documents.unit.test.ts'` and `cd frontend && npx jest --runInBand --runTestsByPath 'src/app/api/document-center/[recordType]/[recordId]/pdf/__tests__/route.unit.test.ts' 'src/lib/__tests__/browser-download.unit.test.ts'` | Pass | Verified contract template merge HTML, bearer-token download helper behavior, and document-center PDF route behavior. |
| Browser/user-flow     | Playwright download verification to `/tmp/commitment-ui-download.pdf` and `/tmp/progress-ui-download.pdf` from live routes `/876/commitments/370ccdd2-4f9e-404a-84ec-21c4f2403658` and `/876/progress-reports/e3e0d19c-4739-44f0-bee9-91ddebeaca0b` | Pass | Confirmed both page-level Download PDF actions completed without toast failures and saved valid PDF files. |
| DB/provider read-back | Live Supabase read-back via service-role-backed verification script | Pass | Confirmed actual commitment/project/company data used for merge, including project `Exol Morrisville`, job `26-116`, vendor `R.J. Skelding Co, Inc`, owner `Greenbox Systems LLC`, and contractor signer `Brandon Clymer / CEO`. |
| End-to-end proof      | `cd frontend && set -a && source .env.local && set +a && npx tsx - <<'TS' ... writeFileSync('/tmp/commitment-000109.pdf', pdf) ... TS` plus `pdfinfo /tmp/commitment-000109.pdf` and `pdftotext /tmp/commitment-000109.pdf - | rg ...` | Pass | Produced a valid 17-page PDF (`/tmp/commitment-000109.pdf`) and verified no leftover `Deem`, `Goodwill`, `Bart`, `Fishers`, or other sample-project text remained. |
| Follow-up live route proof | Refreshed Megan auth session and hit live PDF endpoints plus UI-triggered downloads, yielding `/tmp/commitment-live.pdf`, `/tmp/progress-live.pdf`, `/tmp/commitment-ui-download.pdf`, and `/tmp/progress-ui-download.pdf` | Pass | Root cause was stale-cookie-only API auth on download routes plus user-scoped commitment bundle reads; both commitment and progress-report downloads now return valid PDFs from the live local app. |

## Files Changed

- `frontend/src/lib/documents/record-documents.ts` - source bundle and contract HTML generation
- `frontend/src/lib/documents/pdf.ts` - shared PDF renderer behavior if needed for letterhead/template support
- `frontend/src/app/api/document-center/[recordType]/[recordId]/pdf/route.ts` - commitment contract download route behavior if needed
- `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx` - commitment entry point if UX copy/action needs adjustment
- `frontend/storybook-static/Alleato-Group-Logo_Dark.png` - provided brand asset reference only

## Risks / Gaps

- Exact contract field mapping depends on correct extraction of the provided DOCX/PDF source template.
- If the source template includes clauses not represented in current commitment/project fields, the missing data source must be called out explicitly rather than guessed.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
