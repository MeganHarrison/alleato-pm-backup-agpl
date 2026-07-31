# Task: Brandon's Tagged Dashboard

Status: Blocked/Deferred (production screenshot proof only; implementation is live)
Owner: Codex SBRANDON0731
Created: 2026-07-31
Task ID: LOCAL-20260731-BRANDONS-DASHBOARD
Linear Issue: Not requested; single-session local delivery
Related Handoff: `docs/ops/handoffs/2026-07-31-SBRANDON0731-brandons-dashboard.md`

## Objective

Publish `https://projects.alleatogroup.com/brandons-dashboard` as the Brandon-specific counterpart to Megan's dashboard, backed only by routes assigned the `brandons-dashboard` page tag.

## Scope

- Reuse the canonical Megan tagged-dashboard client without copying JSX.
- Add the `/brandons-dashboard` route and seed the `brandons-dashboard` tag.
- Preserve `/megans-dashboard` behavior unchanged.
- Excludes assigning specific application routes to Brandon's tag; admins continue to own assignments from `/site-map`.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(admin)/megans-dashboard/megans-dashboard-client.tsx` and `public.app_page_tags` / `public.app_page_tag_assignments`
- Existing shared primitives/services: `UnifiedTablePage`, `useUnifiedTableState`, `/api/admin/page-tags`, `readRouteInventory`
- Deprecated or parallel paths: No separate Brandon table implementation or copied dashboard client

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] `/brandons-dashboard` renders in the authenticated production app shell.
- [x] The page title is `Brandon's Dashboard` and it filters assignments by `tag_slug = 'brandons-dashboard'` only.
- [x] The existing Megan dashboard still filters by `megans-dashboard`.
- [x] The live PM database contains the idempotently seeded `brandons-dashboard` tag.
- [x] The exact migration is applied and present in both local and remote ledgers.
- [ ] Desktop and 390px mobile screenshots show the final production route.
- [ ] Page-tag API failures remain explicit through the shared table error state; zero assignments show an actionable Site Map recovery link.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database and external delivery contracts are applied and read back.
- [x] Production route budget remains within its guarded limit.

## Integration and Verification

- [x] Focused tagged-dashboard unit test passes.
- [x] `npm run check:routes` passes.
- [x] `npm run verify:nonprod-routes` passes.
- [x] Alleato surface-complexity audit passes.
- [x] Live database tag readback passes.
- [ ] Local authenticated desktop and mobile route proofs pass.
- [x] Independent review approves the exact task diff and evidence.
- [x] Exact-file remote-main publication preserves unrelated staged work.
- [x] Production deployment is Ready and the deployed output contains `brandons-dashboard` and `brandons-dashboard.rsc`.
- [ ] Authenticated final-route desktop and mobile screenshots pass.

## Failure-Loudly Contract

- Cause surfaced as: the shared `UnifiedTablePage` error state displays the page-tag API failure; an unassigned tag displays `No pages tagged yet` with a Site Map link.
- Detection path: focused unit test, live SQL tag readback, migration ledger verification, authenticated browser snapshot, and Vercel production route verification.
- Recovery path: retry tag loading for transient errors, or open `/site-map` and assign the `Brandon's Dashboard` tag when the tag has no routes.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: The Brandon-specific route and tag were previously assumed to exist, but neither was present in `origin/main` or the live PM database.
- Detection gap: No production-route readback, tag SQL readback, or final-route screenshot was retained for the earlier expectation.
- Prevention: Add a focused tag-scope regression test, require migration ledger proof, and capture authenticated production screenshots before completion.
- Guardrail evidence: `npm run verify:contract` evidence and the focused tagged-dashboard test recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and claimed lease | Pass | Scope and done gate captured before implementation. |
| Runtime localization | `origin/main` route tree plus live `app_page_tags` SQL readback | Pass | Megan route/tag existed; Brandon route/tag did not. |
| Tagged-route scope | Focused Jest for `filterRoutesByTag` | Pass | Brandon receives only Brandon assignments; Megan remains independent. |
| Route gates | `npm run check:routes`; `npm run verify:nonprod-routes` | Pass | Valid route tree; 2,042 of 2,048 generated-route budget used. |
| UI noise gate | Alleato surface-complexity audit | Pass | Reused the canonical table page; no new wrapper UI or duplicate action. |
| Production database | Direct SQL row and migration-ledger readback | Pass | Production ref `lgveqfnpkxvzbnnwuled` contains the tag and ledger version `20260731170002`. |
| Required migration helper | `npm run db:migrations:verify-applied -- supabase/migrations/20260731170002_add_brandons_dashboard_tag.sql` | Blocked by unrelated debt | The helper stops on duplicate local version `20260729190000`; direct SQL readback proves this task's exact production ledger entry. |
| Local browser | `http://localhost:3014/brandons-dashboard` | Blocked for visual proof | The saved test identity is non-admin and correctly receives Access Denied; no permission was changed. |
| Independent review | Reviewer re-review after route-wiring guardrail | Pass | APPROVE; no remaining correctness, security, route-isolation, or migration-safety findings. |
| Publication | Exact remote-main publisher | Pass | Code/data commit `ac0f3876`; project-map commit `9f1acde`. Unrelated staged files were preserved with a separate Git index. |
| Production deployment | Vercel `dpl_FZaD872NpCCTH66q3A5KJmQ3gcH6` | Pass | Ready; `projects.alleatogroup.com` aliases this deployment and its output includes both Brandon route artifacts. |
| Production screenshots | `https://projects.alleatogroup.com/brandons-dashboard` | Blocked/Deferred | The Codex in-app browser retains the required admin session but exposes no screenshot API. `agent-browser` is blocked by Windows Application Control and the saved Playwright identity is non-admin. |

## Remaining Risk

- The repository has only six generated routes of production budget remaining after this route.
- Production screenshot proof remains pending even though the final deployment is live. The smallest recovery is an admin-capable automation browser session with screenshot support; no product, data, or permission change is required.

## Final Status

- [ ] All required checklist items are complete.
- [x] Available evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred screenshot work has cause, detection gap, prevention step, owner, and next action.
