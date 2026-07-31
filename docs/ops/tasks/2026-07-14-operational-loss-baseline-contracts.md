# Task: Operational Loss Baseline Contracts and Calibration Ledger

Status: Complete
Owner: Codex S147
Created: 2026-07-14
Task ID: AAI-1070
Linear Issue: AAI-1070 - https://linear.app/megankharrison/issue/AAI-1070/build-operational-loss-baseline-contracts-and-calibration-ledger
Related Handoff: `docs/ops/handoffs/2026-07-14-S147-operational-loss-baseline-contracts.md`

## Objective

Implement the first read-only Operational Loss Intelligence slice: freeze the
failure-episode contracts, measure source coverage, and publish an initial
source-backed calibration ledger that can safely expand to 30-50 episodes.

## Scope

- Define machine-readable episode, evidence, impact, confidence, and review contracts.
- Inventory the 180-day Deep Read/source window and label under-observed scopes.
- Seed the ledger from source-validated Deep Read cases, including healthy counterexamples.
- Validate source existence, project identity, dates, evidence grades, and exclusion compliance.
- Exclude intervention automation, continuous monitoring, and person-level scoring.

## Source of Truth

- Canonical runtime/data owner: RAG source tables plus app project/intelligence records.
- Existing shared primitives/services: corrected Daily Deep Read artifacts, AAI-1067 attribution ledger, packet-first intelligence architecture.
- Deprecated or parallel paths: raw chunk/message counts as the analytical unit are forbidden.

## Acceptance Criteria

- [x] Episode/evidence/impact/confidence contracts are explicit and machine-readable.
- [x] Source coverage is measured for the selected 180-day window.
- [x] Initial calibration ledger contains failure episodes and healthy counterexamples.
- [x] Every ledger source exists and matches its project/date contract.
- [x] AAI-1067 exclusions cannot enter the baseline silently.
- [x] Gaps are labeled under-observed rather than interpreted as no loss.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Planned task-owned paths:

- `docs/ai-plan/operational-loss/episode-contract.schema.json`
- `docs/ai-plan/operational-loss/calibration-ledger.json`
- `scripts/intelligence/operational-loss-baseline.mjs`
- `scripts/verify/verify_operational_loss_baseline.mjs`
- `docs/ops/evidence/2026-07-14-operational-loss-baseline/**`
- This task, S147 handoff, and S147 orchestration rows

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual live-system readback proves source and project integrity.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an episode cites a missing, excluded, misattributed, or under-observed source as confirmed evidence.
- Detection path: deterministic baseline verifier reports the episode, source, expected project/date, and failed contract.
- Recovery path: correct the source chain, downgrade the evidence/confidence, or exclude the episode with a named reason.

## Incident Learning

- Failure fingerprint: `ingestion.outlook-conversation-project-drift`
- Root cause: source attribution drift can fabricate recurrence and contaminate longitudinal conclusions.
- Detection gap: prior synthesis lacked an episode-level evidence and exclusion gate.
- Prevention: deterministic episode verifier plus reviewed exclusion ledger and coverage labels.
- Guardrail evidence: `docs/ops/evidence/2026-07-14-operational-loss-baseline/verifier-result.json`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Strategy | Operational Loss Intelligence council | Pass | Consensus sequence starts with contracts, coverage, and calibration. |
| Attribution prerequisite | AAI-1067 verifier | Pass | 4,942 rows, 3,184 identities, zero undocumented conflicts, two exclusions. |
| Contract/live lineage gate | `node scripts/verify/verify_operational_loss_baseline.mjs` | Pass | 4 episodes, 5 evidence sources, 7 excluded intake rows checked, 0 failures. |
| Coverage audit | `node scripts/intelligence/operational-loss-baseline.mjs` | Pass | 27 week buckets measured; Teams lineage is under-observed at 12.3% project assignment. |
| Static/diff hygiene | `node --check ...` and `git diff --check -- <owned paths>` | Pass | Both scripts parse; no whitespace errors. |

## Remaining Risk

- The four-episode seed is not a final 30-50 episode calibration set or ranked portfolio. Teams lineage and historical email/document observation are explicitly incomplete.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.

Published at `841f69b79b`; post-publish live verifier passed and local `HEAD`
matched `origin/main`.
