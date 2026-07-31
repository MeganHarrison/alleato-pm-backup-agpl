# Task: Training Resource Library Parity

Status: Complete
Owner: Codex S330
Created: 2026-07-27
Task ID: LOCAL-20260727-TRAINING-RESOURCE-PARITY
Linear Issue: N/A, user requested direct implementation in this session.
Related Handoff: N/A, single-session Standard delivery.

## Objective

Carry the approved standalone training hub and Construction Resource Library format into the live PM application while preserving the canonical PM shell, routes, data, and access controls.

## Scope

- Shared training masthead used by the hub and Resource Library.
- Resource Library controls, result count, topic grouping, resource tiles, and no-match recovery.
- Focused component/page tests and responsive browser proof.
- Excludes training database schema, resource ingestion, reviewer workflow behavior, and guide body content.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/training/**`, `frontend/src/features/training/**`, and `frontend/src/lib/training/**`
- Existing shared primitives/services: `PageShell`, `Button`, `Card`, `Input`, `Select`, `ToggleGroup`, `SectionRuleHeading`, and the existing training server/adapter
- Approved visual reference: `training-source/index.html` and `training-source/guides/Resource-Library.html`
- Deprecated or parallel paths: standalone HTML is reference-only and will not become a second runtime owner.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The live training hub keeps the approved standalone masthead and eight-module layout.
- [x] The live Resource Library uses the standalone hierarchy: dark branded masthead, grouped filters, visible result count, topic sections, and responsive resource tiles.
- [x] Role, track, type, depth, and search filters remain functional.
- [x] No-match state explains the failure and offers a one-click reset.
- [x] Reviewer-only access remains conditional and linked to the canonical review queue.
- [x] The PM app shell and canonical training routes remain intact.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an explicit no-match or unavailable-resource state, never an empty topic canvas.
- Detection path: focused component tests plus browser verification of filters, reset, and external resource links.
- Recovery path: clear filters in one action; unavailable data states explain that reviewed resources have not been published.

## Incident Learning

This is an approved presentation-parity enhancement, not an incident or recurring runtime failure.

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Focused page/component tests retain the shared masthead, grouped controls, result count, and reset behavior.
- Guardrail evidence: 25 focused unit tests, the Alleato surface-complexity audit, five responsive browser widths, 44px mobile target readback, and scoped WCAG A/AA audits.

## Evidence

| Check             | Command / artifact                                                                                   | Result | Notes                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused tests     | `./node_modules/.bin/jest --config jest.config.js --runInBand --runTestsByPath ...`                  | Pass   | 6 suites, 25 tests.                                                                                                                                       |
| Focused lint      | `./node_modules/.bin/eslint <task-owned UI and test files>`                                          | Pass   | No findings.                                                                                                                                              |
| Noise gate        | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs <six changed surfaces>` | Pass   | All changed surfaces passed.                                                                                                                              |
| Browser behavior  | Authenticated `/training/library` session                                                            | Pass   | 67 resources; `pull planning` narrowed to 4 resources in one topic; no-match reset restored all results; Field narrowed to 27 and removed PM-only topics. |
| Canonical actions | Browser DOM readback                                                                                 | Pass   | Resource opens in a new tab with `noreferrer`; reviewer action resolves to `/training/review`.                                                            |
| Responsive layout | `library-{1440,1024,768,414,375}-final.png`                                                          | Pass   | No horizontal overflow at any required width.                                                                                                             |
| Mobile controls   | 375px DOM geometry readback                                                                          | Pass   | All visible filter controls are at least 44x44px.                                                                                                         |
| Accessibility     | Scoped `agent-browser a11y --tags wcag2a,wcag2aa --json`                                             | Pass   | Zero violations in the branded masthead and training-resource subtree.                                                                                    |
| Hub regression    | `training-hub-{1440,375}-final.png`                                                                  | Pass   | Shared masthead renders and both widths have no horizontal overflow.                                                                                      |
| Diff guard        | `git diff --check`                                                                                   | Pass   | No whitespace errors.                                                                                                                                     |
| Publication       | `npm run codex:finish -- --session S330 --allow-staged ...`                                          | Pass   | 13 exact files published to `origin/main` at `7a68415a`; closeout workspace began with local `HEAD == origin/main` at `fe7fca4e`.                         |

Evidence directory: `/home/friday/.codex/visualizations/2026/07/26/019f9fac-af01-7313-a2c6-c78d84fdac07/training-resource-parity/`

## Remaining Risk

- Standalone content includes source types that the live database normalizes to the PM training domain; this task preserves the live typed data contract.
- Full-page browser console still reports the unrelated local-development error `[Velt] NEXT_PUBLIC_VELT_API_KEY is not configured.` from `frontend/src/components/velt/VeltAuthProvider.tsx` and `frontend/src/lib/comments/all-comments.ts`; production credential ownership is outside this presentation task. The scoped changed surfaces have zero WCAG violations and no task-related runtime errors.
- No remaining Resource Library presentation risk was found in the five-width browser pass.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
