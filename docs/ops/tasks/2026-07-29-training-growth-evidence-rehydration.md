# Task: Training Growth Evidence Rehydration

Status: In Progress
Owner: Codex Sgrowthrehydrate
Created: 2026-07-29
Task ID: local-training-growth-evidence-rehydration
Linear Issue: Not requested; this is a single-session production correction.
Related Handoff: `docs/ops/handoffs/2026-07-29-Sgrowthrehydrate-training-growth-evidence-rehydration.md`

Delivery lane: Standard

## Objective

Keep a saved growth assessment updateable by restoring its structured
situation, behavior, and outcome evidence into the editing form.

## Acceptance Contract

- [x] Saved evidence rehydrates into all three evidence fields.
- [x] Editing a saved score enables the update action when the saved assessment
      remains otherwise valid.
- [x] The focused client regression passes.
- [ ] The authenticated production assessment saves, reloads, and restores the
      reversible verification change.

## Failure-Loudly Contract

- Cause: name the missing client hydration field.
- Detection: focused client regression plus an authenticated production update.
- Recovery: reload the saved check-in; its persisted evidence must repopulate
  the form without manual re-entry.

## Root Cause

The server returned valid structured evidence, but `plansForRole()` replaced
every saved evidence object with `emptyEvidence()` during client draft
initialization.

## Detection Gap

Existing tests verified saved history display but did not verify that saved
evidence returned to the editable form or that the update action remained
available.

## Prevention

Use the saved evidence as the canonical draft source and retain a regression
that changes a saved score only after asserting all evidence fields rehydrate.

## Evidence

See `docs/ops/evidence/2026-07-29-training-growth-evidence-rehydration/verification.md`.
