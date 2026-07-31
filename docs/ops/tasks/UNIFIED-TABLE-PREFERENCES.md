# Task: Unified Table Preferences

Status: Complete
Owner: Codex
Created: 2026-07-29
Task ID: unified-table-preferences
Linear Issue: Not requested
Related Handoff: N/A

## Objective

Give every UnifiedTablePage one persistent row-count preference and a choice between page navigation and automatically continuing on scroll.

## Scope

- Shared unified-table state and pagination presentation only.
- Excludes legacy table implementations that do not use `UnifiedTablePage`.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/components/tables/unified/`
- Existing shared primitives/services: `use-unified-table-state.ts`, `unified-table-page.tsx`
- Deprecated or parallel paths: legacy `DataTable` variants, deferred because they are not UnifiedTablePage consumers.

Delivery lane: Standard

Verification contract: Optional

## Attention Brief

Primary user: A project manager working through long operational tables.
Primary job: Review table records without repeatedly operating page navigation.
Primary decision: Choose a reusable loading behavior and row count.
Tier 1: Rows and the selected loading behavior.
Tier 2: Row count selector.
Tier 3: Page navigation, only when selected.
Hide until requested: Column and filter settings remain in the existing toolbar.
Remove: No new wrapper, summary, or duplicate action.
Primary action: Select Pages or Continue on scroll.
Failure-loudly behavior: A storage failure is reported through the existing non-critical failure boundary; unsupported legacy tables stay visibly unchanged rather than pretending to have the shared preference.

## Acceptance Criteria

- [x] A row-count choice persists across UnifiedTablePage reloads and becomes the default on other unified tables unless the URL explicitly requests a row count.
- [x] Users can select Pages or Continue on scroll from the shared pagination footer.
- [x] Continue on scroll keeps earlier loaded rows visible before requesting the next server page.
- [x] Preference-storage failures use the shared non-critical reporting boundary.
- [ ] Legacy or duplicate paths are explicitly deferred.

## Implementation Checklist

- [x] Shared abstraction owns cross-cutting behavior.
- [x] Persistent preference helpers and state initialization are implemented.
- [x] Auto-load behavior is implemented in the shared table component.
- [x] Focused regression tests cover persistence and scroll pagination rules.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow readback localized the fault: `/directory/vendors` accepted `per_page=150` in its URL, while a clean visit used the route default and no global preference existed.
- [x] Evidence artifacts are recorded.
- [x] Task-owned files are published as exact remote-main paths at `6fc8241e38944f794e6a7f1f1052f256e2b7eb3a`.

## Failure-Loudly Contract

- Cause surfaced as: the existing non-critical failure reporter records the affected table and storage operation.
- Detection path: focused unit checks and the shared table footer after reload.
- Recovery path: the table continues with its safe default and the next preference selection retries persistence.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: Page-size ownership was split between a component-local `25` default and optional route-specific URL writes, with no global preference owner.
- Detection gap: Route-specific persistence masked the missing shared preference; a clean route visit exposed it.
- Prevention: One shared storage contract, focused regression tests, and no per-page persistence wiring.
- Guardrail evidence: Pending focused tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Authenticated `/directory/vendors` browser readback | Pass | `150` becomes `?per_page=150&page=1`; a clean route has no global stored value. |
| Focused unit test | `pnpm --dir frontend exec jest --runInBand --runTestsByPath src/components/tables/unified/__tests__/unified-table-page.test.ts` | Pass | 14 assertions, including persisted preferences and merged server-page rows. |
| Targeted TypeScript | Compiler API with roots restricted to the two shared table files | Unrelated failure | `src/components/ai-chat/sheet-editor.tsx:148` references a missing `setActivePosition`; no diagnostics in the changed table files. |
| UI proof, desktop | `/tmp/unified-table-continuous-desktop.png` | Pass | Authenticated `/directory/vendors`, 150 rows selected, Continue on scroll selected, 556 rows fully loaded. |
| UI proof, mobile | `/tmp/unified-table-continuous-mobile.png` | Pass | Authenticated `/directory/vendors` at 375px, compact footer retains the 150-row and continuous-scroll selections. |

## Remaining Risk

- Legacy tables outside UnifiedTablePage remain outside this shared contract; migrate them separately rather than creating duplicate preference code.

## Final Status

- [x] All required implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
