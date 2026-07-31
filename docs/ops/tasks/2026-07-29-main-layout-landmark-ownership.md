# Task: Main Layout Landmark Ownership

Status: In Progress
Owner: Codex
Created: 2026-07-29
Task ID: local-main-layout-landmark-ownership
Linear Issue: Not created; bounded companion to the shared-shell accessibility correction.
Related Handoff: `docs/ops/handoffs/2026-07-29-Sgrowthlayout-main-layout-landmark-ownership.md`

## Objective

Preserve one explicit primary content landmark for immersive chat routes after the shared sidebar inset becomes layout-only.

## Scope

- Immersive branch of the canonical main application layout.
- Focused source contract.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/layout.tsx`
- Existing shared primitives/services: `SidebarInset`, `feedbackTargetProps`
- Deprecated or parallel paths: semantic ownership in the layout-only inset wrapper

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [ ] Immersive routes have one explicit `main` with the canonical content ID.
- [ ] Normal routes continue using their existing content `main`.
- [ ] Training growth browser proof reports one main landmark.

## Failure-Loudly Contract

- Cause surfaced as: focused landmark contract or browser landmark count fails.
- Detection path: targeted Jest plus authenticated browser DOM query.
- Recovery path: keep semantic ownership on the route-content node, never the sidebar layout wrapper.

## Incident Learning

- Failure fingerprint: `design.page-composition-contract-drift`
- Root cause: Landmark ownership was split between a layout wrapper and route content.
- Detection gap: The immersive branch depended implicitly on the sidebar wrapper's element type.
- Prevention: Explicit immersive landmark plus shared primitive regression coverage.
- Guardrail evidence: `main-layout-landmarks.test.ts` and `sidebar-inset.test.tsx`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Exact ownership and closeout gate recorded. |

## Final Status

- [ ] Targeted test passes.
- [ ] Browser landmark proof passes.
- [ ] Task-owned files are published.
