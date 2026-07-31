# Task: Training Hub Value Demonstration

Status: Complete
Owner: Codex
Created: 2026-07-28
Task ID: local-training-value-demo
Linear Issue: Not required for this single-session Standard-lane change.
Related Handoff: N/A

## Objective

Turn the training hub’s middle narrative from an embedded instruction manual into an interactive demonstration of role-based skill growth that leads to the real assessment.

## Scope

- Own the `/training` hub component, its scoped theme, server-page adapter, and one focused component test.
- Remove the embedded assessment, AI prompt starters, duplicate score visualization, and standalone readiness section.
- Retain the method, quick toolkit, library, and final assessment CTA.
- Exclude changes to the persisted `/training/growth` assessment workflow and its shared `SkillWheel`.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/training/page.tsx`
- Existing shared primitives/services: `frontend/src/components/ui/tabs.tsx`, `frontend/src/features/training/SkillWheel.tsx`, `motion/react`
- Deprecated or parallel paths: the hub’s embedded `SkillGrowthClient` preview is removed; the real assessment remains `/training/growth`

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Role tabs change the demonstrated skills and wheel.
- [x] The wheel animates from a starting state to a focused-reps state and respects reduced motion.
- [x] One proficiency ladder replaces duplicated score explanations and includes the readiness checks.
- [x] AI Prompt Starters and the embedded assessment no longer render.
- [x] Both assessment CTAs link to `/training/growth`.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared Tabs owns role selection; the hub’s existing annular geometry owns the illustrative wheel.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are unchanged.

## Integration and Verification

- [x] Focused browser interaction test passes; a component test guardrail is included.
- [x] Targeted lint and Alleato surface-complexity audit pass.
- [x] Desktop and mobile browser proofs verify role switching, ladder interaction, removed content, and CTA destination.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are ready for exact-file publication to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing role/ladder controls, stale duplicate content, wrong CTA destination, or browser console/runtime error.
- Detection path: focused component assertions plus desktop/mobile browser DOM and screenshot checks.
- Recovery path: use the always-visible role tabs and growth-stage controls; the primary CTA opens the canonical assessment route.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: focused component test and browser assertions.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Targeted lint | `node node_modules/eslint/bin/eslint.js -- "src/app/(main)/training/TrainingHubClient.tsx" "src/app/(main)/training/page.tsx" "src/app/(main)/training/__tests__/TrainingHubClient.test.tsx"` from `frontend/` | Pass | No changed-file lint errors. |
| Alleato audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs "frontend/src/app/(main)/training/TrainingHubClient.tsx"` | Pass | Surface complexity gate passed. |
| Desktop wheel | `artifacts/training-value-demo-desktop.png` | Pass | Wheel rendered without horizontal overflow; both CTAs resolved to `/training/growth`; removed section count was zero. |
| Desktop ladder | `artifacts/training-proficiency-ladder-desktop.png` | Pass | Clicked Solo; selected state, matching definition, and readiness checks rendered. |
| Mobile wheel | `artifacts/training-value-demo-mobile.png` | Pass | At 375px, Project Engineer selection worked, controls were at least 44px tall, and horizontal overflow was zero. |
| Mobile ladder | `artifacts/training-proficiency-ladder-mobile.png` | Pass | At 375px, Teach selection worked, step controls were 58px tall, and horizontal overflow was zero. |
| Component guardrail | `node node_modules/jest/bin/jest.js --config jest.config.js --runInBand --runTestsByPath "src/app/(main)/training/__tests__/TrainingHubClient.test.tsx"` | Blocked by unrelated repo debt | Jest 30.2.0 resolves `jest-runtime` 30.4.2 and `jest-mock` 30.4.1, failing before test discovery with `clearMocksOnScope is not a function`. The changed test file passes ESLint; browser interaction proof covers this boundary. |

## Remaining Risk

- The repository’s local Jest dependency skew prevents executing the added component guardrail until the test-toolchain owner aligns Jest package versions. The actual component interaction is covered by the browser proofs above.

## Final Status

- [x] All required checklist items are complete for the Standard delivery lane.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No deferred work.
