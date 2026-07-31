# Task: Prime Contract Change Orders Tab Redesign

Status: Complete
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-898 - https://linear.app/megankharrison/issue/AAI-898/redesign-prime-contract-change-orders-tab-for-quieter-empty-states-and
Related Handoff: N/A

## Objective

Redesign `/876/prime-contracts/6d90f64a-d9e2-4cb7-9aee-389dda0c9f4f` so the Change Orders tab reads as a quiet change-management surface instead of three stacked table pages with oversized empty states and low-signal scanability.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: Prime Contract detail > Change Orders tab.
One purpose: Inspect official change orders plus related PCOs and change events, then open the correct record.
Primary user job: Quickly understand what change activity exists on this contract without fighting dead space or wide low-density tables.
Primary action: Open the relevant change order, PCO, or change event detail.
Secondary actions: Approve/reject/edit/delete official change orders; quick-view PCO/change event details; follow canonical detail links.
Next action after success: Navigate into the selected record or create the next record from the page header.
Correction path: Use the existing edit/approve/reject/delete flows for change orders and canonical detail pages for PCO/change-event edits.
Keyboard path: Tab reaches record triggers and dialog actions; Enter/Space opens quick view; Escape closes quick view.
Information that belongs elsewhere: Page-scale empty-state illustration treatment and table chrome that implies each section is a standalone management page.
Blessed pattern: Detail page section + compact tabular change-order report + compact record cards with progressive disclosure via existing morphing dialog primitives.
Complexity budget: Full detail page with open sections, no nested cards, no dashboard metrics, no duplicated primary CTA, no page-scale empty states inside sub-sections.
Pass/fail: Current page fails; redesigned tab must pass before closeout.

## Noise Gate Brief

Primary user: PM/accounting/construction admin reviewing contract changes.
Primary job: Scan current change work and open the needed record fast.
Primary decision: Which change item exists, what state it is in, and where to go next.
Tier 1: Record identity, title, status, amount/scope, date, canonical destination.
Tier 2: Reason, schedule impact, related record linkage.
Tier 3: Full narrative/details inside quick view.
Hide until requested: Expanded detail copy and secondary metadata.
Remove: Page-scale empty-state treatment, repeated table-page chrome, excess dead space.
Primary action: Open record detail.
Failure-loudly behavior: If a dataset fails to load, the existing toast/error behavior remains visible; empty states stay compact and do not masquerade as missing page content.

## Scope Checklist

- [x] Existing architecture and related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Official change orders section redesigned to keep visible columns with compact empty-row handling.
- [x] PCO and change-event sections redesigned for higher scanability and quick-view progressive disclosure.
- [x] Existing morphing dialog primitives reused instead of introducing a new animation system.
- [x] User-facing copy/UI follows product noise gate and design-system rules.

## Integration Checklist

- [x] Existing change-order API contract remains unchanged.
- [x] Official change-order row actions still work.
- [x] PCO quick view preserves canonical navigation to nested PCO detail.
- [x] Change-event quick view preserves canonical navigation to change-event detail.
- [x] Empty/loading states remain recoverable.

## Regression Guardrails

- [x] Surface complexity audit run on changed UI files.
- [x] Targeted lint/check run for changed UI files.
- [x] Browser evidence captured for the actual requested route or local authenticated equivalent.

## Verification Checklist

- [x] Static/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Design doctrine audit run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] The official change-orders section keeps its column headers visible even when there are no rows.
- [x] Empty states within the tab no longer consume page-scale vertical space.
- [x] PCO and change-event records are more scannable than the current wide table rows.
- [x] PCO and change-event quick views open in-place with a clear link to the canonical detail page.
- [x] No new one-off low-level primitive is introduced for this redesign.

## Files Changed

