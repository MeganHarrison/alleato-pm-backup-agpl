# Handoff: Brandon's Tagged Dashboard

Status: Blocked/Deferred (production screenshot proof only; implementation is live)
Session: SBRANDON0731
Task: LOCAL-20260731-BRANDONS-DASHBOARD
Delivery lane: High-risk
Task file: `docs/ops/tasks/2026-07-31-brandons-dashboard.md`

## Acceptance Contract

- Production route `/brandons-dashboard` renders `Brandon's Dashboard` in the authenticated app shell.
- The shared tagged-dashboard client receives `tagSlug="brandons-dashboard"` and does not show Megan-tag-only assignments.
- The PM database contains the idempotent `brandons-dashboard` tag.
- Migration ledger, focused test, route guard, independent review, deployment, and desktop/mobile screenshots pass.

## Ownership

- `frontend/src/app/(admin)/megans-dashboard/megans-dashboard-client.tsx`
- `frontend/src/app/(admin)/megans-dashboard/__tests__/tagged-dashboard-client.test.ts`
- `frontend/src/app/(admin)/brandons-dashboard/page.tsx`
- `frontend/src/lib/page-tags.ts`
- `supabase/migrations/20260731170002_add_brandons_dashboard_tag.sql`
- `docs/ops/tasks/2026-07-31-brandons-dashboard.md`
- `docs/ops/handoffs/2026-07-31-SBRANDON0731-brandons-dashboard.md`
- `docs/ops/evidence/2026-07-31-brandons-dashboard/**`

## Diagnosis

- Runtime observation: `https://projects.alleatogroup.com/brandons-dashboard` had no published application route.
- Code boundary: `origin/main` contained only `frontend/src/app/(admin)/megans-dashboard`.
- Data boundary: live PM Supabase contained `megans-dashboard` with 113 assignments and no Brandon-named tag.
- Root cause: the Brandon clone and its seed tag were never delivered to the canonical route and database owners.

## Implementation Summary

- Generalized the existing Megan client into a tag-configured dashboard without copying its JSX or table configuration.
- Added `/brandons-dashboard`, passing `brandons-dashboard` and `Brandon's Dashboard` into the shared client.
- Added a shared tag-filter helper and regression tests proving Brandon and Megan assignments remain isolated.
- Added and applied the idempotent Brandon tag migration. Route assignments remain owned by `/site-map` and were intentionally not copied.

## Verification

- Focused Jest: pass, 4 tests, including both page-level route-to-tag contracts.
- `npm run check:routes`: pass.
- `npm run verify:nonprod-routes`: pass at 2,042 of 2,048 generated routes.
- Alleato surface-complexity audit: pass for both affected UI files.
- Production bundle inspection: production Supabase ref is `lgveqfnpkxvzbnnwuled`.
- Production SQL readback: tag and exact ledger entry pass.
- Local server: running at `http://localhost:3014` with isolated `.next-dev-3014` output.
- `agent-browser`: blocked by Windows Application Control. The repository test account is not an admin, so its Access Denied view is retained only as diagnostic evidence, not final visual proof.

## Migration Ledger Evidence

- Local migration: `supabase/migrations/20260731170002_add_brandons_dashboard_tag.sql`.
- Production database: `supabase_migrations.schema_migrations` contains version `20260731170002`, name `add_brandons_dashboard_tag`.
- Tag readback: `brandons-dashboard`, label `Brandon's Dashboard`, color `primary`, zero assignments.
- Required helper limitation: `npm run db:migrations:verify-applied -- supabase/migrations/20260731170002_add_brandons_dashboard_tag.sql` stops before target comparison because unrelated files duplicate version `20260729190000`. Cause: pre-existing migration naming debt. Detection gap: the helper validates the entire local directory before checking the requested version. Prevention: restore unique migration versions in the owning tasks. This task's direct production row and ledger readback is recorded above.

## Screenshot Evidence

- Final URL: `https://projects.alleatogroup.com/brandons-dashboard`.
- Artifact directory: `docs/ops/evidence/2026-07-31-brandons-dashboard/` contains no valid final screenshot; diagnostic login/Access Denied captures were deleted so they cannot be mistaken for proof.
- Cause: the Codex in-app browser holds the admin-capable session but exposes no screenshot API. The mandated `agent-browser` executable is blocked by Windows Application Control, and the saved Playwright test identity is correctly denied access to admin routes.
- Detection gap: browser navigation state alone cannot satisfy the repository's visual proof contract.
- Prevention: maintain an admin-capable automation storage state or expose a screenshot action for Codex browser tabs.
- Smallest recovery: capture desktop and 390px screenshots from the already-live route using an admin-capable browser automation session. No code, database, or permission change is needed.

## Independent Review

- Initial finding: helper-only coverage would not detect Brandon's page being wired to Megan's slug.
- Fix: both page components now explicitly pass their own tag/title, the shared client requires both props, and the focused suite asserts the two route contracts.
- Re-review verdict: APPROVE for the code/data release candidate with no remaining correctness, security, route-isolation, or migration-safety findings.
- Final production screenshots remain the separate completion gate.

## Failure Contract

- API failure: shared table error state with the concrete request error.
- Zero assignments: `No pages tagged yet` with a link to `/site-map`.
- Missing migration or deployment: completion remains blocked and the failing command is recorded.

## Remaining Risk

- Six generated routes remain before the production route ceiling.
- The final production deployment `dpl_FZaD872NpCCTH66q3A5KJmQ3gcH6` is Ready at commit `9f1acdebd894`; its output contains `brandons-dashboard` and `brandons-dashboard.rsc`.
- Authenticated desktop/mobile screenshot proof and the verification-contract PASS remain deferred for the tooling reason above.
