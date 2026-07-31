# Task: Training Growth Shell Accessibility

Status: In Progress
Owner: Codex
Created: 2026-07-29
Task ID: local-training-growth-shell-accessibility
Linear Issue: Not created; this is a single-session shared-shell correction.
Related Handoff: `docs/ops/handoffs/2026-07-29-Sgrowthshell-training-growth-shell-accessibility.md`

## Objective

Ensure the training growth assessment has one main landmark, readable muted text, and mobile-safe form typography.

## Scope

- Canonical `SidebarInset` landmark ownership.
- Shared training theme contrast and assessment form typography.
- Regression coverage and desktop/mobile browser evidence.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/components/ui/sidebar.tsx`
- Existing shared primitives/services: `SidebarInset`, training theme variables
- Deprecated or parallel paths: page-local landmark or color overrides

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] A normal application page exposes exactly one main landmark.
- [ ] Muted training text meets WCAG AA contrast on the assessment surfaces.
- [ ] Assessment inputs remain readable without mobile browser zoom.
- [ ] Desktop and mobile evidence show no horizontal overflow.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Duplicate landmark root cause is corrected at the primitive.
- [x] Contrast is corrected through the canonical training theme variable.

## Integration and Verification

- [ ] Targeted unit and static checks pass.
- [ ] Actual browser readback proves one main landmark.
- [ ] Desktop and mobile screenshots are recorded.
- [ ] Independent review passes.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: regression test fails if `SidebarInset` creates a second main landmark.
- Detection path: targeted Jest test plus browser landmark count and computed contrast check.
- Recovery path: restore the layout-only element and the AA-compliant theme variable.

## Incident Learning

- Failure fingerprint: `design.page-composition-contract-drift`
- Root cause: The shared sidebar layout primitive claimed semantic main ownership while route shells already owned the primary content landmark.
- Detection gap: The component had no landmark-count regression test and the assessment audit did not originally include computed contrast.
- Prevention: Unit coverage plus desktop/mobile browser accessibility evidence.
- Guardrail evidence: `sidebar-inset.test.tsx` passes; computed contrast is 6.10:1 on white and 5.84:1 on the training paper surface.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Landmark unit contract | `pnpm exec jest --runInBand src/components/ui/__tests__/sidebar-inset.test.tsx` | Pass | Layout wrapper no longer creates a second main landmark. |
| Contrast computation | `#66615f` against `#fff` and `#fafaf8` | Pass | 6.10:1 and 5.84:1, both above WCAG AA for normal text. |
| Independent review | `/root/growth_accessibility_review` | Pass | Layout-only inset is correct when immersive routes own an explicit main landmark. |

## Remaining Risk

- Pending integrated desktop/mobile browser verification.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
