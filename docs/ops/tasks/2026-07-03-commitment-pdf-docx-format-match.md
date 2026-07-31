# Task: Commitment PDF DOCX Format Match

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-918 - https://linear.app/megankharrison/issue/AAI-918/match-commitment-subcontract-pdf-export-to-canonical-docx-template
Related Handoff: N/A

## Objective

Use `/Users/meganharrison/Downloads/Alleato_Construction_Subcontract_Reformatted (1).docx` as the canonical formatting source for the commitment subcontract PDF export driven by the document-center commitment route, with specific focus on font family, font size, paragraph spacing, and legal-document text rhythm.

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
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing output follows the provided template source of truth.

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
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [ ] Commitment document-center PDF uses the commitment contract template path, not an unused export path.
- [x] The contract body renders in Times New Roman or the closest explicitly controlled Times-family fallback supported by the renderer.
- [x] Core body paragraphs render at 12pt with approximately 1.15 line spacing and visible 6pt paragraph spacing after, matching the supplied DOCX.
- [x] The centered title and recital headings follow the supplied DOCX hierarchy more closely than the current export.
- [x] The branded wrapper no longer silently overrides the contract template into Helvetica/Arial.
- [x] Proof artifacts show the updated commitment PDF against the supplied DOCX-derived reference.

## Files Expected To Change

- `frontend/src/lib/documents/branded-letterhead.ts`
- `frontend/src/lib/documents/record-documents.ts`
- `frontend/src/lib/documents/templates/commitment-subcontract-template.html`
- `frontend/src/lib/documents/__tests__/record-documents.unit.test.ts`
- `docs/ops/tasks/2026-07-03-commitment-pdf-docx-format-match.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| DOCX style baseline | `unzip -p '/Users/meganharrison/Downloads/Alleato_Construction_Subcontract_Reformatted (1).docx' word/styles.xml` and `word/document.xml` | Pass | Confirmed Times New Roman body text, 12pt core text, about 1.15 line spacing, and 6pt after spacing. |
| Root cause read-back | `rg -n 'contract-template|Helvetica Neue|Arial' frontend/src/lib/documents/branded-letterhead.ts` | Pass | Confirmed wrapper-level sans-serif override on the commitment contract template. |
| Targeted Jest | `cd frontend && ./node_modules/.bin/jest --runInBand 'src/lib/documents/__tests__/record-documents.unit.test.ts'` | Pass | Updated guardrail asserts the contract HTML keeps the Times-family stack, 12pt body, and 6.5in content width. |
| Targeted lint | `cd frontend && ./node_modules/.bin/eslint 'src/lib/documents/branded-letterhead.ts' 'src/lib/documents/record-documents.ts' 'src/lib/documents/__tests__/record-documents.unit.test.ts'` | Pass with warnings | No errors. Remaining warnings are pre-existing `no-explicit-any` debt in `frontend/src/lib/documents/record-documents.ts`. |
| Actual record PDF render | `cd frontend && set -a && source .env.local && set +a && ./node_modules/.bin/tsx ... getDocumentBundle(... 'commitment', '370ccdd2-4f9e-404a-84ec-21c4f2403658') ...` | Pass | Rendered `/tmp/commitment-docx-format-match.pdf` from the real commitment bundle. |
| PDF font read-back | `pdffonts /tmp/commitment-docx-format-match.pdf` | Pass | PDF embeds `TimesNewRomanPSMT` and `TimesNewRomanPS-BoldMT`, proving the export is no longer falling back to sans serif for the contract body. |
| PDF page proof | `docs/ops/evidence/2026-07-03-commitment-pdf-docx-format-match/commitment-docx-format-match-page-1.png` | Pass | First-page render shows legal-document serif typography and tighter paragraph rhythm on the actual commitment PDF output. |
| DOCX reference render | `python render_docx.py '/Users/meganharrison/Downloads/Alleato_Construction_Subcontract_Reformatted (1).docx' --output_dir docs/ops/evidence/2026-07-03-commitment-pdf-docx-format-match/docx-render` | Pass | Source DOCX first-page render captured for side-by-side comparison against the PDF output. |

## Risks / Gaps

- Exact Times New Roman embedding on serverless infrastructure may require explicit fallback handling if the font is unavailable at runtime.
- If the supplied DOCX contains structural content differences beyond typography, a pure CSS/wrapper fix may not fully match the source without template HTML updates.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
