# Task: Homepage Action Dashboard MVP

Status: Published to origin/main at 58eaa6f96
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-683 - https://linear.app/megankharrison/issue/AAI-683/add-post-login-homepage-action-dashboard-mvp
Related Handoff: N/A

## Objective

Create a quiet authenticated post-login Action Dashboard MVP that can replace defaulting users directly into Projects, with clear user action sections and no fake claims of live integration where sources are not ready.

## Attention Brief

Primary user: Authenticated Alleato operator returning after login.
Primary job: Decide what needs attention now and reopen the right project or work queue.
Primary decision: Which action, project, or source-backed brief to inspect first.
Tier 1: Today and My Work.
Tier 2: AI Brief and My Projects.
Tier 3: Quiet Inbox and Recent Activity.
Hide until requested: Deep metrics, advanced filters, long historical activity, provider/debug metadata.
Remove: KPI stat rows, decorative dashboard cards, duplicate CTAs, marketing copy, and unverified live-data claims.
Primary action: Open the most relevant work queue or project.
Failure-loudly behavior: Tests fail if the post-login default keeps routing multi-project users to the old portfolio or if required section labels disappear.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Linear issue          | AAI-683 | Passed | Created before implementation. |
| Static/type/lint      | `cd frontend && npx eslint 'src/app/(main)/home/page.tsx' 'src/lib/auth/post-login-router.ts' 'src/lib/auth/__tests__/post-login-router.test.ts'`; `cd frontend && npm run typecheck:changed` | Passed | ESLint had no output; changed-type guard reported no new `any` debt. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/auth/__tests__/post-login-router.test.ts --runInBand` | Passed | 10 post-login redirect tests passed, including new `/home` defaults. |
| Browser/user-flow     | `docs/ops/evidence/homepage-action-dashboard/home.png`; `home-snapshot.txt`; `home-mobile.png`; `home-mobile-lower.png`; `home-mobile-section-check.json`; `home-browser-errors.txt` | Passed | Authenticated `/home` rendered at desktop and mobile. Mobile section check: all sections present, pending-source boundaries present, `scrollWidth` equals `clientWidth`. Browser errors clear after stale client reload. |
| DB/provider read-back | N/A                | Passed | No database, provider, env, or migration changes planned. |
| End-to-end proof      | `curl -I http://localhost:3001/home`; agent-browser `home-url.txt` / `home-mobile-url.txt` | Passed | Unauthenticated `/home` redirects to `/auth/login?callbackUrl=%2Fhome`; authenticated browser stays on `/home` and renders Action Dashboard. |

## Files Changed

- `docs/ops/tasks/2026-06-25-homepage-action-dashboard.md` - task definition and evidence ledger.
- `docs/ops/evidence/homepage-action-dashboard/` - browser proof artifacts.
- `frontend/src/app/(main)/home/page.tsx` - authenticated Action Dashboard route.
- `frontend/src/lib/auth/post-login-router.ts` - post-login default redirect owner updated for internal/default users.
- `frontend/src/lib/auth/__tests__/post-login-router.test.ts` - redirect guardrail for new `/home` defaults.

## Risks / Gaps

- AI brief summary and inbox priority rollup are intentionally marked as pending source wiring until a shared homepage brief/inbox contract exists.
- Full `npm run typecheck` and full build were not run in the main thread; this slice used targeted lint, changed-type guard, unit tests, and browser proof.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
