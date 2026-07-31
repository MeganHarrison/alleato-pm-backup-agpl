## Task: Remove Liveblocks runtime and replace active UI paths

Status: Complete
Owner: Codex
Created: 2026-07-13
Linear Issue: Blocked - Linear connector returned `oauth_token_invalid_grant` on 2026-07-13
Related Handoff: `docs/ops/handoffs/2026-07-13-S131-remove-liveblocks-runtime.md`

## Objective

Remove Liveblocks from the active application runtime in `project-management`, replace the still-mounted notification UI with the existing first-party `collaboration_notifications` path, and delete obsolete Liveblocks provider, overlay, route, and helper code so comments and notifications no longer depend on that stack.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and the evidence section is filled in. If any item cannot be completed, set the status to `Blocked/Deferred` and record the cause, owner, and next action.

## Attention Brief

Primary user: authenticated project user using comments and notifications from the header, mobile nav, and notifications page.
Primary job: open notifications and comment controls without any hidden Liveblocks dependency or broken runtime.
Primary decision: inspect a notification, open the canonical record, or add/open discussion from the header.
Tier 1: functional header comment control, functional header/mobile notifications, stable page shell.
Tier 2: notifications list content and unread state.
Tier 3: deprecated feedback mirroring and old page-overlay code.
Hide until requested: old collaboration-provider plumbing, webhook-only comment relay logic.
Remove: Liveblocks provider wrappers, Liveblocks inbox UI, Liveblocks routes, old page overlay, dead package dependencies.
Primary action: click notifications or comments and get a working first-party flow.
Failure-loudly behavior: if notification data fails, the UI shows an explicit unavailable state instead of silently disappearing or throwing on missing providers.

## Acceptance Criteria

- [x] No active app layout mounts a Liveblocks provider.
- [x] Header notifications, mobile badge, and `/notifications` render from first-party collaboration notifications.
- [x] Old Liveblocks page-comment overlay is removed from the app shell.
- [x] Liveblocks API routes and obsolete helper modules are removed.
- [x] Frontend package dependencies no longer include Liveblocks packages.
- [x] Runtime and dependency guardrails fail if Liveblocks is reintroduced.
- [x] Existing Velt global, entity, and drawing-comment entry points remain canonical and reachable.
- [x] Targeted verification proves the active notification/comment entry points render.
- [x] Full frontend compile result recorded.

## Root Cause

Repository-control documentation already names Velt as the canonical collaboration runtime and Liveblocks as retired, but the enforcement list only covered earlier filenames. Liveblocks survived under different active routes, provider names, notification components, helpers, and package dependencies. That detection gap allowed a retired runtime to remain mounted beside Velt.

## Source Of Truth

- Comments and annotations: root `VeltAuthProvider`, `VeltGlobalLayer`, `EntityComments`, and Velt comment APIs.
- Notifications: first-party `collaboration_notifications` data and the shared notification service/UI.
- Regression prevention: repository-control audit rejects Liveblocks packages, imports, routes, providers, helpers, and type declarations.

## Failure-Loudly Contract

- Notification fetch failures render an actionable error state and never become an empty success state.
- Velt authentication failures remain observable through the existing Velt auth provider error path.
- Any future tracked Liveblocks dependency or runtime reference fails the repository-control audit.

## Planned Files

