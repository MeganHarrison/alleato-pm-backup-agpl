# Task: Tighten Training Hero Copy

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: local-training-hero-copy
Linear Issue: N/A, single-session copy refinement
Related Handoff: N/A

## Objective

Replace the wordy training hero paragraph with a concise explanation of the learning method.

## Scope

- Change only the existing hero lead in `TrainingHubClient`.
- Preserve the hero hierarchy, actions, wheel, and responsive layout.

## Source of Truth

- Canonical runtime owner: `/training`
- Existing shared pattern: `TrainingHubClient` hero lead
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The hero copy explains the method without repeating the page title.
- [x] The copy is shorter and contains no format inventory or duplicate ownership slogan.
- [x] Desktop and mobile layouts remain readable with no horizontal overflow.

## Implementation Checklist

- [x] The existing hero lead is reused.
- [x] No component, style, action, or visual element is added.
- [x] Unrelated dirty files remain untouched.

## Integration and Verification

- [x] The focused training hub test passes.
- [x] Authenticated `/training` desktop and mobile screenshots show the final copy.
- [x] Mobile document width equals the viewport width.

## Failure-Loudly Contract

- Cause surfaced as: the authenticated route must contain the exact replacement sentence.
- Detection path: focused Jest coverage plus desktop and mobile browser readback.
- Recovery path: update the canonical hero lead and repeat the authenticated route readback.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: the hero lead repeated the growth message and enumerated four learning formats.
- Detection gap: copy economy was not part of the earlier hero review.
- Prevention: keep hero support copy to one method statement and one short proof cadence.
- Guardrail evidence: focused training hub test and the artifacts below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused test | `pnpm exec jest --runInBand --runTestsByPath src/app/(main)/training/__tests__/TrainingHubClient.test.tsx` | Pass | Canonical training hub renders successfully. |
| Desktop route | `2026-07-30-training-hero-copy.desktop.png` | Pass | Final copy is visible in the real authenticated app shell. |
| Mobile route | `2026-07-30-training-hero-copy.mobile.png` | Pass | Final copy remains readable; viewport and document width are both 390px. |

## Remaining Risk

- None within the requested copy-only scope.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly recorded.
- [x] No work is deferred.
