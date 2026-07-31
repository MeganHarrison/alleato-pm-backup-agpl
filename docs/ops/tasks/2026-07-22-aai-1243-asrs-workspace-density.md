# Task: Tighten the ASRS workspace header and table spacing

Status: Complete
Owner: Codex SROOT-ASRS-SUBTITLE / SROOT-ASRS-DENSITY
Created: 2026-07-22
Task ID: AAI-1243-SUBTITLE
Linear Issue: Not required for this micro-change; this task record was promoted by the implementation closeout gate.
Related Handoff: N/A — bounded micro-change in the canonical checkout.

## Objective

Remove the redundant FMDS revision subtitle from the ASRS Tables and Figures headers and make embedded table controls begin directly below the workspace tabs without duplicate container spacing.

## Scope

- ASRS Tables and Figures workspace headers.
- Shared `GenericConfigUnifiedTable` behavior when its header is intentionally hidden by an enclosing workspace.
- Explicit exclusion: ASRS Chat guidance, FMDS revision isolation, retrieval behavior, review statuses, and table data.

## Source of Truth

- Canonical runtime/data owner: ASRS route pages plus `GenericConfigUnifiedTable`.
- Existing shared primitives/services: `PageShell`, `PageHeader`, `PageTabs`, `UnifiedTablePage`, and `GenericConfigUnifiedTable`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] ASRS Tables and Figures do not render the redundant revision/status subtitle.
- [x] Table and figure controls begin with a compact, intentional gap below the workspace tabs.
- [x] Tables, filters, links, review state, and row navigation remain functional.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before the spacing implementation.
- [x] No duplicate page or table implementation is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before the shared spacing edit.
- [x] `frontend/src/app/(main)/asrs/tables/page.tsx` removes the subtitle.
- [x] `frontend/src/app/(main)/asrs/figures/page.tsx` removes the subtitle.
- [x] `frontend/src/components/tables/generic-config-unified-table.tsx` reuses the canonical embedded-table padding rule.
- [x] `frontend/src/components/layout/page-header-unified.tsx` makes the flush-tab contract win at desktop breakpoints.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Database, provider, authentication, permission, and delivery contracts are not affected.

## Integration and Verification

- [x] Targeted ESLint passes.
- [x] Impeccable surface-complexity audit passes.
- [x] Authenticated production readback proves the subtitle is absent and spacing is compact.
- [x] Production desktop and mobile screenshots are recorded.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the existing ASRS error message remains visible when table or figure data cannot load.
- Detection path: targeted lint/audit, production DOM text check, and canonical-route screenshot.
- Recovery path: use the existing actionable ASRS data-load error; this visual change does not suppress runtime errors.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: a header-hidden `UnifiedTablePage` retained its own default container padding, and the shared page header's `mb-0` did not override `PageTabs` responsive `md:mb-5` spacing.
- Detection gap: embedded table mode hid the duplicate title without selecting the canonical embedded wrapper, while the flush-tab call site omitted the breakpoint-specific zero margin.
- Prevention: route header-hidden generic tables through `EmbeddedUnifiedTablePage` and make the shared page-header flush contract explicit at the desktop breakpoint.
- Guardrail evidence: targeted lint, Impeccable audit, and authenticated production screenshot.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime observation | Browser annotation on `https://projects.alleatogroup.com/asrs/tables` | Fail before change | Visible blank band existed between the workspace tabs and table controls. The selected DOM boundary was the table content below the `PageShell` tabs. |
| Boundary localization | `PageShell` -> header-hidden `GenericConfigUnifiedTable` -> `UnifiedTablePage` | Confirmed | The outer shell owns the tabs/gutters while the nested table page still applies default container padding. |
| Subtitle static check | Targeted ESLint and source diff | Pass | Both ASRS sibling routes remove the redundant description prop. |
| Desktop DOM measurement | `agent-browser` on `http://localhost:3000/asrs/tables` | Pass | Tab wrapper margin is `0px`; gap from active tab bottom to toolbar text is 15.5 px. |
| Desktop screenshot | `/tmp/aai-1243-asrs-tables-tight-local.png` | Pass | Subtitle is absent; toolbar and table begin directly below tabs. |
| Figures screenshot | `/tmp/aai-1243-asrs-figures-tight-local.png` | Pass | Figures route retains 25 rendered rows and the subtitle is absent. |
| Mobile screenshot | `/tmp/aai-1243-asrs-tables-tight-mobile.png` | Pass | Tabs remain usable and table rows render as responsive cards. |
| Targeted lint | `npx eslint` on four task-owned TSX files | Pass | No errors or warnings. |
| Unified table unit test | `npm run test:unit -- --runInBand --runTestsByPath src/components/tables/unified/__tests__/unified-table-page.test.ts` | Pass | 10 tests passed. |
| Impeccable audit | `audit-surface-complexity.mjs` on four task-owned TSX files | Pass | All four surfaces passed. |
| Independent review | `/tmp/aai-1243-independent-review.md` | Pass | Faraday approved the desktop/mobile evidence, canonical primitive reuse, and retained table behavior. |
| Embedded layout publication | `27ec14d0f5ec09a3a6a3df2530ef2b79a6e59125` | Pass | Task record and `GenericConfigUnifiedTable` were published to `origin/main`. |
| Final publication | `57d699178dc9e2bd2cf2ae6127d548863a8ad001` | Pass | Shared desktop tab-spacing contract published to `origin/main`. |
| Production deployment | Vercel `dpl_5tS8zJo8TNqx4s6gCLSZqT1VDnWn` | Pass | Ready deployment cloned commit `57d6991` and owns `projects.alleatogroup.com`. |
| Production desktop readback | `/tmp/aai-1243-asrs-tables-production-desktop.png` | Pass | Subtitle absent; tab margin `0px`; tab-to-toolbar gap 15.5 px; 25 table rows rendered. |
| Production figures readback | `/tmp/aai-1243-asrs-figures-production-desktop.png` | Pass | Subtitle absent; Figures tab active; 25 figure rows rendered. |
| Production mobile readback | `/tmp/aai-1243-asrs-tables-production-mobile.png` | Pass | Tables tab active and responsive review cards remain usable at 390 x 844. |

## Remaining Risk

- None identified for this bounded visual cleanup.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] No deferred work is currently identified.
