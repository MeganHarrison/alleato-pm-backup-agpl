# Task: Production Route Budget

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: ROUTE-BUDGET-20260730
Related Handoff:
`docs/ops/handoffs/2026-07-30-SROOT-production-route-budget.md`

## Objective

Bring the compiled PM application under Vercel's hard 2,048-route limit
without changing project-user workflows.

## Scope

- Use the existing production-only exclusion system.
- Exclude seven dynamic APIs limited to internal diagnostics, admin feedback,
  and AI feedback/marketing tooling.
- Preserve every project, commitment, invoice, and billing-period route.
- Verify the source budget before publishing and the provider count afterward.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] All excluded files exist and are unique.
- [x] The route-budget checker passes.
- [x] Production dynamic source files are below the repository budget.
- [x] No PM project, commitment, invoice, or billing-period route is excluded.
- [x] The canonical Vercel deployment reaches `READY`.
- [x] Vercel no longer reports `too_many_routes`.
- [x] The live health endpoint and Andrew's billing-period route pass.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Provider diagnosis | Confirmed | `dpl_EbDPoWLxKRRzXp4mzNoR648fxPQD` compiled successfully, then Vercel returned `too_many_routes`: 2,067 received versus 2,048 maximum. |
| Manifest validation | Pass | `check-nonprod-routes.mjs` reports 59 valid exclusions with no missing or duplicate files. |
| Source route budget | Pass | 651/654 production dynamic source files; estimated 2,033/2,042 generated routes. |
| Actual-count projection | Pass | Seven dynamic sources remove approximately 21 provider routes, reducing the observed 2,067 to about 2,046. |
| PM route preservation | Pass | Exclusions are limited to internal admin diagnostics/feedback and AI feedback/marketing endpoints. |
| Independent review | Approved | Reviewer confirmed all paths, route math, PM preservation, and the bounded capacity tradeoff. |
| Canonical production deployment | Pass | `dpl_F9vpvyvhKcQnpWP4UeCkVtzZw3NP` passed provider packaging, is `READY`, and owns `projects.alleatogroup.com`. |
| Live PM preservation | Pass | Health returned HTTP 200; Andrew sees BP-001, 2 commitment rows, and the Subcontract form without a permission error. |

## Failure-Loudly Contract

- Cause: Vercel returns the exact provider route count and limit.
- Detection: repository route-budget checker plus Vercel deployment metadata.
- Recovery: restore any excluded endpoint to production only after consolidating
  another internal dynamic route so the hard provider limit remains satisfied.

## Remaining Risk

- While excluded, internal asset approval/revision and memory/skill feedback
  actions return explicit route-missing errors; they do not fail silently and
  do not affect PM project workflows.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Task-owned files are published.
