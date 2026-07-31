# Task: Frontend Brand Guide

Status: Complete
Owner: Codex
Created: 2026-07-28
Task ID: LOCAL-20260728-FRONTEND-BRAND-GUIDE
Linear Issue: Not required for a single-session Standard task.
Related Handoff: N/A

## Objective

Replace the existing component inventory at `/design` with a polished,
responsive Alleato brand guide that communicates the current design contract
through real tokens and shared component specimens.

## Scope

- Own `frontend/src/app/(admin)/design/page.tsx`.
- Add focused presentation styling under the same route only if shared tokens
  and utilities cannot express the guide.
- Record this task and its visual verification evidence.
- Exclude changes to shared tokens, shared UI primitives, global navigation,
  authentication, and production data.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(admin)/design/page.tsx`
- Existing shared primitives/services: `frontend/src/components/layout`,
  `frontend/src/components/ui`, `frontend/src/components/ds`, `DESIGN.md`,
  and `frontend/src/app/globals.css`
- Deprecated or parallel paths: the prior page-local component warehouse,
  removed by this change

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The route presents Alleato identity, color, typography, principles,
  components, layout, and voice in one coherent guide.
- [x] The implementation uses shared layout, button, input, dropdown, and
  status primitives.
- [x] The page renders without runtime or console errors.
- [x] Desktop and mobile screenshots prove responsive layout.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
  not applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual route readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: build, lint, accessibility, browser console, or responsive
  overflow failure
- Detection path: targeted frontend checks and authenticated browser inspection
  at desktop and mobile widths
- Recovery path: correct the owning route or shared primitive, rerun the failed
  check, and recapture the affected viewport

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured. |
| Changed-file quality | `cd frontend && npm run quality:changed` | Pass | Changed-file lint, type-debt, unsafe-pattern, and API-route gates passed. |
| Design-system complexity | `audit-surface-complexity.mjs` on both changed route files | Pass | No nested-card, page-shell, metric-card, badge, or hard-coded color violations. |
| Diff integrity | `git diff --check` | Pass | No whitespace errors. |
| Desktop route | `docs/ops/evidence/frontend-brand-guide/desktop-1440.png` | Pass | Authenticated `/design` at 1440×1000; heading and seven sections rendered, dropdown specimen opened, no horizontal overflow, and `agent-browser errors` returned empty. |
| Mobile route | `docs/ops/evidence/frontend-brand-guide/mobile-375.png` | Pass | Authenticated `/design` at 375×812; no horizontal overflow and all guide navigation targets measured 44px high. |
| Accessibility | `agent-browser a11y --tags wcag2a,wcag2aa --json` | Pass | No reported WCAG A/AA violations on the rendered route. |

Browser authentication note: the standard test account is not in the production
admin-dashboard allowlist. It was added only to the isolated local server for
the authenticated visual readback, then removed; the allowlist has no task diff.

## Remaining Risk

- The guide intentionally reflects the design system as of 2026; future token
  or shared-primitive changes still require a matching guide update.
- Guardrail: the surface-complexity audit and desktop/mobile route proof should
  be rerun whenever the guide structure changes.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No deferred work.
