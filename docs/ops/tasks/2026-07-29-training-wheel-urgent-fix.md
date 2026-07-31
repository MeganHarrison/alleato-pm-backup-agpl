# Task: Restore Role Skill Wheel Structure

Status: Ready for Publication
Owner: Codex
Created: 2026-07-29
Task ID: local-training-wheel-urgent-fix
Linear Issue: Not requested for this single-session Standard task.
Related Handoff: N/A

## Objective

Restore the training hub wheel section so Core Skills is the first accordion and
open by default, every role exposes its associated skills, and a synchronized
wheel remains visible on the right.

## Scope

- Own the training hub wheel section, shared role explorer, shared wheel sizing,
  focused regression test, and responsive browser evidence.
- Exclude assessment persistence, scoring behavior, and unrelated training
  sections.

## Source of Truth

- Canonical route owner: `frontend/src/app/(main)/training/TrainingHubClient.tsx`
- Canonical skill content: `frontend/src/app/(main)/training/own-your-growth/data.ts`
- Existing shared primitives: `RoleExplorer` and `RoleWheel`
- Deprecated runtime path: the separate `RoleWheelStory` section

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Core Skills is the first accordion and is expanded on initial render.
- [x] Every role from the canonical growth data has an accordion with its skills.
- [x] Opening an accordion updates the static wheel preview on the right.
- [x] The separate illustrative progression story is absent from the route.
- [x] The role-skill section uses a white background.
- [x] Method cards use compact step labels instead of oversized digital numbers.
- [x] Desktop and mobile screenshots show the final authenticated route.
- [x] Failure-loudly behavior is verified by a focused regression test.

## Implementation Checklist

- [x] Runtime failure was localized before editing.
- [x] Files and canonical owners were identified before editing.
- [x] Existing skill data and wheel primitives are reused.
- [x] Database, provider, authentication, permission, and delivery contracts are
      not applicable.

## Integration and Verification

- [x] Focused unit test passes.
- [x] Design complexity audit passes.
- [x] Authenticated desktop and mobile browser evidence is recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the focused route test fails when Core Skills is not first,
  not expanded, or does not own the initial wheel.
- Detection path: focused TrainingHubClient test plus authenticated final-route
  screenshots.
- Recovery path: restore the canonical `CORE` plus `ROLES` mapping in
  `RoleExplorer`.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the wheel and role explorer were implemented as two separate
  narrative sections, replacing the approved accordion-plus-wheel composition.
- Detection gap: the route test asserted the illustrative story rather than the
  required Core-first information architecture.
- Prevention: the focused regression now asserts Core Skills is first, expanded,
  and controls the initial wheel before checking a role transition.
- Guardrail evidence: focused test passed with Core-first and role transition
  assertions.

## Evidence

| Check                 | Command / artifact                                                                                           | Result          | Notes                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------- |
| Runtime localization  | `before-wheel-section.png`                                                                                   | Fail reproduced | Single illustrative story rendered instead of role accordions.                          |
| Focused regression    | `pnpm exec jest --runInBand --runTestsByPath 'src/app/(main)/training/__tests__/TrainingHubClient.test.tsx'` | Pass            | 3 tests passed.                                                                         |
| Targeted lint         | `pnpm exec eslint <four task-owned TSX files>`                                                               | Pass            | No lint findings.                                                                       |
| Surface audit         | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs <three changed UI files>`       | Pass            | All three files passed.                                                                 |
| Desktop browser proof | `final-desktop-project-engineer.png`                                                                         | Pass            | Authenticated route shows Project Engineer accordion and synchronized right-side wheel. |
| Mobile browser proof  | `final-mobile-core.png`, `final-mobile-wheel.png`                                                            | Pass            | Core opens first and the static wheel remains available in mobile flow.                 |
| Browser-comment proof | `final-desktop-method-and-white-wheel.png`, `final-mobile-white-wheel.png`                                   | Pass            | Method cards use quiet Step labels; the Core Skills section is white at both sizes.     |

## Remaining Risk

- Production publication and post-deploy readback remain before closeout.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] No deferred scope remains.
