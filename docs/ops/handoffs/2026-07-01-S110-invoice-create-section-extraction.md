# Handoff: 2026-07-01 — Canonical invoice create route cleanup

## Intake Block

1) Session ID: S110
2) Task ID: AAI-868
3) Linear issue: AAI-868
4) Linear URL: https://linear.app/megankharrison/issue/AAI-868/refactor-project-invoice-create-page-into-extracted-shared-sections
5) Current status: In Progress
6) Files changed (absolute paths):
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-01-invoice-create-section-extraction.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-01-S110-invoice-create-section-extraction.md
   - /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md
   - /Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/invoices/new/page.tsx
7) Commands run and outcome (pass/fail counts):
   - `npm run worker-status` - pass
   - repo/task/process discovery reads - pass
   - `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/invoices/new/page.tsx'` - pass
   - `cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false` - fail (heap OOM)
   - one-off Playwright proof against `http://localhost:3001/760/invoices/new` with saved auth state - fail (redirect to login)
8) Evidence artifacts (screenshot/video/report/log paths):
   - Playwright console output confirming redirect to `/auth/login?callbackUrl=%2F760%2Finvoices%2Fnew`
9) Top 3 findings (frontend-visible issues first):
   - The current invoice create route already owns the correct persistence path and should be refactored rather than replaced.
   - The donor repo is useful for sectioning and line-item UX, not for infrastructure.
   - Browser proof is currently blocked by expired local auth state, not by a confirmed route crash.
10) Recommended next action (one line): Refresh local `localhost:3001` auth state, rerun browser proof on the exact route, then decide whether further section extraction is still warranted.
11) Handoff file path: docs/ops/handoffs/2026-07-01-S110-invoice-create-section-extraction.md
12) Migration ledger evidence: Not applicable

## Linear Updates

- Kickoff comment:
- Milestone comments:
  - Canonical route cleaned up in place with shared inline-table and numeric input primitives; focused lint is green, while browser proof is blocked by auth state and full `tsc` by heap OOM.
- Completion/blocker comment:

## Current Status

Process ledger created, canonical route cleanup landed in place, focused lint passed cleanly, and the remaining proof blockers are expired local auth state for browser verification plus full `tsc` heap OOM.

## Exact Next Step

Refresh local auth and rerun browser verification on the exact `/${projectId}/invoices/new` route so the real create flow can be proven.

## Known Pitfalls

Moving too much logic out of the route still risks breaking the prime-vs-commitment submit branching and the derived totals math.
Saved auth state for `localhost:3001` is stale, so browser checks can fail before the route itself is exercised.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
sed -n '1,920p' 'frontend/src/app/(main)/[projectId]/invoices/new/page.tsx'
sed -n '1,240p' frontend/src/components/layout/page-shell.tsx
sed -n '1,220p' frontend/src/components/forms/FormSection.tsx
cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/invoices/new/page.tsx'
```

## Evidence

- Task: `docs/ops/tasks/2026-07-01-invoice-create-section-extraction.md`
- Linear: `AAI-868`
- Route: `frontend/src/app/(main)/[projectId]/invoices/new/page.tsx`
