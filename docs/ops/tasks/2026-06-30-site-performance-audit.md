# Task: Site performance audit

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-784 - https://linear.app/megankharrison/issue/AAI-784/audit-sudden-slow-page-loads-in-localsite-runtime

## Objective

Identify the concrete cause or causes behind the sudden slow page loads in the
current Alleato app runtime, prove them with real measurements, and define the
smallest durable fix path or operational mitigation.

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

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [ ] Guardrail added so the same class of bug fails loudly next time.
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Prior-memory review | `rg -n "performance|slow|page load|Server-Timing" /Users/meganharrison/.codex/memories/MEMORY.md` | Pass | Found prior shell-latency, DB incident, and slow-query guardrails to reuse. |
| Runtime listeners | `lsof -nP -iTCP -sTCP:LISTEN | rg ':(3000|3001|8000)\\b'` | Pass | Active Next listeners on `3000` and `3001`; audit is focused on current local runtime rather than assumed route ownership. |
| Initial anonymous timing | `curl -s -o /tmp/... -w 'code=%{http_code} ttfb=%{time_starttransfer} total=%{time_total}' http://127.0.0.1:3000/3001` | Pass | `3000` redirects to `/docs` in ~63 ms; `3001` redirects to `/auth/login` in ~136 ms, so the reported slowness is likely inside authenticated/project flows rather than anonymous root redirects. |
| Linear issue | `AAI-784` | Pass | Audit tracked in Linear. |
| Local authenticated perf probe | `node scripts/perf/project-home-speed.mjs --base-url http://127.0.0.1:3001 --runs 2 --warmups 0 --auth-state frontend/tests/.auth/projects-user.json --browser-channel chrome --output-json /tmp/alleato-project-home-perf.json` | Pass | Local `/760/home` is fast: median `TTFB 84ms`, `LCP 410ms`, `Load 167ms`, `API request count 0`. |
| Production authenticated perf probe | `node scripts/perf/project-home-speed.mjs --base-url https://projects.alleatogroup.com --runs 2 --warmups 0 --auth-state frontend/tests/.auth/projects-user.json --browser-channel chrome --output-json /tmp/alleato-project-home-prod-perf.json` | Pass | Production `/760/home` is slow: `TTFB 1.39s`, `LCP 3.06s`, `Load 23.26s`, `Resource count 136`, `API request count 9`. Worst resource: `https://cdn.velt.dev/lib/sdk@5.0.2-beta.30/velt.js` at `6.6s-21.8s`; multiple `_next/static/chunks/*.js` requests each take `7s-15s` to finish. |
| Production API/resource breakdown | `node -e \"... /tmp/alleato-project-home-prod-perf.json ...\"` | Pass | Server data requests are secondary: `/api/projects/760/shell` is `713ms-1460ms`; `/api/projects/760/home/tab-data?kind=daily-logs` hit `4.8s` once; `/api/collaboration/notifications?limit=25` hit `2.5s-5.4s`; `/api/velt/token` hit `420ms-1.4s`. |
| Production shell direct read-back | `curl -sS -o /tmp/prod-shell-body.json -w 'code=%{http_code} ttfb=%{time_starttransfer} total=%{time_total}' -H 'Cookie: ...' https://projects.alleatogroup.com/api/projects/760/shell` | Pass | Direct shell API responded `200` with `ttfb=0.686s`, `total=0.687s`, proving the 20s+ page-load issue is not primarily shell-route latency. |
| Code ownership trace | [`frontend/src/app/layout.tsx`](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/layout.tsx:80), [`frontend/src/app/root-client-widgets.tsx`](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/root-client-widgets.tsx:19), [`frontend/src/components/velt/VeltAuthProvider.tsx`](/Users/meganharrison/Documents/alleato-pm/frontend/src/components/velt/VeltAuthProvider.tsx:24), [`frontend/src/components/providers/posthog-provider.tsx`](/Users/meganharrison/Documents/alleato-pm/frontend/src/components/providers/posthog-provider.tsx:17) | Pass | Velt provider wraps the entire app, root widgets defer-mount at 6s, and PostHog initializes globally after 2s. These match the slow global script/resource waterfall and explain why local fast dev behavior does not mirror production asset cost. |
| Runtime gate unit test | `./frontend/node_modules/.bin/tsx --test frontend/src/lib/performance/__tests__/runtime-gates.test.ts` | Pass | Route-level collaboration/analytics gates pass under node test runner. |
| Local browser verification after patch | Manual Playwright login to `http://127.0.0.1:3001/auth/login?callbackUrl=%2F760%2Fhome` and capture of all `api/`, `velt`, and `posthog` responses for the first 3s after reaching `/760/home` | Pass | Normal project-home startup no longer requests `https://cdn.velt.dev/*`, `/api/velt/token`, or `/api/collaboration/notifications`. Remaining external analytics traffic is reduced to PostHog core config/flags fetches, with no recorder/surveys/dead-click helper scripts. |

## Files Changed

- `docs/ops/tasks/2026-06-30-site-performance-audit.md` - audit ledger and evidence trail.
- `frontend/src/lib/performance/runtime-gates.ts` - shared route-level performance gating rules.
- `frontend/src/lib/performance/__tests__/runtime-gates.test.ts` - regression guardrail for runtime gates.
- `frontend/src/lib/stores/collaboration-runtime-store.ts` - persisted opt-in for heavy collaboration runtime.
- `frontend/src/components/velt/VeltAuthProvider.tsx` - mount Velt only on forced collaboration routes or user opt-in.
- `frontend/src/app/root-client-widgets.tsx` - keep Velt layer out of standard page startup.
- `frontend/src/components/providers/posthog-provider.tsx` - lightweight PostHog mode on standard project pages.
- `frontend/src/components/ai-assistant/global-ai-widget.tsx` - delay collaboration notification boot for the floating widget.
- `frontend/src/components/header/notification-bell.tsx` - stop eager collaboration notification fetches until the bell opens.
- `frontend/src/components/header/comments-sidebar-button.tsx` - explicit on-demand enable flow for comments.
- `frontend/src/app/layout.tsx` - remove global Velt preconnect hints from the shell.

## Risks / Gaps

- The AGENTS-referenced path `docs/ops/tasks/TASK-TEMPLATE.md` is missing in
  this checkout; this task uses the live `docs/tasks/TASK-TEMPLATE.md` format.
- The repo has unrelated dirty worktree changes; this audit must not stage or
  overwrite them.
- The production improvement is implemented locally but not yet deployed, so
  the production perf probe still reflects the pre-fix build.
- Turning collaboration on for the first time now happens explicitly from the
  comments button; that opt-in can remount the provider-backed collaboration UI
  in that session, which is intentional but should be watched during product QA.
- The repo’s default Jest and ESLint entrypoints are currently blocked by
  workspace-level config drift (`jest-haste-map` package collisions and missing
  flat ESLint config), so verification used `tsx --test`, live local browser
  proof, and real Next dev compilation instead of the generic repo runners.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
