# Task: Repair FMDS 8-9 Structured Review Evidence

Status: In Progress
Owner: Codex S205
Task ID: AAI-1211
Linear Issue: https://linear.app/megankharrison/issue/AAI-1211/prepare-fmds-8-9-estimator-review-batch-1

## Objective

Replace the empty candidate grids for Tables 12, 13, 15, 16 and the empty Figure 3 description with source-bound candidate evidence, without approving or activating any object.

## Acceptance Criteria

- [ ] Candidate evidence contains page, revision, source hash, and explicit transcription/facts.
- [ ] All five objects remain `needs_review`.
- [ ] Live readback rejects missing source identity or active-revision leakage.
- [ ] Evidence screenshot is attached to AAI-1211.

## Failure-Loudly Contract

Candidate generation must reject a source hash, page, object identity, or review state mismatch and never silently promote an extraction.
