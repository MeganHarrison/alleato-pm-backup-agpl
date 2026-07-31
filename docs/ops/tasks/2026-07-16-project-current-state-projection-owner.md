# Task: Controlled Project Current State Projection Owner

Status: Accepted
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1096
Linear Issue: [AAI-1096](https://linear.app/megankharrison/issue/AAI-1096/phase-0c-enforce-executive-projection-ownership-normalized-events-and)
Related Handoff: `docs/ops/handoffs/2026-07-16-S160-project-current-state-projection-owner.md`

## Objective

Make one controlled projection boundary the only physical writer of `project_current_state`, retaining Daily Deep Read as a packet-derived input and L2 compilation as a fallback.

## Scope

- Route the compiler and Daily Deep Read consumer through one lineage-preserving projection boundary.
- Add contract/readback tests and extend the executive adapter verifier.
- Exclude executive attention/conflict UI and schema domains.

## Source of Truth

- `project_current_state` is consumed by `frontend/src/lib/ai/intelligence/packet-service.ts`.
- Existing direct writers: `backend/src/services/intelligence/compiler.py` and `scripts/intelligence/daily-deep-read-consumers.mjs`.
- Live evidence proves the first divergence: a consumer partial update follows compiler lineage writes but does not update lineage.

Verification contract: Required

## Acceptance Criteria

- [x] Exactly one physical project-current-state writer remains.
- [x] Fresh Daily Deep Read wins over stale L2 fallback without deleting L2 provenance.
- [x] Invalid/stale/duplicate envelopes fail or skip loudly with a reason.
- [x] Verifier detects a restored direct write or missing lineage.
- [x] Migration ledger and source-to-projection readback are verified.

## Failure-Loudly Contract

- Cause surfaced as: rejected source kind, stale/duplicate envelope, missing packet lineage, or a direct table writer.
- Detection path: projection result, adapter-registry verifier, focused tests, and database readback.
- Recovery path: submit a versioned envelope through the controlled boundary; never update the table directly.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Live `project_current_state` readback | Pass | 32 compiler-shaped and 17 DDR-consumer-shaped rows establish the dual-writer boundary. |
| Supabase migration API | `20260716110000`, `20260716113000` | Pass | API application and remote ledger readback verified. |
| Transactional source-to-projection readback | `remote-readback.md` | Pass | Canonical DDR packet accepted by the controlled RPC; transaction rolled back. |
| Focused tests | compiler 32/32; Daily Deep Read 17/17 | Pass | Verifier and direct-write retirement checks also passed. |
| Independent re-review | `independent-review.md` | Pass | Reviewer approved corrected packet call and bounded fallback. |

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Migration ledger is verified.

Accepted 2026-07-16 after an independent re-review, contract-valid PASS result, and a viewable AAI-1096 Linear screenshot attachment.
