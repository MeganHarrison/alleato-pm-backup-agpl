# CRM Local Dashboard Handoff

Status: Ready for Local Review
Session: S019FA6A7D
Task: ALL-41
Date: 2026-07-28

## Scope

This session owns the local `/crm` preview route, CRM preview feature modules,
focused tests, and this task/handoff only.

## Non-Negotiable Boundary

Do not push, publish to `main`, deploy, mutate shared data, configure providers,
or present preview fixtures as live CRM records.

## Current State

- Workspace branch: `codex/s019fa6a7d-crm-002-b047ea`.
- Baseline: `origin/main` after the Phase 0 checkpoint.
- Linear: ALL-41, In Progress.
- Phase 0 proved that the live database has no CRM relations while legacy code
  still references dropped CRM tables.
- The existing CRM implementation was audited. Shared table/filter patterns are
  being reused, while dropped-table APIs and unsafe mutation behavior are not.
- `/crm` now has a typed, fixture-backed relationship dashboard implementation
  with no CRM API or database calls.
- Focused Jest (2 tests) and focused ESLint pass.
- The repository-wide TypeScript check could not complete within a 7 GB Node
  heap; this is recorded as a tooling limit, not reported as a passing gate.
- Desktop and mobile browser renders were reviewed with no horizontal
  overflow; the local preview label, KPIs, attention reasons, health, activity,
  and follow-up dates are visible.
- Canonical authenticated proof remains pending because the local environment
  has no usable Supabase credentials. Browser QA used a synthetic local-only
  cookie and dummy keys, with no successful shared-data calls.

## Next Actions

1. Review the desktop and mobile screenshots with Brandon.
2. Decide whether to revise the preview information architecture.
3. After approval, design the Phase 1 schema/permission read model before
   connecting live data.
4. Do not push or publish until Brandon explicitly approves.
