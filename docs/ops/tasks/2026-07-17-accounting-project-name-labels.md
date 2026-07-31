# Task: Show human project names in Accounting charts

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: AAI-1149
Linear Issue: [AAI-1149](https://linear.app/megankharrison/issue/AAI-1149/show-human-project-names-in-accounting-charts)
Related Handoff: `docs/ops/handoffs/2026-07-17-S192-accounting-project-name-labels.md`

## Objective

Make every visible project label in the canonical `/accounting` AR and AP charts use a human project name instead of an internal project code or database identifier.

## Scope

- Owned surface: project labels in the Accounting AR, AP, and sibling project-revenue chart mappings; removal of the redundant page description and Acumatica sync explanation; the reusable project display-name contract; design guidance; focused tests; exact-route evidence.
- Files/modules planned before edits: `frontend/src/app/(admin)/accounting/page.tsx`, `frontend/src/lib/projects/project-display-name.ts`, focused tests under the matching `__tests__` owners, `DESIGN.md`, task/evidence/control-plane files, and the canonical generated project/system-map artifacts required by the pre-commit guardrail.
- Explicit exclusion: Accounting aggregation, Acumatica sync, project records, database schema, financial totals, chart ordering, and non-project identifiers used in explicit admin/developer diagnostics.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(admin)/accounting/page.tsx` consuming project descriptions from `/api/accounting/dashboard`.
- Existing shared primitives/services: the shared `ProjectBalanceBarChart`, Recharts tooltip/axis contracts, Accounting dashboard response `description`, and existing error/Retry flow.
- Deprecated or parallel paths: raw project codes and database IDs are not valid human-facing label fallbacks.

Verification contract: Required

## Surface Gate

- Surface: Financial Position charts on `/accounting` plus the sibling Revenue by Project chart.
- One purpose: let accounting and leadership recognize the project carrying each balance.
- Primary user job: identify the project that needs financial follow-up.
- Primary action: open the canonical invoice, bill, or project financial report.
- Secondary actions: compare balances and inspect the full project name/customer/value in the tooltip.
- Next action after success: continue into the linked ledger.
- Correction path: source project names are corrected in Acumatica; missing names surface as `Unnamed project`, never as a raw identifier.
- Keyboard path: existing semantic links remain keyboard accessible; visible names do not rely on tooltip-only recognition.
- Information that belongs elsewhere: internal project codes and database IDs belong in explicit technical/admin contexts, not primary Accounting labels.
- Blessed pattern: existing quiet Accounting Recharts modules, with one shared human-label mapping.
- Complexity budget: no new cards, controls, badges, or sections; only a data-label correction and readable truncation.
- Pass/fail: AR and AP visibly use names, no numeric code-only label remains, full names are recoverable, and responsive layouts do not overflow.

## Noise Gate

- Primary user: accounting operators and company leadership.
- Primary job: recognize project-level cash exposure.
- Primary decision: which named project needs AR or AP follow-up.
- Tier 1: human project name and balance.
- Tier 2: total outstanding and represented project count.
- Tier 3: customer and exact amount in the tooltip.
- Hide until requested: row-level ledger detail and technical identifiers.
- Remove: project codes from primary chart labels and tooltips, the page-purpose sentence that restates the dashboard, and the Acumatica/on-hold sentence already represented by the visual content and Needs attention list.
- Primary action: open the relevant canonical ledger.
- Failure-loudly behavior: missing names become explicit `Unnamed project` or `Unassigned` labels; focused tests reject any return to code-based axis mappings.

## Acceptance Criteria

- [x] AR by Project uses a human project name for every visible label.
- [x] AP by Project uses the same name-first contract.
- [x] Full project names remain available in tooltips while compact labels stay readable.
- [x] Missing names display `Unnamed project` or `Unassigned`, never raw IDs/codes.
- [x] The sibling Revenue by Project chart follows the same project-label contract.
- [x] `DESIGN.md` documents the global rule that primary human-facing entity labels never expose internal IDs/codes.
- [x] Desktop and mobile evidence proves no code-only labels and no horizontal overflow.
- [x] The redundant page description is absent from the exact route.
- [x] The Acumatica/on-hold explanatory sentence is absent while the Needs attention signal remains.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] No duplicate route, data owner, or chart primitive is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns the cross-cutting display-name behavior.
- [x] Errors and fallbacks are specific and human-readable.
- [x] Database, provider, authentication, permission, and delivery contracts are unchanged.

## Integration and Verification

- [x] Focused unit/contract and changed-file checks pass.
- [x] Authenticated `/accounting` browser readback proves names in AR and AP.
- [x] Desktop and mobile screenshots are recorded and reviewed.
- [x] Independent functional/visual review approves the exact route.
- [x] Impeccable complexity audit passes.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a project balance exists without a usable human project name.
- Detection path: shared utility unit tests, focused Accounting source contract, authenticated DOM readback, and independent screenshot review.
- Recovery path: show `Unnamed project` or `Unassigned` while preserving the balance and ledger link; correct the source project description in Acumatica.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the shared chart mapping treated `projectCode` as the primary label and relegated the human description to tooltip detail.
- Detection gap: the prior chart regression explicitly asserted code-based labels instead of a human-readable display contract.
- Prevention: shared name-only utility, updated design rule, and focused tests that reject code-backed axis labels.
- Guardrail evidence: 10 focused tests, browser readback, independent approval, and verification contract PASS.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | PASS | Scope, source owner, global label rule, attention brief, and done gate captured before product edits. |
| Publication | Commit `31e9c2cbf` on `origin/main` | PASS | Push succeeded and local `HEAD` matched `origin/main` immediately after readback. |
| Focused regression | `npm run test:unit -- --runInBand --runTestsByPath ...` | PASS | 2 suites, 10 tests. |
| Targeted lint | ESLint on page, helper, and focused tests | PASS | 0 errors; 8 inherited page-grid warnings outside this label change. |
| Changed-type guard | `npm run typecheck:changed` | PASS | No new `any` type debt. |
| Route guardrail | `npm run check:routes` | PASS | No route conflicts. |
| Complexity audit | `audit-surface-complexity.mjs` | PASS | Accounting page passes. |
| Canonical runtime | `browser-readback.json` plus responsive screenshots | PASS | Human names present, code prefixes absent, redundant copy absent, 0px horizontal overflow. |
| Independent review | `independent-review.md` | PASS | Descartes approved the name contract; Hypatia approved the final desktop/mobile visual refinement. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ...` | PASS | Declared evidence supports PASS. |
| Auth isolation | `git diff --exit-code -- frontend/src/lib/auth/admin-dashboard-allowlist.ts` | PASS | Temporary local evidence access removed. |
| Project map guardrail | `npm run map:project` | PASS | Canonical route/app-surface artifacts regenerated after the Accounting page change. |
| System map guardrail | `NODE_PATH=<canonical repo node_modules> npm run map:system` | PASS | Canonical architecture map artifacts regenerated without package or lockfile changes. |

## Remaining Risk

- Visible evidence covers the six largest AR/AP balances. The shared utility tests cover exact codes, formatted prefixes, long names, unnamed projects, and unassigned data; additional source formats remain a future regression-test concern.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
