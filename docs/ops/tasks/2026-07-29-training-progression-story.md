# Task: Complete Training Progression Story

Status: In Progress
Owner: Codex
Created: 2026-07-29
Task ID: local-training-progression-story
Linear Issue: Not requested for this single-session Standard task.
Related Handoff: N/A

## Objective

Replace the training hub's static role-wheel and proficiency treatments with the approved responsive progression story: a pinned Project Engineer example, a separate role explorer, and one integrated capability ladder.

## Scope

- Own the shared wheel data and SVG, scroll-driven wheel story, role explorer, capability ladder, shared rubric copy, training hub integration, GSAP dependencies, focused tests, and route-level visual evidence.
- Exclude assessment persistence, scoring behavior, and unrelated training-page sections.

## Source of Truth

- Canonical route owner: `frontend/src/app/(main)/training/TrainingHubClient.tsx`
- Shared content owner: `frontend/src/features/training/method-content.ts`
- Reused implementation owners: `RoleWheel`, `RoleWheelStory`, and `RoleExplorer`
- Removed parallel paths: local static role-wheel demo, proficiency pills, and detached readiness checklist

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [ ] Project Engineer is the single illustrative pinned wheel story; each focus pair improves separately and earlier gains persist.
- [ ] The story uses non-guarantee language and labels the values as illustrative.
- [ ] The role explorer follows the story and exposes three roles, eight skills, capability families, expected level, wheel preview, and assessment action.
- [ ] The old proficiency headline, five pills, isolated definition, and detached checklist are absent.
- [ ] Desktop capability progression uses one scoped GSAP timeline for roughly three viewport heights.
- [ ] Mobile uses naturally flowing or sticky narrative content without full-viewport pinning.
- [ ] Reduced-motion mode exposes the complete written story without scrubbed animation.
- [ ] GSAP cleanup is scoped through `useGSAP` and `matchMedia`.
- [ ] Failure-loudly behavior is defined and legacy duplicate paths are removed.

## Implementation Checklist

- [x] Existing route, components, and both local implementations were inspected before editing.
- [x] One shared wheel owns the illustrative story and role previews.
- [x] One capability ladder owns the five stages and advancement threshold.
- [x] Database, provider, authentication, permission, and delivery contracts are not applicable.

## Integration and Verification

- [ ] Targeted unit tests pass.
- [ ] Design complexity audit passes.
- [ ] Desktop, mobile, and reduced-motion browser proofs demonstrate the requested behavior.
- [ ] Evidence artifacts are recorded.
- [ ] Task-owned files are published and remote state is verified.

## Failure-Loudly Contract

- Cause surfaced as: semantic wheel labels, chapters, and the completed ladder remain readable if GSAP or ScrollTrigger does not initialize.
- Detection path: focused tests verify the structural fallbacks; browser checks verify desktop pinning and mobile/reduced-motion presentation.
- Recovery path: users can consume the entire progression as normal document flow without relying on animation.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: complementary wheel and ladder implementations were split across separate stale workspaces.
- Detection gap: no single task owned consolidation and publication of both sections.
- Prevention: exact-path registered workspace, one Standard task record, targeted verification, `codex:finish`, and workspace retirement.
- Guardrail evidence: isolated-workspace registry plus the publication receipt recorded at closeout.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Consolidated scope and publication gate captured. |

## Remaining Risk

- Scroll pacing and viewport behavior must be tuned against the running page before closeout.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
