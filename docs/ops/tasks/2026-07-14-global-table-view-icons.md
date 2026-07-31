# Task: Global Table View and Document Browser Template

Status: Complete
Owner: Codex
Created: 2026-07-14
Task ID: LOCAL-2026-07-14-global-table-view-icons
Linear Issue: Unavailable — no Linear connector is exposed in this session.
Related Handoff: N/A

## Objective

Give UnifiedTablePage a compact shared view/filter control with accessible
labels, keep the documents page controls in the title row with Upload at the
far right, and make the full-height documents browser a reusable page template.

## Scope

- Shared `ViewSwitcher` default and `UnifiedTablePage` header/toolbar composition.
- Shared document browser shell for desktop/mobile sidebar, content, and preview.
- Documents page layout configuration and regression coverage.
- Global `/documents` route must consume the same canonical documents-browser
  consumer as project documents; only the data definition/query scope differs.
- The shared browser shell must defer the side-by-side viewer until `lg`; at
  narrower widths the selected document opens as a full-screen viewer.
- Shared table filters and layout controls must use one compact, border-light
  popover with smaller labels and aligned date controls.
- Shared Velt comment polish must not inject the deprecated GitHub-issue toggle
  into page comments.
- Excludes redesigning page-specific toolbar actions or non-UnifiedTablePage tables.

## Source of Truth

- Canonical runtime owner: `frontend/src/components/tables/unified/`.
- Existing shared primitives: `ViewSwitcher`, `TableToolbar`, `PageHeader`, and the new document browser shell.
- Deprecated or parallel paths: page-local view switchers are out of scope.

Verification contract: Required

## Acceptance Criteria

- [x] UnifiedTablePage exposes view selection inside the shared filter/settings popover.
- [x] View controls retain accessible names and hover tooltips.
- [x] Documents title, view controls, and Upload render in one row with Upload last.
- [x] Existing table pages retain functional view changes and toolbar actions.
- [x] Project and global documents use the reusable page template rather than owning split-layout markup.
- [x] Project and global documents render the same Smart Groups rail, cards, toolbar, preview, and responsive browser structure.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns global icon-only behavior.
- [x] Shared browser-shell abstraction owns reusable split layout behavior.
- [x] Global `/documents` consumes the shared browser-shell abstraction.
- [x] Narrow document layouts use the full-screen viewer breakpoint.
- [x] Shared filter popover contains layout selection and compact filter rows.
- [x] Documents page uses the shared inline header pattern.
- [x] Regression tests cover view selection and shared browser behavior.
- [x] Shared Velt comment surfaces no longer inject the deprecated issue toggle.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Browser verification proves the documents row layout and icon tooltips.
- [x] Evidence artifacts are recorded.
- [x] Browser verification proves the deprecated Velt issue toggle is absent.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: view controls remain visible as labeled tabs or overflow out of the title row.
- Detection path: shared ViewSwitcher unit test and authenticated browser inspection.
- Recovery path: revert to the shared default display or pass an explicit display mode for an exceptional page.
- Velt overlay cause surfaced as: the shared dialog-polish observer injected a
  custom issue-toggle button into every eligible comment composer.
- Velt detection path: focused polish test plus live DOM query for the legacy
  selector and user-facing labels.
- Velt recovery path: restore the vendor comment surface without the removed
  custom control; GitHub issue submission remains selected by the feedback
  context.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: View mode, filters, and document browser layout had drifted across separate local controls and route consumers; the first global consumer reused only the outer shell and omitted the project browser’s rail/card configuration.
- Detection gap: No contract required both routes to use the same canonical browser consumer, so a visually similar but incomplete global wrapper passed review.
- Prevention: `ProjectDocumentsBrowser` is now the canonical consumer for both routes, with only `forcedProjectId` and the corresponding data/count query varying by scope.
- Guardrail evidence: `tests/agent-browser-runs/2026-07-14-document-browser-template/result.json`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Passed | Scope and verification contract captured before implementation. |
| Shared shell lint | `pnpm --dir frontend exec eslint --no-cache src/features/documents/document-browser-shell.tsx src/features/documents/project-documents-browser.tsx` | Passed | Reusable browser shell and current consumer. |
| Focused tests | `npx jest --runInBand src/components/tables/unified/__tests__/table-toolbar-view-switcher.test.tsx src/components/tables/unified/__tests__/unified-table-page.test.ts src/features/documents/__tests__/documents-table-config.test.tsx src/features/documents/__tests__/use-resizable-split.test.ts` | 16 passed | Shared table, toolbar, document link, and split regressions. |
| Browser proof | `/tmp/reusable-document-browser.png` | Passed | Authenticated local route exposes icon view tabs, Upload, and the split shell. |
| Velt focused tests | `npx jest --runInBand src/components/velt/__tests__/velt-dialog-polish.test.ts src/components/velt/__tests__/VeltGlobalLayer.test.tsx` | 8 passed | Shared comment polish no longer creates the issue toggle. |
| Velt lint | `npx eslint src/components/velt/VeltGlobalLayer.tsx src/components/velt/velt-dialog-polish.ts src/components/velt/__tests__/VeltGlobalLayer.test.tsx src/components/velt/__tests__/velt-dialog-polish.test.ts` | Passed | No lint errors. |
| Velt browser proof | `agent-browser eval ...` on `http://localhost:3001/67/documents` | Passed | `toggleCount=0`, `createsIssue=false`, `internalLabel=false`. |
| Smart-group rail token check | `npx eslint src/features/documents/smart-group-rail.tsx` plus live computed-style check | Passed | Rail and mobile pills use `bg-background`; live rail resolves to the semantic background token. |
| Global documents browser | `agent-browser eval ...` on `http://localhost:3001/documents` | Passed | Shared shell mounted, preview pane visible, and first loaded document selected automatically. Screenshot: `/tmp/global-documents-browser.png`. |
| Project/global template parity | Authenticated `agent-browser eval ...` on `http://localhost:3001/documents` and `http://localhost:3001/67/documents` | Passed | Both routes expose the same shell, Smart Groups rail, document card structure, and preview pane; only the route-scoped query differs. |
| Global consumer regressions | `npx jest --runInBand src/features/documents/__tests__/documents-table-config.test.tsx src/features/documents/__tests__/use-resizable-split.test.ts src/components/tables/unified/__tests__/unified-table-page.test.ts` | 14 passed | Global shell consumer preserves document links, split sizing, and shared table layout contracts. |
| Responsive browser proof | `agent-browser` at `900x1000` on `http://localhost:3001/67/documents` | Passed | Selected document opens in a fixed full-screen preview; resize separator is hidden; `Back to files` is available. |
| Filter/layout redesign | `/tmp/documents-filter-view-redesign.png` plus `npx jest --runInBand src/components/tables/unified/__tests__/table-toolbar-view-switcher.test.tsx` | Passed, 2 tests | Layout selection is consolidated into the filter menu; date filters use aligned compact controls without a heading divider. |

## Remaining Risk

- Existing unrelated lint warning: `frontend/src/components/tables/unified/table-toolbar.tsx:569` reports the repository's pre-existing raw numeric input debt.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
