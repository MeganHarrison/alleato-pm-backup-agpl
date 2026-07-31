# Task: Submittal Export Cover Sheet Parity

Status: In Progress
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-936 - https://linear.app/megankharrison/issue/AAI-936/match-submittal-export-cover-sheet-to-procore-and-add-selectable-cover
Related Handoff: N/A

## Objective

Make the single-submittal export from Alleato match the provided Procore cover-sheet content structure, use Alleato letterhead branding, and let the user export a combined PDF packet with an optional cover sheet plus selected submittal attachments from the submittal detail page.

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
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] The single-submittal cover sheet content matches the provided Procore export structure for distribution summary, key fields, workflow rows, attachments, and comments.
- [x] The rendered cover sheet uses the provided Alleato letterhead header/footer assets instead of the current generic logo treatment.
- [x] The submittal detail export control lets the user include `Cover Sheet` and selected attachments in one export action.
- [x] The export route merges selected PDF-compatible files into one PDF in the selected order.
- [x] Unsupported attachment selections fail with a specific actionable error instead of a silent partial export.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Reference PDF review | `pdftotext -layout /Users/meganharrison/Downloads/PROCORE-EXPORTS/PROCORE-SUBMITTAL-Export.pdf -` and rendered page screenshots | Pass | Confirmed the Procore export is a one-page cover sheet packet reference, distinct from the current Alleato export. |
| Targeted lint | `cd frontend && ./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/submittals/[submittalId]/pdf/route.ts' 'src/features/submittals/submittal-detail-client.tsx' 'src/features/submittals/submittal-export-popover.tsx' 'src/lib/submittals/export-packet.ts' 'src/lib/submittals/__tests__/export-packet.test.ts'` | Pass | No lint errors or warnings on the touched files after tightening the popover width to the design-system spacing scale. |
| Targeted Jest | `cd frontend && ./node_modules/.bin/jest --runInBand 'src/lib/submittals/__tests__/export-packet.test.ts'` | Pass | Added guardrails for default cover-sheet selection, ordered packet item parsing, supported MIME filtering, and export filename generation. |
| Merge smoke | `cd frontend && ./node_modules/.bin/tsx -e "import { PDFDocument } from 'pdf-lib'; import { mergeSubmittalExportPacket } from './src/lib/submittals/export-packet.ts'; void (async () => { const src = await PDFDocument.create(); src.addPage([612, 792]); const srcBytes = await src.save(); const merged = await mergeSubmittalExportPacket([{ fileName: 'cover-sheet.pdf', mimeType: 'application/pdf', bytes: srcBytes }]); const out = await PDFDocument.load(merged); console.log(JSON.stringify({ pages: out.getPageCount(), bytes: merged.length })); })();"` | Pass | Verified the new packet merge path returns a readable PDF document. |
| Route import smoke | `cd frontend && ./node_modules/.bin/tsx -e "import './src/app/api/projects/[projectId]/submittals/[submittalId]/pdf/route.ts'; console.log('route-import-ok');"` | Pass | Confirms the route module loads cleanly after the packet export rewrite. |
| Browser verification | Not run | Pending | The authenticated click-through export flow has not been re-proven in a live browser session yet. |

## Files Changed

- `docs/ops/tasks/2026-07-04-submittal-export-cover-sheet-parity.md` - Task ledger and verification plan.
- `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/pdf/route.ts` - Rebuilt the canonical single-submittal export route to generate the Procore-style cover sheet and merge selected packet attachments.
- `frontend/src/features/submittals/submittal-detail-client.tsx` - Replaced the old one-click PDF action with the packet export control.
- `frontend/src/features/submittals/submittal-export-popover.tsx` - Added the export selector UI for `Cover Sheet` plus chosen attachments.
- `frontend/src/lib/submittals/export-packet.ts` - Centralized packet item parsing, filename generation, MIME gating, and PDF merge behavior.
- `frontend/src/lib/submittals/__tests__/export-packet.test.ts` - Added packet helper regression coverage.
- `frontend/public/export-assets/submittal-cover-header.png` - Added the provided header asset for the branded cover sheet.
- `frontend/public/export-assets/submittal-cover-footer.png` - Added the provided footer asset for the branded cover sheet.
- `frontend/package.json` and `frontend/pnpm-lock.yaml` - Added `pdf-lib` for server-side packet merging.

## Risks / Gaps

- Packet merging depends on attachment MIME support; non-PDF/non-image attachments must fail loudly or use a separate flow.
- Browser proof still requires an authenticated export click-through on a real submittal detail page.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
