# Task: Training Library Redesign

Status: Complete
Owner: Codex S019fa694
Created: 2026-07-27
Task ID: LOCAL-20260727-TRAINING-LIBRARY-REDESIGN
Linear Issue: Not required for a single-session Standard task.
Related Handoff: N/A

## Objective

Turn `/training/library` into a quiet, search-first resource workspace where a learner can narrow the library, scan lessons, and open the right resource without decorative page chrome.

## Scope

- Own the training library page, shared library view, resource filters, resource row treatment, and their focused tests.
- Remove the unused legacy page-local stylesheet.
- Exclude resource data, reviewer permissions, lesson detail pages, and the separately owned training navigation/masthead work.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/training/library/page.tsx` and `frontend/src/app/(main)/training/training-page-client.tsx`
- Existing shared primitives/services: `PageShell`, `SectionHeader`, `Input`, `Select`, `EmptyState`, and `frontend/src/features/training/*`
- Deprecated or parallel paths: `frontend/src/app/(main)/training/library/resource-library.module.css`

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The page uses the standard app shell with one clear library title and one conditional reviewer action.
- [x] Search and four retrieval filters are compact, responsive, keyboard reachable, and resettable.
- [x] Resources render as open, fully linked rows grouped by topic, without cards or decorative wrappers.
- [x] Empty and no-match states expose a clear recovery path.
- [x] The library is visually verified at desktop and mobile widths.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are not changed.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published through the isolated-workspace finish flow and verified on `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the existing rejected promise from resource, role, topic, profile, or reviewer-access loading reaches the route error boundary instead of rendering a false empty library.
- Detection path: focused page test plus live route load.
- Recovery path: retry through the route error boundary; no user-entered state exists before load.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: focused component/page tests and browser screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused unit tests | `npm run test:unit -- --runInBand --runTestsByPath ...` | Pass | 4 suites, 20 tests. |
| Targeted lint | `npx eslint <8 changed TS/TSX files> --max-warnings 0` | Pass | No warnings or errors. |
| Complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs <4 changed UI files>` | Pass | All four files pass. |
| Desktop visual | `training-library-redesign-desktop.png` | Pass | 1440px authenticated local route. |
| Mobile visual | `training-library-redesign-mobile.png` | Pass | 375px, `scrollWidth === innerWidth`, 44px search/select targets. |
| Retrieval flow | Authenticated browser on `http://localhost:3002/training/library` | Pass | Search narrowed 67 resources to 3; Clear filters restored 67 and cleared the query. |

## Remaining Risk

- The separate training navigation/masthead sessions remain independently owned; this slice does not alter them.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
