# Task: Daily Brief Design-Skill Benchmark and Browser Readiness Gate

Status: In Progress
Owner: Codex S214
Created: 2026-07-21
Task ID: AAI-1241
Linear Issue: AAI-1241 — https://linear.app/megankharrison/issue/AAI-1241/create-isolated-daily-brief-design-skill-benchmark-and-usability-gate
Related Handoff: `docs/ops/handoffs/2026-07-21-S214-daily-brief-design-skill-benchmark.md`

## Objective

Make Daily Brief design decisions evidence-backed, action-oriented, and reviewable through an authenticated browser workflow. The benchmark findings now promote the decision-first composition directly on the canonical route because isolated local candidates were not reviewable.

## Scope

- Install a fail-closed guard against raw anonymous `agent-browser` navigation to protected Alleato routes.
- Inject the authenticated readiness requirement for browser, visual, and end-to-end requests.
- Define the benchmark as isolated candidates with one fixed brief fixture and a promotion-only winner path.
- Promote the decision-first composition on `/daily-brief` with governed follow-through and visible source links.

## Source of Truth

- Browser readiness owner: `scripts/verification/prepare-authenticated-browser.mjs`.
- Saved auth state: `frontend/tests/.auth/user.json`.
- Canonical landing route: `frontend/src/app/daily-brief/page.tsx`.
- Existing protected-route policy: `AGENTS.md` authenticated-browser readiness gate.

Verification contract: Required.

## Acceptance Criteria

- [x] Root cause between saved Playwright state and raw agent-browser session is observed.
- [x] A protected local route is proven authenticated through the owned preflight.
- [x] Anonymous protected-route browser opens fail before a login screenshot can be captured.
- [x] A same-brief, isolated-candidate benchmark runbook and rubric are available.
- [x] Canonical `/daily-brief` uses the promoted decision-first composition; candidate previews remain isolated and are not treated as evidence.
- [x] Decision evidence links resolve from packet source IDs and missing links are explicit.
- [x] Assign follow-through opens the governed attention form with the decision title and summary prefilled.
- [x] Desktop and mobile canonical-route screenshots captured after browser inspection.

## Failure-Loudly Contract

- Cause surfaced as: a fail-closed hook explaining that raw agent-browser does not load the origin-specific auth state.
- Detection path: hook test plus the owned preflight's protected-route redirect check.
- Recovery path: run `npm run verify:browser-auth -- --base-url <origin> --route <route> --session <task>-auth-preflight`.

## Incident Learning

- Failure fingerprint: frontend.viewer-capability-regression
- Root cause: an authenticated Playwright storage state existed, but raw `agent-browser open` launched an anonymous browser daemon without `--state`.
- Detection gap: a written preflight policy was advisory and allowed raw browser commands to be treated as evidence.
- Prevention: a prompt-time reminder and pre-tool fail-closed hook require the owned preflight or the canonical state file.
- Guardrail evidence: `node --test scripts/design-benchmark/__tests__/daily-brief.test.mjs`, `npm run verify:browser-auth -- --base-url http://localhost:3000 --route /daily-brief --session daily-brief-rebuild`, and the browser screenshots below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Raw `agent-browser --session daily-brief-bakeoff open http://localhost:3000/daily-brief` | Observed | Redirected to `/auth/login` because the command had no state. |
| Auth boundary | `npm run verify:browser-auth -- --base-url http://localhost:3000 --route /daily-brief --session daily-brief-auth-preflight` | Pass | Refreshed localhost state; authenticated session reached a protected app route. Daily Brief load timeout is a separate route boundary. |
| Benchmark guard | `node --test scripts/design-benchmark/__tests__/daily-brief.test.mjs` | Pass | 2/2: evidence-backed candidates at threshold pass; automatic failures reject. |
| View-model guard | `cd frontend && npx jest --runInBand src/lib/daily-briefs/brief-view-model.unit.test.ts` | Pass | 23/23; v3 decision source IDs resolve to linkable packet evidence. |
| UI lint | `cd frontend && npx eslint src/app/(main)/executive/intelligence-brief/executive-brief-view.tsx src/components/executive/executive-attention-workflow.tsx src/lib/daily-briefs/brief-view-model.ts` | Pass | Changed UI/model files lint clean. |
| Noise gate | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass | Decision-first surface and governed attention workflow pass complexity audit. |
| Browser desktop | `/tmp/daily-brief-final-desktop.png` | Pass | Canonical `/daily-brief`; decision queue and source links visible. |
| Browser mobile | `/tmp/daily-brief-final-mobile-2.png` | Pass | 390px viewport; attention summary wraps without clipping. |
| Follow-through interaction | `agent-browser --session daily-brief-rebuild click Assign follow-through` | Pass | Governed form opened with `Port Collective` prefilled as title. |

## Remaining Risk

- Daily Brief currently times out during local route navigation after authentication. Owner: Daily Brief runtime route, next action: diagnose the route-load boundary separately without attributing it to auth.
- The four isolated previews were not reviewable because their local process lifecycle was not persistent; promotion was based on the strongest implementation plus direct canonical-route browser inspection.

## Final Status

- [x] All implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
