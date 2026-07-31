# Handoff: 2026-07-04 — Submittal detail design-system repair

## Intake Block

1) Session ID: S112
2) Task ID: `docs/ops/tasks/2026-07-04-submittal-detail-design-system-repair.md`
3) Linear issue: AAI-937
4) Linear URL: https://linear.app/megankharrison/issue/AAI-937/unify-submittal-detail-page-with-shared-header-actions-and-detail
5) Current status: In Progress
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-04-submittal-detail-design-system-repair.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-04-S112-submittal-detail-design-system-repair.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx`; `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-detail-client.tsx`
7) Commands run and outcome (pass/fail counts): repo audit (`rg`/`sed`) pass; Linear issue creation pass; Linear kickoff comment pass; `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/features/submittals/submittal-detail-client.tsx` pass; `cd frontend && ./node_modules/.bin/eslint 'src/features/submittals/submittal-detail-client.tsx' 'src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx'` pass with 1 existing warning; `cd frontend && npm run typecheck:changed` pass; production exact-route browser attempts fail -> auth redirect; local exact-route browser attempts fail -> auth redirect / auth bootstrap abort / route timeout
8) Evidence artifacts (screenshot/video/report/log paths): `/tmp/submittal-detail-local.png`
9) Top 3 findings (frontend-visible issues first):
- The exact submittal detail page uses a bespoke header action cluster that diverges from the shared compact header menu pattern.
- The right-side metadata surface is still built with feature-local `EditableDetailField` stacks rather than the shared detail property row pattern used elsewhere.
- The current page has display-quality failures on the exact route, including contractor/date rendering problems and inconsistent empty-state copy.
10) Recommended next action (one line): Replace the feature-local header/sidebar treatment with the shared dropdown and property-row primitives, then browser-verify the exact route.
11) Handoff file path: `docs/ops/handoffs/2026-07-04-S112-submittal-detail-design-system-repair.md`
12) Migration ledger evidence: N/A.

## Linear Updates

- Kickoff comment: `ac05139f-5915-4f21-8d07-94cc2a22d306`

## Current Status

Design-doctrine diagnosis is complete and the code repair is in place on the
exact submittal detail owner files. The remaining gap is live browser proof:
both production and local auth/bootstrap paths failed before the page rendered.

## Exact Next Step

Refresh or provide a working authenticated session for project `876`, then rerun
browser verification on the exact route and capture a real screenshot of the
repaired header/property-bar surface.

## Known Pitfalls

- `frontend/src/features/submittals/submittal-detail-client.tsx` already had
  unrelated export work in this checkout, so future edits must keep that diff
  boundary intact.
- Saved production auth states for this route are stale, and the local auth
  profile bootstrap currently aborts before login completes.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
sed -n '620,1120p' frontend/src/features/submittals/submittal-detail-client.tsx
sed -n '1,220p' frontend/src/components/ui/detail-property-bar.tsx
curl -I -m 10 'http://localhost:3001/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4'
agent-browser --session submittal-verify-3001 open 'http://localhost:3001/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4?scommentId=XBkjOA4mBR5tEU2iggGr'
```

## Evidence

- `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/features/submittals/submittal-detail-client.tsx`
- `cd frontend && ./node_modules/.bin/eslint 'src/features/submittals/submittal-detail-client.tsx' 'src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx'`
- `cd frontend && npm run typecheck:changed`
- `/tmp/submittal-detail-local.png`
