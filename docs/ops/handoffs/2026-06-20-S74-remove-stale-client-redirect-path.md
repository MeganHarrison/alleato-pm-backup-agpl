# Handoff: 2026-06-20 - Remove Stale Client Redirect Path

## Intake Block

1) Session ID: S74
2) Task ID: AAI-575
3) Linear issue: AAI-575
4) Linear URL: https://linear.app/megankharrison/issue/AAI-575/remove-unused-stale-clientredirect-permission-path
5) Current status: Published to `origin/main` at `f2885f0539`; accepted; Linear AAI-575 marked Done
6) Files changed (absolute paths):
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-20-remove-stale-client-redirect-path.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-20-S74-remove-stale-client-redirect-path.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/review-queue.md`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/auth/client-redirect.tsx`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-is-client.ts`
- `/Users/meganharrison/Documents/alleato-pm/docs/directory-auth-permissions.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/project-overview/component-inventory.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/reports/route-inventory.csv`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-20-remove-legacy-client-contact-components.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-20-S73-remove-legacy-client-contact-components.md`
7) Commands run and outcome (pass/fail counts):
- PASS: `rg -n "ClientRedirect|useClientAutoRedirect|use-is-client|useIsClient|client-dashboard|user_type|is_client" ...` found no live imports/usages of the stale redirect/hook, only self-references, docs, and generated inventory.
- PASS: `pnpm --dir frontend exec knip --config knip.json --no-exit-code --no-progress --reporter compact | rg 'src/components/auth/client-redirect\\.tsx|src/hooks/use-is-client\\.ts|client-redirect|use-is-client' || true` reported both files as unused before deletion.
- PASS: `sed -n '1,260p' frontend/src/app/(main)/[projectId]/layout.tsx` confirmed the active project layout enforces membership server-side.
- PASS: `sed -n '1,160p' frontend/src/app/(main)/[projectId]/client-dashboard/page.tsx` confirmed the active client dashboard route checks canonical lowercase `user_type === "client"` and redirects non-clients to home.
- PASS: `rg -n "ClientRedirect|useClientAutoRedirect|use-is-client|useIsClient|client-redirect" ...` returned no live imports after deletion; remaining hits are historical S73/S74 docs and the permissions-doc correction.
- PASS: `pnpm --dir frontend exec knip --config knip.json --no-exit-code --no-progress --reporter compact | rg 'src/components/auth/client-redirect\\.tsx|src/hooks/use-is-client\\.ts|client-redirect|use-is-client' || true` returned no output after deletion.
- PASS: `test ! -e frontend/src/components/auth/client-redirect.tsx && test ! -e frontend/src/hooks/use-is-client.ts`.
- PASS: `npm run check:routes`.
- PASS: `npm run verify:nonprod-routes`.
- PASS: `cd frontend && NODE_OPTIONS='--max-old-space-size=8192' TYPECHECK_NO_TIMEOUT=1 npx tsc --noEmit --pretty false`.
- PASS: `git diff --check -- ...`.
- PASS: `npm run codex:finish -- --message "Remove stale client redirect path" --files ...` published implementation to `origin/main` at `f2885f0539`.
8) Evidence artifacts (screenshot/video/report/log paths):
- Command output in this Codex run.
9) Top 3 findings (frontend-visible issues first):
- No frontend-visible app change expected because the removed redirect/hook are not imported.
- The active project layout guard verifies project membership server-side.
- The active client dashboard route verifies client membership with canonical `user_type === "client"`; the deleted hook used stale `"Client"` casing.
10) Recommended next action (one line): Delete the stale redirect/hook, update docs/inventory references, then rerun focused search/Knip and standard guardrails.
11) Handoff file path: docs/ops/handoffs/2026-06-20-S74-remove-stale-client-redirect-path.md
12) Migration ledger evidence: Not applicable; no database migration.

## Linear Updates

- Kickoff comment: `2b449635-3c3d-40ad-ba38-f0188d73de2d`
- Milestone comments: Not applicable yet.
- Completion/blocker comment: `8d75c7ce-92a5-4434-a56c-eabd63968b73`
- Acceptance/closeout comment: `f9287510-c062-4346-9d95-1ed4a8746a0c`
- Final state: Done

## Current Status

S74 removed a stale security/permissions path from S70 and published it to
`origin/main` at `f2885f0539`. Scope stayed limited to removing an unused
client redirect path and correcting docs that described that dead path as active.

## Known Pitfalls

- Do not alter the active project layout membership guard.
- Do not alter the active `client-dashboard` server route guard.
- Do not stage unrelated local worktree dirt or reference clones.
- Do not edit the unrelated dirty generated DB inventory in this slice.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
git status --short
npm run linear:codex:check -- docs/ops/handoffs/2026-06-20-S74-remove-stale-client-redirect-path.md
```

## Evidence

- Pre-delete search found no live imports/usages for the stale redirect/hook.
- Pre-delete Knip reported both files as unused.
- Active access control ownership is server-side project layout membership plus the client dashboard route guard.
- Deleted `frontend/src/components/auth/client-redirect.tsx`.
- Deleted `frontend/src/hooks/use-is-client.ts`.
- Updated permissions docs and stale inventory references.
- Post-delete search found no live imports.
- Post-delete Knip no longer reports either file.
- Route, nonprod route, whitespace, and high-heap TypeScript checks passed.
- Implementation published to `origin/main` at `f2885f0539`.
