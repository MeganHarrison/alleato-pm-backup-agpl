# Task: Evidence-linked schedule risk summary

Status: In Progress
Owner: SROOT1193A
Created: 2026-07-22
Task ID: AAI-1194
Linear Issue: [AAI-1194](https://linear.app/megankharrison/issue/AAI-1194/generate-evidence-linked-ai-schedule-risk-summaries)

## Objective

An authorized project user can read a schedule-risk summary that distinguishes unavailable evidence from no risk and links each material claim to its schedule, field, workflow, or document source.

## Scope

- Canonical schedule revisions, field updates, dependencies, submittal risk, and source-linked project evidence.
- Excludes unsupported predictive claims and unsourced generic AI summaries.

## Source of Truth

- Canonical runtime/data owner: published schedule revisions and existing project evidence APIs.
- Existing shared primitives/services: `frontend/src/lib/scheduling/`, `frontend/src/lib/ai/`, project intelligence evidence links.
- Deprecated or parallel paths: ungrounded dashboard prose.

Verification contract: Required

## Acceptance Criteria

- [ ] Unavailable source evidence is visibly distinct from no detected risk.
- [ ] Every material risk has a direct, canonical source link.
- [ ] Unauthorized users cannot read another project's summary.
- [ ] Targeted tests, live readback, browser screenshot, and Linear evidence are recorded.

## Implementation Checklist

- [x] Define a source-first risk-summary contract and red tests.
- [x] Implement a fail-closed evidence collector.
- [x] Add a guarded API and canonical Schedule UI surface.
- [ ] Verify links, permissions, and unavailable-evidence state end to end.

## Failure-Loudly Contract

- Cause surfaced as: explicit unavailable-source state, not an invented no-risk summary.
- Detection path: contract/API tests and browser proof.
- Recovery path: restore the named source connection, then regenerate the read-only summary.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Definition of done recorded before implementation. |
| Source-first contract | `npx jest --runTestsByPath src/lib/scheduling/__tests__/schedule-risk-summary.test.ts --runInBand --silent` | Pass | Missing published evidence is unavailable; each material claim requires a canonical source route. |
| Guarded API and UI | `npx jest --runTestsByPath src/lib/scheduling/__tests__/schedule-risk-summary.test.ts src/app/api/projects/[projectId]/scheduling/risk-summary/__tests__/route.test.ts src/components/scheduling/__tests__/schedule-risk-summary.test.tsx --runInBand --silent` | Pass | Unauthenticated API reads are rejected; Schedule rows link directly to their source records. |
| Route gate | `npm run check:routes` | Pass | No dynamic route conflicts. |

## Remaining Risk

- AI generation must remain grounded in source material; owner: Schedule implementation; next action: define the source contract before prompting.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
