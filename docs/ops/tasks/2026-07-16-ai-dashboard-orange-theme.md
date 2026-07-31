# Task: Retheme AI Dashboard Accent Orange

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1130
Linear Issue: [AAI-1130](https://linear.app/megankharrison/issue/AAI-1130/retheme-the-shared-ai-dashboard-accent-orange)
Related Handoff: `docs/ops/handoffs/2026-07-16-S172-ai-dashboard-orange-theme.md`

## Objective

Replace the shared AI Dashboard violet accent with one warm orange palette tuned for the premium dark canvas, while preserving every child page's layout, responsive behavior, and semantic token ownership.

## Scope

- Owner: `frontend/src/app/(main)/ai-dashboard-theme.module.css`.
- Regression guard: `frontend/src/app/(main)/ai-dashboard/__tests__/theme-contract.test.ts`.
- Exact visual proof: `/ai-dashboard/architecture` at 1458 x 1009 and 390 x 844.
- Excluded: workspace layout, navigation behavior, content structure, data behavior, and global Alleato theme tokens.

## Source of Truth

- Canonical route-theme owner: `ai-dashboard-theme.module.css`, applied by `(main)/layout.tsx` to `/ai-dashboard` and all nested routes.
- Existing shared primitives: semantic `primary`, `ring`, and `sidebar-*` CSS variables consumed by existing components.
- Deprecated or parallel paths: direct violet values in the AI Dashboard route theme are removed; no page-local orange classes are introduced.

Verification contract: Required

## Attention Architecture

- Primary user: executive navigating the AI Dashboard family.
- Primary job: understand current location and important actions on a quiet dark canvas.
- Primary decision: identify the active destination and actionable links without a competing accent palette.
- Tier 1: page content and active destination.
- Tier 2: actionable links, selected paths, and source indicators.
- Tier 3: supporting status metadata.
- Hide until requested: no new content.
- Remove: the route-scoped violet palette.
- Primary action: existing navigation and architecture inspection remain unchanged.
- Failure-loudly behavior: a focused source contract rejects every prior violet token and browser readback verifies the computed orange value.

## Acceptance Criteria

- [x] `/ai-dashboard` and every child page inherit one warm orange accent from the existing route-theme owner.
- [x] Primary, foreground, ring, sidebar primary, and sidebar-muted roles remain internally consistent.
- [x] No page-local color override or second accent palette is introduced.
- [x] The Architecture route remains readable and visually balanced at desktop and mobile widths.
- [x] Desktop and mobile document widths do not exceed their viewports.
- [x] The regression test rejects every legacy violet value.

## Implementation Checklist

- [x] The finish gate promoted the initial micro-change to AAI-1130/S172 before publication.
- [x] The canonical route-scoped theme is reused; no new UI component is created.
- [x] The test covers primary, foreground, ring, and sidebar assignments.
- [x] Database, provider, auth, permission, and deployment contracts remain unchanged.

## Integration and Verification

- [x] Focused AI Dashboard tests pass.
- [x] Targeted lint, changed-type debt, and diff checks pass.
- [x] Impeccable surface complexity audit passes.
- [x] Exact-route desktop and mobile screenshots are captured and visually reviewed.
- [x] Browser readback proves the orange value, contrast, and overflow safety.
- [x] Independent design reviewer approves the corrected palette and guardrail.
- [x] Verification manifest/result pair passes with `--require-pass`.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a legacy violet token reappears, route roles stop referencing the shared orange variables, or the exact route overflows its viewport.
- Detection path: `theme-contract.test.ts`, computed browser token/color readback, responsive screenshot review, and independent review.
- Recovery path: correct the route-scoped token mapping and rerun the focused test plus exact-route desktop/mobile proof.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A; this is an explicit palette change.
- Detection gap: the first test revision rejected only the old primary violet, not all old sidebar/foreground violet roles.
- Prevention: the corrected contract asserts every route-owned role and rejects all four prior violet values.
- Guardrail evidence: focused Jest 8/8 and independent re-review approval.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear/task setup | AAI-1130 and S172 | Pass | Full closeout created when the publication gate required a task definition. |
| Focused regression | AI Dashboard Jest | Pass | 2 suites, 8 tests passed. |
| Targeted static checks | ESLint, `typecheck:changed`, `git diff --check` | Pass | No scoped static failures. |
| Impeccable audit | `audit-surface-complexity.mjs` | Pass | No additive UI complexity. |
| Desktop proof | `architecture-desktop-orange.png` | Pass | Exact route, clean overlay state, orange active/label/link treatment, no overflow. |
| Mobile proof | `architecture-mobile-orange.png` | Pass | Exact route at 390px, orange labels and status dot, no document overflow. |
| Browser readback | `verification.md` | Pass | Accent `rgb(249, 166, 77)`, 9.85:1 contrast on the page canvas. |
| Independent review | `independent-review.md` | Approved | Initial test gap corrected; final decision PASS with no scoped defects. |
| Verification contract | `verification-manifest.json` and `verification-result.json` | Pass | Required evidence supports both claims. |
| Screenshot comment | AAI-1130 attachments `9e4c9d3f-ba37-4ef3-919c-de80c6544166` and `c62f9d5a-d55b-49c3-a413-995b75254111` | Pass | Desktop and mobile exact-route screenshots are viewable from the issue. |
| Publication | `npm run codex:finish` | Pass | Implementation and evidence published to `origin/main` at `a281561d47`; closeout-only metadata follows. |

## Remaining Risk

- The mobile workspace tabs are horizontally scrollable and the active Architecture tab can sit outside the initial viewport. This pre-exists the theme change. Owner: `AiDashboardWorkspaceShell`. Next action: address only under a separate navigation-focused request.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A with the corrected guardrail documented.
- [x] Deferred navigation behavior names cause, owner, scope boundary, and next action.