- `docs/ops/tasks/2026-07-13-remove-liveblocks-runtime.md`
- `frontend/src/app/(main)/layout.tsx`
- `frontend/src/app/(tables)/layout.tsx`
- `frontend/src/app/(admin)/admin-layout-client.tsx`
- `frontend/src/app/(main)/notifications/page.tsx`
- `frontend/src/components/collaboration/app-inbox-list.tsx`
- `frontend/src/components/header/notification-bell.tsx`
- `frontend/src/components/nav/mobile-bottom-nav-alert-badge.tsx`
- `frontend/src/services/notificationService.ts`
- `frontend/src/app/api/liveblocks/**`
- `frontend/src/components/collaboration/collaboration-provider.tsx`
- `frontend/src/components/comments/page-comments-overlay.tsx`
- `frontend/src/lib/admin-feedback/liveblocks-feedback.ts`
- `frontend/src/lib/collaboration/liveblocks-inbox.ts`
- `frontend/src/lib/stores/page-comments-store.ts`
- `frontend/src/types/liveblocks.d.ts`
- `frontend/next.config.ts`
- `frontend/src/app/globals.css`
- `scripts/audits/check-repo-control.mjs`
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`

## Verification Checklist

- [x] Targeted lint/type check run.
- [x] Repository-control and zero-reference checks run.
- [x] Targeted browser verification run on the active notification/comment surfaces.
- [x] Design/noise-gate audit run on changed UI surfaces.
- [x] Full frontend verification delegated to a verification worker.
- [x] Remaining risk documented.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | `docs/ops/tasks/2026-07-13-remove-liveblocks-runtime.md` | In progress | Runtime removal ledger for this slice. |
| Linear kickoff | `linear_list_teams` | Blocked | Connector returned `oauth_token_invalid_grant`; repository work continues with the blocker recorded. |
| Zero-reference scan | `rg -n "liveblocks|Liveblocks|@liveblocks" frontend/package.json frontend/pnpm-lock.yaml frontend/src -g '!frontend/.next'` | Pass | Returned `no matches` after package removal and source cleanup. |
| Targeted ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/components/header/notification-bell.tsx' 'src/components/nav/mobile-bottom-nav-alert-badge.tsx' 'src/components/collaboration/app-inbox-list.tsx' 'src/app/(main)/notifications/page.tsx' 'src/app/(main)/layout.tsx' 'src/app/(tables)/layout.tsx' 'src/app/(admin)/admin-layout-client.tsx' 'src/services/notificationService.ts' 'src/app/api/cron/sync-feedback-pr-status/route.ts'` | Pass | Initial raw-button warning in `app-inbox-list.tsx` was fixed by moving the control to the shared `Button` primitive. |
| Changed-file type gate | `cd frontend && npm run typecheck:changed -- --staged` | Pass | No staged new-`any` debt detected. This is not a full TypeScript compile. |
| Surface complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs 'frontend/src/components/header/notification-bell.tsx' 'frontend/src/app/(main)/notifications/page.tsx' 'frontend/src/components/collaboration/app-inbox-list.tsx'` | Pass | The notification bell, notifications page, and inbox list stayed within the expected surface budget after the runtime swap. |
| Repo-control guardrail | `node scripts/audits/check-repo-control.mjs` | Partial | The script no longer reports any retired Liveblocks files, imports, or dependencies. It still fails on unrelated existing top-level classification debt such as `.coderabbit.yaml`, `.codex-artifacts`, `PRODUCT.md`, `agent`, `agents`, and `pnpm-workspace.yaml`. |
| Browser shell proof | `docs/ops/evidence/2026-07-13-liveblocks-removal/root-shell.png` | Pass | `agent-browser` opened `http://localhost:3001/` and confirmed the root shell still renders `Discussion` and `Notifications`. |
| Browser discussion menu proof | `docs/ops/evidence/2026-07-13-liveblocks-removal/discussion-menu.png` | Pass | `Discussion` still opens with `Add Comment`, `Create GitHub Issue`, `Page Comments`, and `View Comments` after the old provider/overlay removal. |
| Browser notifications proof | `agent-browser` session `pm-liveblocks-removal` | Pass | Clicking `Notifications` exposed `Mark all read`, `See all notifications`, and `Close` in the right-side panel. |
| Focused runtime guard | `node scripts/audits/check-repo-control.mjs --liveblocks-only` | Pass | No active runtime, route, config, package, lockfile, or test-environment references remain. |
| Focused tests | `jest --runInBand --runTestsByPath` for notification inbox, activity feed, notification API, and mobile nav | Pass | 4 suites, 15 tests; includes first-party rendering, mark-read, failure/retry, API authorization, and mobile navigation. |
| Route and build contracts | `npm run check:routes`; `node frontend/scripts/build/check-critical-build-contracts.mjs` | Pass | No route conflicts; notification/comment activity contracts verified. |
| Browser notifications | `docs/ops/evidence/2026-07-13-remove-liveblocks-runtime/notifications.png` | Pass | Authenticated `/notifications` rendered first-party records with no page errors. |
| Browser Velt entry | `docs/ops/evidence/2026-07-13-remove-liveblocks-runtime/velt-discussion-open.png` | Pass | Discussion menu rendered Velt-only Add Comment, Page Comments, and visibility actions. |
| Browser Velt mode | `docs/ops/evidence/2026-07-13-remove-liveblocks-runtime/velt-add-comment-mode.png` | Pass | Selecting Add Comment entered Velt comment mode with no page errors; no comment was submitted. |
| Vercel environment cleanup | `vercel env rm ... --yes`; `vercel env ls | rg 'LIVEBLOCKS|PAGE_COMMENTS|VELT'` | Pass | Retired keys and feature flag removed from Preview/Production; read-back shows only Velt keys. |
| Production Velt credential recovery | Vercel deployment `dpl_7YBwbwVBbr7ZgY6WfJ5xMVpSZiHo`; `docs/ops/evidence/2026-07-13-production-comments-restored.png` | Pass | Production initially returned `500` from `/api/velt/token` and `/api/comments/all` because the deployed Velt credential pair did not authenticate successfully. The verified secure local pair was applied to Production, commit `0d3a0e8` was redeployed without local dirty changes, and the production alias now returns `200` with a token plus 90 comments; the sidebar visibly renders existing threads. |
| Full frontend compile delegation | `NODE_OPTIONS=--max_old_space_size=16384 ./node_modules/.bin/tsc --noEmit --pretty false` | Unrelated repo failure | High-heap fallback completed and reported broad existing debt in feedback, training, drawing, RAG, AI tools, and reports; no task-owned removal file appeared in diagnostics. |

## External Tracking Blocker

- Cause: the installed Linear connector rejected its refresh grant.
- Detection gap: the connection had not been read back before task kickoff.
- Prevention: verify the Linear connector at the start of full-process work and record an unavailable connector immediately.
- Owner: workspace integration administrator.
- Next action: reauthenticate Linear, then create/link the issue and post the task evidence.

## Remaining Risk

- The project-wide typecheck and broad repo-control audit remain red because of unrelated repository debt. Cause: broad existing diagnostics and unclassified/deprecated paths. Detection gap: the default typecheck first exhausted its 4 GB heap and only exposed diagnostics after the 16 GB fallback. Prevention: keep the focused removal guard and targeted test suite in the finish gate; repair the repository-wide gates under the owning feature tasks.
- Linear evidence could not be posted because the connector requires reauthentication. Repository, browser, and provider evidence are complete and recorded here.
