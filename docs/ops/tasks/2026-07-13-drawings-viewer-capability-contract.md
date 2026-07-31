# Task: Drawings Viewer Capability Contract

Status: Complete
Owner: Codex
Created: 2026-07-13
Task ID: AAI-1061
Linear Issue: https://linear.app/megankharrison/issue/AAI-1061/add-deterministic-drawings-viewer-capability-regression-contract
Related Handoff: `docs/ops/handoffs/2026-07-13-S139-drawings-viewer-capability-contract.md`

## Objective

Turn the canonical drawings viewer tracker into one rerunnable, authenticated
browser contract so visible controls cannot silently regress between migrations
or focused fixes.

## Scope

- Add a deterministic Playwright contract for the canonical drawings viewer.
- Add a dedicated no-webserver Playwright config that uses the saved auth state
  without coupling the viewer gate to unrelated route compilation.
- Verify route identity, shell controls, markup affordances, panels, zoom/rotate,
  and explicit browser/runtime failure signals without leaving persistent data.
- Run live `agent-browser` proof at desktop, tablet, and mobile widths.
- Repair viewer header actions that the responsive proof finds outside the mobile viewport.
- Repair the PDF probe and vendor lifecycle failures exposed by the new contract.
- Make viewer-exit navigation deterministic across the embedded vendor boundary.
- Promote `frontend.viewer-capability-regression` to an active detectable guardrail.
- Preserve S136/S138 annotation ownership and `package.json` owned by S137.

## Done Checklist

- [x] Linear issue exists, is In Progress, and has a kickoff comment.
- [x] S135 is accepted and non-overlapping S139 ownership is recorded.
- [x] Parallel journey, data-flow, and bug-gap investigations are consolidated.
- [x] Deterministic capability test covers the retained non-destructive control matrix.
- [x] Browser failures are fail-loud: page errors, console errors, failed API responses, blank canvas, and unresolved loading are rejected.
- [x] Focused Playwright contract passes on the canonical authenticated record.
- [x] Live desktop, tablet, and mobile checks pass with screenshots and error summaries.
- [x] Test cleanup/read-back proves no persistent test junk remains.
- [x] PDF `HEAD` and viewer lifecycle unit guards pass (2 suites, 4 tests).
- [x] Registry strict audit passes with the viewer guardrail active.
- [x] Handoff and evidence are complete; Linear review comment is prepared by the handoff command.
- [x] Task-owned changes are published to `origin/main` and HEAD matches it.

## Acceptance Criteria

- One command reruns the exact-route viewer capability contract with saved auth.
- The suite proves each retained control is visible and meaningfully changes UI
  or viewer state; render-only controls are not counted as working.
- The suite creates no durable annotation, linked-item, or comment data.
- Any browser exception, actionable console error, failed viewer/API response,
  unresolved load state, or unusable drawing surface fails with specific evidence.
- The recurring-failure registry no longer reports drawings capability promotion debt.

## Failure-Loudly Contract

- Missing auth or fixture IDs fail with an actionable configuration error.
- A route redirect to login, a missing canvas/iframe, or a control with no observable
  state transition fails the browser test.
- Browser/page/network failures are summarized in the test error rather than hidden.
- Responsive proof records the exact viewport and screenshot path.

## Incident Learning

- Failure fingerprint: `frontend.viewer-capability-regression`
- Root cause: viewer replacement work proceeded without one executable contract for every retained user-visible capability.
- Detection gap: static checks and isolated browser notes did not continuously exercise the vendor viewer and the full visible control matrix.
- Prevention: an authenticated, deterministic Playwright capability contract plus live responsive agent-browser proof and strict registry enforcement.
- Guardrail evidence: `docs/ops/evidence/2026-07-13-drawings-capability-contract/REPORT.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear | `AAI-1061` | Pass | Issue created, moved to In Progress, kickoff comment posted. |
| Ownership | `docs/ops/orchestration/session-board.md` | Pass | S139 owns the contract, responsive header/navigation repair, and the two root-cause guards exposed by the contract; S138 annotation-object files remain excluded. |
| Parallel investigation | Journey, data-flow, bug-gap agents | Pass | Existing env-gated test silently skipped and covered only one rectangle; exact route fixture and safe no-junk contract were identified. |
| Pre-fix mobile proof | `mobile-layout.json` and `mobile-375x812.png` | Fail | Download and Close rendered at x=501 and x=541 outside the 375px viewport. |
| Responsive repair | `mobile-375x812-after.png` and `mobile-actions-menu.png` | Pass | Priority navigation remains in the header; secondary panels, download, and close are reachable from a 44px overflow action. |
| Focused unit guards | `pnpm exec jest --runTestsByPath ... --runInBand` | Pass | 2 suites and 4 tests passed for explicit PDF HEAD and vendor mount/Strict Mode/error cleanup. |
| Browser contract | `PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm exec playwright test --config config/playwright/playwright.config.drawings-capability.ts` | Pass | 3/3 passed in 2.3 minutes on the canonical authenticated record. |
| Registry | `node scripts/ops/learning-registry.mjs audit --strict` | Pass | Eight fingerprints active with no promotion debt. |
| Publish | `git push origin HEAD:main` plus local/remote read-back | Pass | Implementation commit `1d59cd7653930e02df1223fe933940fff724e92f` published to `origin/main`; local HEAD matched the fetched remote. |
| Full build supplement | delegated `pnpm exec next build` | Blocked/Deferred | Unrelated build infrastructure exhausted the default heap; high-memory output tracing recursively exceeded 5.3 GB. Focused source/browser guards passed. |

## Remaining Risk

- Live Velt comment creation/submission belongs to S136 and is excluded from this
  non-destructive contract until that session publishes its persistent-comment flow.

## Final Status

- [x] All implementation and end-to-end evidence items are complete.
- [x] Publish/read-back item is complete.
