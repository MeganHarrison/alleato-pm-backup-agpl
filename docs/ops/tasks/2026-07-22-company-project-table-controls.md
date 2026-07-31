# Task: Align Company Project Table Controls

Status: Ready for publication
Owner: SROOT-COMPANY-PROJECT-TABLE-0722
Created: 2026-07-22
Task ID: COMPANY-PROJECT-TABLE-CONTROLS
Linear Issue: Unavailable: no Linear connector is callable in this session.
Related Handoff: N/A (single-session scoped change)

## Objective

Make the Company project list use the shared unified table composition: scope tabs and table controls occupy one responsive row, and the create-project action remains fully visible.

## Scope

- `frontend/src/app/(main)/page.tsx` and its focused regression contract.
- Verification manifest and local visual evidence under `docs/ops/`.
- Reuse `UnifiedTablePage` and its `toolbarWithTabs` layout option. No page-local toolbar or header component.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/(main)/page.tsx`.
- Shared primitives: `frontend/src/components/tables/unified/unified-table-page.tsx`, `frontend/src/components/tables/unified/table-toolbar.tsx`, and `frontend/src/components/layout/page-header-unified.tsx`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] Scope tabs and table controls share one responsive row through the explicit `UnifiedTablePage` tabs-row layout mode.
- [x] The create-project action has a readable desktop label and a touch-safe compact mobile treatment without clipping.
- [x] Existing table actions, filters, and views remain available through `UnifiedTablePage`.
- [x] Desktop and mobile screenshots prove the canonical page state.

## Implementation Checklist

- [x] Files/modules are named before edits.
- [x] Existing shared abstraction owns the layout behavior.
- [x] The root cause is addressed without page-local layout duplication.

## Integration and Verification

- [x] Targeted static check passes.
- [x] Actual browser flow proves the requested layout.
- [x] Evidence artifacts are recorded.
- [x] Task-owned files will be published through the required `codex:finish` main-branch flow.

## Failure-Loudly Contract

- Cause surfaced as: the UI test asserts that the shared `toolbarWithTabs` composition and an unconstrained primary button are present.
- Detection path: targeted source contract plus desktop and mobile browser screenshots.
- Recovery path: restore the shared `UnifiedTablePage` layout property or correct its shared responsive contract, never add page-local control placement.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: The page opted out of `UnifiedTablePage`'s tab-toolbar composition and its primary action set mutually exclusive fixed-width and visible-label styles.
- Detection gap: No responsive visual regression check covered the Company table header.
- Prevention: Use the shared layout flag and retain a source-level regression assertion.
- Guardrail evidence: Targeted unit/source contract and browser screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | User-supplied production screenshot | Pass | Controls are separated from tabs; New Project label is clipped. |
| Local visual localization | `/tmp/company-project-table-evidence/company-project-table-desktop.png` | Pass | The first pass showed the default header-inline flag overriding the requested tab-row mode. |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Regression contract | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/(main)/__tests__/project-table-layout.test.ts'` | Pass | 2 assertions pass. |
| Targeted lint | `cd frontend && npx eslint 'src/app/(main)/page.tsx' 'src/app/(main)/__tests__/project-table-layout.test.ts'` | Pass with pre-existing warnings | 5 warnings in the pre-existing page, none from this change. |
| Alleato audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs 'frontend/src/app/(main)/page.tsx'` | Pass | No complexity-budget violation. |
| Browser desktop | `/tmp/company-project-table-evidence/company-project-table-desktop.png` | Pass | 1440px, tabs and controls share one row; primary action is visible. |
| Browser mobile | `/tmp/company-project-table-evidence/company-project-table-mobile.png` | Pass | 375px, controls collapse into the shared settings trigger and create is touch-safe. |
| Responsive widths | `agent-browser` layout readback at 375, 414, 768, 1024, and 1440px | Pass | No horizontal overflow at any required width. |
| Independent review | `docs/ops/evidence/2026-07-22-company-project-table-controls/independent-review.md` | Approved | Separate reviewer found no blocking defects. |
| Verification contract | Manifest and result in the scoped task evidence | Pass | Observable claims and artifacts are bound to the task ID. |

## Remaining Risk

- Existing unrelated lint warnings remain in `frontend/src/app/(main)/page.tsx` at lines 314, 524, 564, 1004, and 1032. They predate this layout change and require separate API/design cleanup ownership.

## Final Status

- [x] All required checklist items are complete, pending the atomic main-branch publication command.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A with a prevention plan.
