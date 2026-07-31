# Task: Site Header Responsive Fallback

Status: Partial - Fresh browser verification blocked by admin allowlist
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-909
Linear URL: https://linear.app/megankharrison/issue/AAI-909/make-site-header-fall-back-to-mobile-layout-when-shell-width-is
Related Handoff: N/A

## Objective

Fix the shared site header so it switches to the mobile/compact variant when the app shell does not have enough horizontal room for the full desktop header, even if the viewport itself is wide.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: any user working inside the app shell while side panels or layout offsets reduce available width.
Primary job: keep navigation readable and operable without header overlap or clipped controls.
Primary decision: whether the shell has enough width to render the full desktop header safely.
Tier 1: working header layout, sidebar access, project/tool navigation access.
Tier 2: breadcrumbs and desktop controls when width allows.
Tier 3: measurement logic.
Hide until requested: width-detection plumbing.
Remove: viewport-only breakpoint assumptions for the shared header.
Primary action: navigate without header overflow.
Failure-loudly behavior: shared header must flip to compact mode before controls overlap page content.

## Acceptance Criteria

- [x] `SiteHeader` uses actual available shell width, not only viewport breakpoint classes, to choose desktop vs compact header mode.
- [x] `/feedback-inbox` with the feedback sheet open no longer shows desktop header controls overflowing into content.
- [x] Shared header behavior remains correct on normal wide layouts.
- [ ] Focused verification passes for the shared header file and the live `/feedback-inbox` surface.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Shared header ownership confirmed before route-level changes.
- [x] No page-local override added for `/feedback-inbox`.
- [x] Responsive fallback threshold is implemented in one shared place.

## Planned Files

- `docs/ops/tasks/2026-07-03-site-header-responsive-fallback.md`
- `frontend/src/components/header/site-header.tsx`
- `frontend/src/components/header/site-header-layout.ts`
- `frontend/src/components/header/__tests__/site-header-layout.test.ts`

## Integration Checklist

- [x] Linear kickoff comment recorded.
- [x] Main/admin layouts continue to consume the same shared header component.
- [x] No migration/provider change required, or read-back evidence recorded if that changes.

## Regression Guardrails

- [x] Focused ESLint run passes on touched files.
- [ ] Browser verification run on `/feedback-inbox` with constrained shell width.
- [x] Threshold decision has a unit test guardrail.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task template gate | `AGENTS.md` references `docs/ops/tasks/TASK-TEMPLATE.md` | Process gap | Template path is missing from the repo; this file mirrors the active task-ledger structure already in use. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint -c eslint.config.mjs src/components/header/site-header.tsx src/components/header/site-header-layout.ts src/components/header/__tests__/site-header-layout.test.ts` | Pass | No lint errors in the shared header fallback changes. |
| Unit test | `cd frontend && npm run test:unit -- --runTestsByPath src/components/header/__tests__/site-header-layout.test.ts` | Pass | Guards the compact fallback threshold helper. |
| Fresh browser session | `agent-browser open http://localhost:3001/feedback-inbox` | Blocked/Deferred | Fresh agent-browser session is redirected to `/access-denied?reason=admin-dashboard-allowlist`, so direct visual proof from a separate session is not currently available. |

## Blocked/Deferred Item

Cause: a fresh verification browser session is not on the admin allowlist for `/feedback-inbox`.
Detection gap: the live in-app browser already had the route open, but the standalone verification session did not share that authorized state.
Prevention step: keep an admin-authorized browser state available for Codex verification on admin routes, or expose the already-open in-app browser session to the verification tool path.
Owner: Codex/browser verification setup.
Next action: verify the updated shared header in the already-authorized in-app browser on `/feedback-inbox`, then mark the browser-proof checkbox complete.

## Files Changed

- `docs/ops/tasks/2026-07-03-site-header-responsive-fallback.md`
- `frontend/src/components/header/__tests__/site-header-layout.test.ts`
- `frontend/src/components/header/site-header-layout.ts`
- `frontend/src/components/header/site-header.tsx`
