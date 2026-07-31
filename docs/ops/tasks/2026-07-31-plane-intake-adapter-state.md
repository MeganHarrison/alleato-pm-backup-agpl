# Task: Plane Intake resolution view model

Status: Complete
Owner: Codex S20260731-PLANE-INTAKE-ADAPTER-STATE
Created: 2026-07-31
Task ID: AAI-PLANE-INTAKE-ADAPTER-STATE

Delivery lane: Standard

## Objective

Normalize persisted task and Outlook Plane Intake metadata into one view model
for the replacement Intake client.

## Acceptance Contract

- [x] Task and Outlook rows share decision and snooze fields.
- [x] Accepted, declined, and duplicate rows move to the closed tab.
- [x] Active snoozes remain open and surface a snoozed status.
- [x] Missing or malformed metadata safely falls back to pending.

## Failure-Loudly Contract

The adapter rejects malformed metadata into a safe pending state. API mutation
errors remain visible through the action controller and are never inferred as a
successful decision.

## Evidence

- Existing adapter tests pass before integration-specific cases are added by
  the owning integration workspace.
- Targeted ESLint and diff integrity pass.
