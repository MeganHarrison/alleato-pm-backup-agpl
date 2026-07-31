# Task: Training Growth Wheel Hydration

Status: In Progress
Owner: Codex
Created: 2026-07-29
Task ID: local-training-growth-wheel-hydration
Linear Issue: Not created; single-session bounded runtime fix.
Related Handoff: `docs/ops/handoffs/2026-07-29-Sgrowthwheel-training-growth-wheel-hydration.md`

## Objective

Render the authenticated skill wheel without a server/client hydration mismatch while preserving its accessible name and score description.

## Scope

- `SkillWheel` accessible SVG labeling.
- Focused regression coverage.
- No assessment scoring or persistence changes.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/features/training/SkillWheel.tsx`
- Existing shared primitives/services: HTML ARIA ID references and Tailwind `sr-only`
- Deprecated or parallel paths: dynamic SVG `title` and `desc` children under Next server rendering

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [ ] Authenticated server/client rendering emits no hydration error.
- [ ] The wheel retains an accessible name and detailed score description.
- [ ] Focused unit test and assessment E2E pass.

## Failure-Loudly Contract

- Cause surfaced as: console-error assertion fails on hydration mismatch.
- Detection path: targeted component test and training-growth Playwright journey.
- Recovery path: keep dynamic accessible copy in ordinary HTML referenced by the SVG.

## Incident Learning

- Failure fingerprint: `frontend.viewer-capability-regression`
- Root cause: Next server output consumed dynamic SVG `title` content, while server and browser JavaScript engines also serialized raw trigonometric coordinates at different last digits.
- Detection gap: Component tests did not inspect the authenticated server response or fatal console errors.
- Prevention: No dynamic SVG document-title elements, deterministic three-decimal geometry, and an E2E that keeps hydration console failures fatal.
- Guardrail evidence: `pnpm exec jest --runInBand src/features/training/__tests__/skill-wheel.test.tsx` passes and asserts the accessible contract without dynamic SVG title elements; the fatal-console E2E remains the closeout proof.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Authenticated response vs hydrated DOM | Pass | Server emitted an empty SVG title; client emitted the role-specific title. |

## Final Status

- [ ] Targeted checks pass.
- [ ] Browser journey passes.
- [ ] Task-owned files are published.