- `frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractChangeOrdersTab.tsx` - official change orders section owner.
- `frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractPcosSection.tsx` - PCO section owner.
- `frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractChangeEventsTab.tsx` - change-events section owner.
- `docs/ops/tasks/2026-07-02-prime-contract-change-orders-redesign.md` - task definition and evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Linear kickoff | `AAI-898` | Pass | Issue created before code edits. |
| Linear kickoff comment | Linear comment `b7eb7e85-26b4-46e5-bfce-f48fe80b982a` | Pass | Scope, diagnosis, and next action recorded before implementation. |
| Design doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractChangeOrdersTab.tsx' 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractPcosSection.tsx' 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractChangeEventsTab.tsx' 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractQuickViewSection.tsx'` | Pass | All four changed UI files pass the surface complexity audit. |
| Targeted lint | `./node_modules/.bin/eslint 'src/components/domain/contracts/prime-contract-detail/PrimeContractChangeOrdersTab.tsx' 'src/components/domain/contracts/prime-contract-detail/PrimeContractPcosSection.tsx' 'src/components/domain/contracts/prime-contract-detail/PrimeContractChangeEventsTab.tsx' 'src/components/domain/contracts/prime-contract-detail/PrimeContractQuickViewSection.tsx'` from `frontend/` | Pass | Initial run surfaced two design-system arbitrary-spacing warnings; both were removed and the rerun was clean. |
| Whitespace check | `git diff --check -- 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractChangeOrdersTab.tsx' 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractPcosSection.tsx' 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractChangeEventsTab.tsx' 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractQuickViewSection.tsx' 'docs/ops/tasks/2026-07-02-prime-contract-change-orders-redesign.md'` | Pass | No whitespace errors. |
| Local route auth attempt | `agent-browser --session prime-contract-change-orders --state frontend/tests/.auth/user.json open 'http://localhost:3001/876/prime-contracts/6d90f64a-d9e2-4cb7-9aee-389dda0c9f4f?tab=change-orders'` | Redirected to login | Saved storage state did not authenticate the local app; per repo guidance this was treated as an auth-path fallback, not a blocker. |
| Local route login | `agent-browser --session prime-contract-change-orders auth login alleato-test-3001` | Pass | Env-backed test login succeeded for `http://localhost:3001/auth/login`. |
| Browser verification | `agent-browser --session prime-contract-change-orders click @e66` after opening the local contract detail route | Pass | Manually switched to the Change Orders tab on the exact requested contract detail page. |
| Visual proof | `docs/ops/evidence/2026-07-02-prime-contract-change-orders-redesign/prime-contract-change-orders-local-after.png` | Pass | Screenshot shows column-preserving official CO empty state plus compact PCO/change-event cards. |
| PCO quick view proof | `agent-browser --session prime-contract-change-orders click @e86` | Pass | PCO card opened the morphing dialog quick view with canonical `Open PCO` link. |
| PCO quick view artifact | `docs/ops/evidence/2026-07-02-prime-contract-change-orders-redesign/prime-contract-pco-quick-view-local.png` | Pass | Screenshot captured the expanded PCO quick view. |
| Change event quick view proof | `agent-browser --session prime-contract-change-orders click @e87` | Pass | Change-event card opened the morphing dialog quick view with canonical `Open change event` link. |
| Change event quick view artifact | `docs/ops/evidence/2026-07-02-prime-contract-change-orders-redesign/prime-contract-change-event-quick-view-local.png` | Pass | Screenshot captured the expanded change-event quick view. |
| Compact-card follow-up lint | `./node_modules/.bin/eslint 'src/components/domain/contracts/prime-contract-detail/PrimeContractQuickViewSection.tsx'` from `frontend/` | Pass | Follow-up proportional changes stayed lint-clean. |
| Compact-card follow-up doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs 'frontend/src/components/domain/contracts/prime-contract-detail/PrimeContractQuickViewSection.tsx'` | Pass | Tightened card proportions still pass the surface audit. |
| Webpack fallback dev proof | `npx next dev --port 3001` from `frontend/` | Pass | Switched from Turbopack after repeated `.next` manifest/tmp-file ENOENT failures during browser verification. |
| Final visual proof | `docs/ops/evidence/2026-07-02-prime-contract-change-orders-redesign/prime-contract-change-orders-local-after-v4.png` | Pass | Settled screenshot shows narrower, quieter record cards after the follow-up tightening pass. |

## Risks / Gaps

- Verification was local (`http://localhost:3001`) rather than production because the code is not yet published.
- The shared quick-view section is reusable within this feature slice, but only the Prime Contract change-management tab consumes it today.
- Turbopack was unstable in this local environment during verification; plain webpack `next dev` produced the stable browser-proof run.
