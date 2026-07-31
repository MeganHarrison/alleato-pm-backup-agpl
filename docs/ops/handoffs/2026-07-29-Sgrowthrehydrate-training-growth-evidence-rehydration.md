# Handoff: Training Growth Evidence Rehydration

Session: Sgrowthrehydrate
Task: local-training-growth-evidence-rehydration
Status: In Progress

## Localized Boundary

Production DB rows and the server payload contained valid structured evidence,
while the rendered editing fields were blank. The first divergence was server
payload to client draft initialization.

## Confirmed Root Cause

`plansForRole()` copied saved frequency, resource, feedback, and phases but
unconditionally replaced `plan.evidence` with a new empty object.

## Prevention

Saved evidence now initializes the editable plan, with a focused regression
that proves a saved score can be changed without re-entering evidence.

## Verification

See `docs/ops/evidence/2026-07-29-training-growth-evidence-rehydration/verification.md`.
