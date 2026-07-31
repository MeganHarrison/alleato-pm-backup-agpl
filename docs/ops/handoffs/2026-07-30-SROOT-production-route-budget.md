# Independent Review: Production Route Budget

Task ID: `ROUTE-BUDGET-20260730`

Decision: APPROVED

## Review Scope

- `frontend/scripts/build/nonprod-routes.json`

## Evidence

- Vercel reported 2,067 routes against a hard maximum of 2,048 after the
  application compiled successfully.
- Seven dynamic internal APIs were added to the existing production-only
  exclusion manifest.
- The repository checker passes at 651/654 dynamic source files and an
  estimated 2,033/2,042 generated routes.
- No project, commitment, invoice, or billing-period route is excluded.

## Review Decision

All 59 entries are unique, all seven added paths exist and are dynamic, and
the build-route quality check passes. The actual-count projection is
2,067 - (7 * 3) = 2,046, two below Vercel's limit. The exclusions are
non-core internal diagnostics, feedback, and marketing actions; they do not
affect PM project workflows. Their callers surface route-missing errors rather
than failing silently.

Canonical GitHub-main deployment `dpl_F9vpvyvhKcQnpWP4UeCkVtzZw3NP` passed
provider packaging, is `READY`, and owns `projects.alleatogroup.com`. The live
health check and Andrew's authenticated PM access checks both pass.
