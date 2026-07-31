# Task: Refine AI Dashboard Spacing and Content Hierarchy

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: AAI-1141
Linear Issue: [AAI-1141](https://linear.app/megankharrison/issue/AAI-1141/refine-ai-dashboard-spacing-and-content-hierarchy)
Related Handoff: `docs/ops/handoffs/2026-07-17-S182-ai-dashboard-spacing-order.md`

## Objective

Give the AI Dashboard more horizontal breathing room, place its executive charts before supporting content, and remove borders used only to separate page sections.

## Scope

- Update the shared AI Dashboard workspace gutter owner and shared section primitive.
- Reorder the Overview visualizations ahead of Daily Brief and operating health.
- Remove local page-section rules from the Projects page and visualization footers.
- Preserve legitimate bounded chart surfaces, row separators, source states, and responsive controls.
- Exclude data, API, database, authentication, provider, and delivery behavior changes.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/(main)/ai-dashboard/**`
- Shared layout primitives: `workspace-shell.tsx` and `workspace-primitives.tsx`
- Existing visualization owner: `visualizations/executive-dashboard-visualizations.tsx`
- Deprecated or parallel paths: route-local gutter overrides and border-based page-section hierarchy

Verification contract: Required

## Acceptance Criteria

- [x] Main-content gutters visibly increase at desktop and mobile widths without overflow.
- [x] Project Lifecycle, Activity River, and AI Opportunity Wheel render before Daily Brief.
- [x] Page-level section borders are removed across the shared workspace default.
- [x] Projects-page local section rules are removed while list-row separators remain.
- [x] Desktop and mobile visual quality is independently approved.

## Implementation Checklist

- [x] Shared workspace primitives own cross-page padding and divider behavior.
- [x] Overview content order reflects executive decision priority.
- [x] Regression tests cover the gutter tokens, chart order, and borderless section default.
- [x] Database, provider, authentication, permission, and delivery contracts remain unchanged.

## Integration and Verification

- [x] Focused Jest, targeted ESLint, changed-file quality, and surface-complexity checks pass.
- [x] Authenticated browser geometry proves gutter width, order, and no horizontal overflow.
- [x] Desktop and 375px mobile screenshots exist for Overview and Projects.
- [x] Independent functional and visual review approves the result.
- [x] Viewable desktop and mobile screenshots are attached to AAI-1141.
- [x] Verification contract passes with `--require-pass`.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: focused DOM-order, responsive-token, and shared-section tests fail when hierarchy regresses.
- Detection path: focused Jest, authenticated browser geometry, overflow readback, screenshots, and independent visual review.
- Recovery path: restore the shared gutter/section contracts and recapture exact-route desktop/mobile proof.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the existing content sequence placed supporting brief content before the requested decision charts, while section rules supplied hierarchy that spacing could carry more quietly.
- Detection gap: prior tests asserted chart presence but not chart order, shared gutter values, or borderless section defaults.
- Prevention: regression assertions now cover all three layout contracts, supported by exact-route visual evidence.
- Guardrail evidence: focused tests, surface-complexity audit, browser geometry, screenshots, independent review, and verification contract PASS.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | Three AI Dashboard Jest suites | Pass | 14/14 tests passed. |
| Static quality | Targeted ESLint and `quality:changed` | Pass | No new debt or unsafe patterns. |
| Design audit | Alleato surface-complexity audit | Pass | Five changed UI files passed. |
| Browser geometry | `verification.md` | Pass | 24px mobile gutters, 80px desktop gutters, correct order, zero document overflow. |
| Visual evidence | `docs/ops/evidence/2026-07-17-ai-dashboard-spacing-order/screenshots/` | Pass | Overview and Projects captured at 1440x1000 and 375x812. |
| Independent review | `independent-review.md` | Pass | Godel approved with no blocker. |
| Linear proof | AAI-1141 attachments | Pass | Desktop and mobile screenshots are viewable on the issue. |

## Remaining Risk

- The lifecycle module intentionally retains contained horizontal scrolling on narrow screens. The 375px overflow readback and independent review guard against document-level overflow.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
