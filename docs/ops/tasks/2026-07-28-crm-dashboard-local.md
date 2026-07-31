# Task: CRM Local Relationship Dashboard Preview

Status: Ready for Local Review
Owner: Brandon / Codex
Created: 2026-07-28
Task ID: ALL-41
Related Phase 0: ALL-40
Related Handoff:
`docs/ops/handoffs/2026-07-28-S019FA6A7D-crm-dashboard-local.md`

## Objective

Build a protected, reviewable `/crm` relationship dashboard locally so Brandon
can evaluate the information architecture before CRM schema, permission, or
production work is approved.

## Hard Boundary

- Work only in isolated workspace `S019FA6A7D`.
- Do not push, publish to `main`, deploy, mutate a shared/production database,
  change provider configuration, or seed production data.
- Use typed preview data behind an explicit local-preview boundary.
- Do not call the stale `/api/crm/**` routes that reference dropped tables.

Delivery lane: Standard

Verification contract: Required

## Public Seam

The test seam is the protected `/crm` route and its user-visible populated,
empty, loading, error, and denied states. Tests assert observable labels,
actions, navigation, and filtering behavior rather than component internals.

## Attention Brief

Primary user: Brandon and Alleato business-development leadership.

Primary job: decide which relationships need action this week.

Primary decision: which account to contact, assign, or inspect next.

Tier 1: ranked accounts needing attention, reason, owner, and next follow-up.

Tier 2: relationship health, lifecycle, last meaningful activity, and search or
owner/lifecycle filters.

Tier 3: compact portfolio totals and recent activity needed to calibrate the
worklist.

Hide until requested: raw activity history, matching evidence, settings,
advanced reporting, and pipeline controls.

Remove: decorative charts, duplicate summaries, helper cards, secondary
toolbars, and any action that cannot work in the preview.

Primary action: identify the next relationship action. Canonical company
navigation remains intentionally disabled for fictional preview IDs and is
re-enabled when the read model returns real company IDs.

Failure-loudly behavior: preview data is visibly labeled; unavailable or denied
states name the recovery action and never fall back to fabricated live data.

## Design Direction

- Palette: existing Alleato semantic tokens only; primary accent reserved for
  the next action, with warning/danger tokens only for relationship state.
- Type: existing application typography; tabular numerals for compact
  monitoring values and restrained semibold hierarchy.
- Layout: shared `UnifiedTablePage` owns the page; a compact monitoring row
  precedes one dominant attention worklist.
- Signature: the attention ledger ranks each relationship by an explicit,
  human-readable reason rather than a decorative score.
- Reduction target: remove at least 30 percent of first-pass visual elements
  before final browser evidence.

## Acceptance Criteria

- [x] `/crm` renders in the Alleato shell with a synthetic local-only auth
  cookie. Canonical authenticated-environment proof remains pending.
- [x] The page answers who needs attention this week within 15 seconds.
- [x] Account search and owner/lifecycle/health filters are exposed through
  shared public controls; account search was exercised end to end.
- [x] Preview rows do not offer broken navigation for fictional company IDs;
  the table contract preserves the seam for canonical company links.
- [x] Health reasons and evaluation freshness are visible and understandable.
- [x] Preview data is unmistakably local and cannot be confused with live CRM
  data.
- [x] Empty, loading, error, and access-denied states use shared primitives.
- [x] Desktop and mobile layouts have no horizontal overflow.
- [x] Focused unit, lint, and browser checks pass on the local revision.
- [x] Noise gate result, removals, residual risk, and regression guard are
  recorded.
- [x] Nothing is pushed or published.

## Rollback

Delete the isolated workspace or revert the local branch commit. No shared
database, provider, deployment, or `main` state is changed.

## Existing CRM Reuse Audit

### Reuse or adapt

- `UnifiedTablePage` and `useUnifiedTableState` for search, filters, view state,
  table density, visible columns, and responsive record cards.
- Existing CRM pipeline column-configuration style for a typed relationship
  worklist.
- Canonical company detail route convention (`/directory/companies/[id]`) once
  the future CRM read model supplies real company IDs.
- Shared `KpiStrip`, `StatusBadge`, `ErrorState`, semantic tokens, and page
  header/container primitives.
- Existing API guardrail conventions (`withApiGuardrails`, Zod, and structured
  API errors) for the later server-backed phase.

### Do not reuse as-is

- The prior CRM schema and APIs: the tables were removed and current routes
  still query those dropped relations.
- Qualification writes to `companies.lifecycle_stage`: this crosses the ERP
  master-data boundary defined by the v4 plan.
- Deal deletion: the old endpoint hard-deletes instead of archiving.
- `crm_activities` follow-up records: the v4 contract requires reuse of the
  shared Tasks model.
- Legacy CRM panels that swallow fetch failures or hide sections, because that
  can make missing data appear healthy.
- The removed Prospects page's parallel company identity and hard-delete flow.

## Evidence

- Focused Jest:
  `relationship-dashboard-preview.test.tsx` — 2 tests passed.
- Focused ESLint: CRM route, preview component, and focused test passed with
  zero errors or warnings.
- Full frontend TypeScript check was attempted twice and exhausted the Node
  heap at both 4 GB and 7 GB before reporting diagnostics. The focused Jest
  transform compiled the CRM TypeScript successfully.
- Desktop browser: 1600x900, no document horizontal or vertical overflow; the
  complete six-row attention ledger fit above the fold.
- Mobile browser: 390x844, no horizontal overflow; shared responsive record
  cards rendered and the shell provided its intended internal vertical scroll.
- Search interaction: entering `Riverview` left only the Riverview Health row
  in the visible ledger, then clearing restored the worklist.
- Screenshots:
  `C:\Users\Brandon\.codex\visualizations\2026\07\28\019fa6a7-e0a7-7273-bb6d-a7732c46f13d\crm-dashboard-desktop-final.png`
  and
  `C:\Users\Brandon\.codex\visualizations\2026\07\28\019fa6a7-e0a7-7273-bb6d-a7732c46f13d\crm-dashboard-mobile-final.png`.

## Noise Gate

- Kept: one quiet monitoring strip, one dominant relationship ledger, shared
  search/filter/view controls, and responsive record cards.
- Removed: decorative charts, score cards, duplicate activity panels, preview
  mutations, broken company links, and secondary helper copy in table cells.
- Residual risk: the fixture contract is not a substitute for the Phase 1
  permission/schema design; canonical authenticated proof is blocked by absent
  local credentials.
- Regression guard: the focused test requires the local-data label, attention
  count, search behavior, and failure-loud error state.

## Local Runtime Note

The checked-out dependency graph contained incomplete pnpm links unrelated to
CRM. Browser QA used an untracked task-scoped dependency overlay and dummy
Supabase values. Background shell requests failed with the dummy key as
expected; no shared CRM data was requested or mutated.
