# Task: Restore AI Dashboard Dark Theme

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: AAI-1143
Linear Issue: [AAI-1143](https://linear.app/megankharrison/issue/AAI-1143/restore-dark-theme-across-ai-dashboard-workspace)
Related Handoff: `docs/ops/handoffs/2026-07-17-S184-ai-dashboard-dark-theme.md`

## Objective

Restore the approved premium dark appearance across `/ai-dashboard` and every child route without changing the global theme behavior of the rest of the application.

## Scope

- Shared route owner: `frontend/src/app/(main)/layout.tsx`.
- Existing route token owner: `frontend/src/app/(main)/ai-dashboard-theme.module.css`, including same-node activation for the shared wrapper.
- Regression guard: `frontend/src/app/(main)/ai-dashboard/__tests__/theme-contract.test.ts`.
- Exact browser proof: Overview and Architecture at desktop and mobile widths.
- Excluded: global `ThemeProvider`, non-AI routes, page content, data behavior, and page-local color overrides.

## Source of Truth

- Canonical runtime owner: the `(main)/layout.tsx` route boundary that identifies `/ai-dashboard` and nested routes.
- Existing shared primitive: `ai-dashboard-theme.module.css`, whose dark token set is activated by an ancestor `dark` class.
- Deprecated or parallel paths: page-local dark classes and global theme changes are not permitted.

Verification contract: Required

## Attention Architecture

- Primary user: executive reviewing the AI Dashboard workspace.
- Primary job: scan portfolio signals and move between child pages on a consistent premium dark canvas.
- Primary decision: identify the most important live signals without theme changes competing with the content.
- Tier 1: dashboard visualizations, decisions, and active navigation.
- Hidden until requested: supporting detail already handled by existing interactions.
- Removal candidates: none; this is a shared visual regression repair.
- Primary action: existing route navigation remains unchanged.
- Failure-loudly behavior: a focused source contract fails if the shared AI route boundary stops applying `dark` or if the CSS dark token owner disappears.

## Acceptance Criteria

- [x] `/ai-dashboard` renders with the shared dark token set regardless of the global system theme.
- [x] Every `/ai-dashboard/*` child route inherits the same dark workspace contract.
- [x] Non-AI routes continue to inherit the global app theme.
- [x] Orange accent tokens and current content hierarchy remain unchanged.
- [x] Desktop and mobile proof show readable, overflow-free Overview and Architecture routes.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared route abstraction owns the repair; no page-local overrides are introduced.
- [x] Focused guardrail covers root, child, and non-AI route behavior.
- [x] Database, provider, authentication, permission, and delivery contracts are not applicable.

## Integration and Verification

- [x] Focused Jest and targeted static checks pass.
- [x] Live DOM/computed-style readback proves the dark theme on root and child routes.
- [x] Desktop and mobile screenshots are captured and visually reviewed.
- [x] Independent reviewer approves the exact-route result.
- [x] Verification manifest/result pair passes with `--require-pass`.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the AI Dashboard wrapper omits `dark`, dark tokens cannot activate, or a non-AI route is forced dark.
- Detection path: `theme-contract.test.ts`, live DOM/computed-color readback, responsive screenshots, and independent review.
- Recovery path: restore the shared route predicate/class contract and rerun exact-route browser proof.

## Incident Learning

- Failure fingerprint: `N/A`; the learning-registry lookup returned unrelated route fingerprints.
- Root cause: commit `e4b898788` removed the shared AI route's `dark` class while leaving the global theme system-driven; the route CSS also recognized only a dark ancestor, not the `dark` class on its own shared wrapper.
- Detection gap: the existing test explicitly approved the absence of forced dark mode and did not prove the same-node CSS activation used by the layout.
- Prevention: replace the inverted assertion with positive root/child dark ownership, same-node token activation, and non-AI isolation coverage.
- Guardrail evidence: focused Jest 2/2, browser root/child/isolation readbacks, and verification contract PASS.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live regression | Browser readback on `/ai-dashboard` | Fail as expected | `<html>` is light, route wrapper lacks `dark`, computed shell background is `rgb(250, 250, 250)`. |
| Historical localization | `git diff e4b898788^ e4b898788 -- frontend/src/app/(main)/layout.tsx` | Pass | Shows the exact removal of the route-owned `dark` class. |
| First repair readback | Browser readback on `/ai-dashboard` | Fail as expected | Wrapper regained `dark`, but the descendant-only token selector left its background light; same-node activation is now in scope. |
| Linear/task setup | AAI-1143 and S184 | Pass | Scope and completion contract recorded before implementation. |
| Focused regression | AI Dashboard theme Jest | Pass | 1 suite, 2 tests passed after cache cleanup. |
| Targeted quality | ESLint and `quality:changed` | Pass | No scoped lint, type-debt, unsafe-pattern, or route-guardrail regression. |
| Impeccable audit | `audit-surface-complexity.mjs` | Pass | No additive UI complexity. |
| Browser proof | `verification.md` and four screenshots | Pass | Root/child dark tokens, non-AI isolation, and 390px overflow safety verified. |
| Independent review | `independent-review.md` | Approved | Ohm approved theme, readability, responsive behavior, noise, and source ownership. |
| Verification contract | `verification-manifest.json`; `verification-result.json` | Pass | PASS is supported by the declared evidence. |
| Screenshot comment | AAI-1143 attachments `2bdfbd30-4f2e-4ade-9cd0-9a8477ace29d` and `bde7c236-949a-479d-b161-f99f9e39de3a` | Pass | Desktop and mobile Overview evidence is viewable from the issue. |
| Publication | PR #42; `f9ba37c113862ecba35685a280772b991afb74c1` | Pass | Auto-merge completed with no failing checks; local `main` was fast-forwarded to `origin/main`. |

## Remaining Risk

- Desktop screenshot evidence is 882px wide rather than 1440px. The task does not alter layout geometry; exact computed-style readback and 390px overflow proof cover the changed theme contract.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
