# Task: Reusable PDF Template Authoring Pipeline

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1005 - https://linear.app/megankharrison/issue/AAI-1005/build-reusable-pdf-template-authoring-pipeline
Related Handoff: N/A

## Objective

Replace the brittle, LibreOffice-exported HTML template used for the commitment subcontract PDF with a reusable semantic template authoring path so new PDF templates can be built from shared helpers instead of hand-edited raw HTML.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [ ] Database schema/types/migrations handled, if applicable.
- [ ] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [ ] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing output follows the provided template source of truth.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [ ] The commitment subcontract PDF template is authored through shared semantic template helpers rather than a raw LibreOffice export blob.
- [ ] Paragraphs, lists, tables, and signature/sign-off blocks use reusable template primitives.
- [ ] The commitment PDF output remains faithful to the current legal-document contract while becoming easier to maintain.
- [ ] The new authoring path is reusable for future PDF templates without duplicating layout logic.
- [ ] Regression tests cover the template helpers and the commitment render output.

## Files Expected To Change

- `frontend/src/lib/documents/record-documents.ts`
- `frontend/src/lib/documents/templates/commitment-subcontract-template.html`
- `frontend/src/lib/documents/templates/*` or a new shared PDF template helper module
- `frontend/src/lib/documents/__tests__/record-documents.unit.test.ts`
- `docs/ops/tasks/2026-07-07-pdf-template-authoring-pipeline.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Task setup | `docs/ops/tasks/2026-07-07-pdf-template-authoring-pipeline.md` | In progress | Working definition of done created before code changes. |
| Targeted Jest | `cd frontend && ./node_modules/.bin/jest --runInBand 'src/lib/documents/__tests__/legal-template-primitives.test.ts' 'src/lib/documents/__tests__/record-documents.unit.test.ts'` | Pass | Semantic template primitives and commitment render contract passed. |
| Targeted ESLint | `cd frontend && ./node_modules/.bin/eslint src/lib/documents/legal-template-primitives.ts src/lib/documents/record-documents.ts src/lib/documents/branded-letterhead.ts src/lib/documents/__tests__/legal-template-primitives.test.ts src/lib/documents/__tests__/record-documents.unit.test.ts` | Pass with warnings | Only pre-existing `no-explicit-any` warnings in `record-documents.ts`. |
| Live PDF render | `cd frontend && ./node_modules/.bin/tsx /tmp/render-commitment.ts` | Pass | Rendered the commitment fixture into `/tmp/aai1005-commitment.pdf` after migrating the signature rows to a fixed two-column grid so labels and underlines stay inside each signer column. |
| PDF evidence | `docs/ops/evidence/2026-07-07-pdf-template-authoring-pipeline/commitment-template-proof.pdf` | Pass | Rendered full PDF with the semantic clause run, isolated signature page, and Exhibit A blocks. |
| Signature page proof | `docs/ops/evidence/2026-07-07-pdf-template-authoring-pipeline/signature-page.png` | Pass | Signature execution block now sits on its own page and the field rows stay aligned within each signer column. |
| Exhibit A proof | `docs/ops/evidence/2026-07-07-pdf-template-authoring-pipeline/exhibit-a-page.png` | Pass | Exhibit A now renders from reusable table/list helpers. |

## Risks / Gaps

- The commitment template still starts from the legacy exported HTML shell, so the helper path is only partial until the remaining non-semantic wrapper content is migrated or replaced.
- If the reusable template primitives are too generic, the implementation can drift into a second ad hoc templating layer instead of simplifying the authoring path.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
