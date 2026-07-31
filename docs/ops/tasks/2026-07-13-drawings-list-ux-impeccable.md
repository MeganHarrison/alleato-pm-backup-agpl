# Task: Drawings List UX Impeccable Pass

Status: Complete
Owner: Codex
Created: 2026-07-13
Linear Issue: Blocked - Linear connector reauthentication is required (`oauth_token_invalid_grant`).
Related Handoff: `docs/ops/handoffs/2026-07-13-S130-drawings-list-ux-impeccable.md`

## Objective

Improve the exact project drawings list at `/67/drawings` so finding and
opening the correct sheet remains the dominant workflow on desktop and mobile.

## Design Doctrine Gate

Surface: project drawings log
One purpose: find, inspect, and open the correct project drawing
Primary user job: scan drawing identity and preview, search or filter, then open the sheet
Primary action: Upload
Secondary actions: scan for submittals, subscribe, reports, locations, export, view settings
Next action after success: open the selected drawing in the canonical viewer
Correction path: edit drawing metadata from the drawing action menu
Keyboard path: tab to Upload, More actions, view controls, search, filters, and drawing records
Information that belongs elsewhere: unfinished report placeholders and explanatory header copy
Blessed pattern: UnifiedTablePage with Pattern C compact action menu
Complexity budget: one primary header action plus one compact overflow menu; no nonfunctional commands
Pass/fail: Fail before implementation; mobile header collapses the title and description into unusable columns

## Attention Brief

Primary user: project manager or field operator
Primary job: find and open the correct drawing quickly
Primary decision: which sheet is the current relevant drawing
Tier 1: drawing number, title, preview, search, filters, Upload
Tier 2: drawing set navigation, layout choice, drawing row actions
Tier 3: scan for submittals, subscription state, export, revision report, locations
Hide until requested: reports, locations, subscription command
Remove: generic description and unfinished Sketches, Measurements, and Compare Set commands
Primary action: Upload
Failure-loudly behavior: unavailable workflows are absent; API mutations keep explicit error feedback

## Done Checklist

- [x] Exact production route inspected at desktop and mobile widths before edits.
- [x] Root cause established from browser evidence and owning code.
- [x] Header preserves a readable title and one primary action on mobile.
- [x] Secondary actions use a compact, functional overflow menu.
- [x] Nonfunctional menu commands and redundant description are removed.
- [x] Drawing cards expose number and title without relying on hover.
- [x] Drawing-card actions remain reachable by touch and keyboard.
- [x] Focused regression coverage protects mobile action visibility and drawing identity.
- [x] Impeccable complexity audit and targeted lint/tests pass.
- [x] Exact route is browser-verified at desktop and mobile widths with evidence.
- [x] Evidence and closeout status are recorded below.

## Files Expected To Change

- `frontend/src/app/(main)/[projectId]/drawings/page.tsx`
- `frontend/src/features/drawings/drawings-table-config.tsx`
- `frontend/src/features/drawings/__tests__/drawings-table-config.unit.test.ts`
- `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/**`
- `docs/ops/handoffs/2026-07-13-S130-drawings-list-ux-impeccable.md`
- `docs/ops/orchestration/session-board.md`

## Evidence

| Check | Command / Artifact | Result | Notes |
| --- | --- | --- | --- |
| Production desktop baseline | `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/before-desktop.png` | Pass | Captured authenticated `/67/drawings` at 1440px. |
| Production mobile baseline | `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/before-mobile.png` | Fail | At 375px, title collapses to `D.` and description wraps one word per line. |
| Linear kickoff | Linear `list_teams` connector call | Blocked | Connector returned `oauth_token_invalid_grant`; reauthentication required. |
| Surface complexity | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass | Both changed UI files pass. |
| Targeted lint | `pnpm --dir frontend exec eslint ...` | Pass with 2 existing warnings | No errors; existing raw-grid warnings are in untouched dialog form grids. |
| Drawing config regression | `pnpm --dir frontend exec jest --runTestsByPath src/features/drawings/__tests__/drawings-table-config.unit.test.ts --runInBand` | Pass | 4 tests passed, including drawing identity and no-hover action guardrail. |
| Changed-file type guard | `pnpm --dir frontend run typecheck:changed` | Pass | No new `any` type debt detected. |
| Isolated preview deployment | `vercel deploy --yes --scope the-alleato-group` from task-only detached worktree | Pass | Preview `dpl_9nijMceSTzXpV8dy5SLFH1wC6Sup` reached Ready; build completed successfully. |
| Desktop after-state | `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/after-desktop.png` | Pass | One primary Upload action, compact overflow, quieter header, and number-plus-title card identity verified at 1440px. |
| Mobile after-state | `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/after-mobile.png` | Pass | Full Drawings title, compact action group, sheet number/title, visible selection, and visible card menu verified at 375px. |
| Mobile secondary menu | `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/after-mobile-secondary-menu.png` | Pass | Only Scan for submittals, subscription, revisions, and locations remain. |
| Mobile card actions | `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/after-mobile-card-actions.png` | Pass | Edit, QR Code, and Delete are reachable without hover. |
| Keyboard path | Focus More drawing actions, press Enter | Pass | Compact menu opened and exposed all four commands. |
| Preview protection cleanup | Vercel protection read-back after browser proof | Pass | Short-lived automation bypass was removed; zero automation bypass tokens remain. |
| Shared-checkout finish attempt | `npm run codex:finish -- --message "Improve drawings list UX" --staged-only` | Blocked by unrelated debt | Route check, ESLint debt, and changed-file type guard passed; unsafe-pattern guard found pre-existing issues in `prp-status`, `ingestion-feed`, `VeltGlobalLayer`, and `portfolio-synthesis-brief`, none owned by S130. |
| Clean finish and publish | `npm run codex:finish -- --message "Improve drawings list UX" --staged-only` from an isolated task-only clone | Pass | Commit `9a8372ace` published to `origin/main`; local and remote commit SHAs match. |
| Production deployment | `vercel inspect https://project-management-agent-8k5zhqnzw-the-alleato-group.vercel.app --scope the-alleato-group` | Pass | Deployment `dpl_GsyvawAM6L5YEBLYBDFpQygZkv39` is Ready and aliases `https://projects.alleatogroup.com`. |
| Production desktop after-state | `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/production-desktop.png` | Pass | Authenticated exact route verified at 1440px. |
| Production mobile after-state | `docs/ops/evidence/2026-07-13-drawings-ux-impeccable/production-mobile.png` | Pass | Exact route verified at 375px with full title, compact actions, drawing identity, and no horizontal overflow (`375px == 375px`). |
| Production mobile menus | `production-mobile-secondary-menu.png`, `production-mobile-card-actions.png` | Pass | Keyboard-opened page overflow exposes four working commands; touch-opened card menu exposes Edit, QR Code, and Delete. |

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Remaining risks and next action are explicit.

## Noise Gate Closeout

Noise gate: Pass
Top noise sources: four competing header controls, generic descriptive copy, and unfinished report commands
Removed or simplified: description removed; header reduced to Upload plus overflow; three unfinished commands removed; selected actions consolidated
Remaining risk: long drawing titles intentionally truncate in the grid and remain available through the accessible card name and canonical viewer
Regression guardrail: focused static-render test requires number, title, action label, and mobile-visible action classes
