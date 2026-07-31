# Task: Executive Operating System Phase 0 Specification

Status: In Progress
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1095
Linear Issue: [Phase 0: Enforce Executive Operating System contracts and adapter ownership](https://linear.app/megankharrison/issue/AAI-1095/phase-0-enforce-executive-operating-system-contracts-and-adapter)
Related Handoff: `docs/ops/handoffs/2026-07-16-S156-executive-operating-system-phase-zero.md`

## Objective

Publish an implementation-ready Phase 0 specification and non-overlapping Linear execution tickets that encode the approved Executive Operating System contracts without changing runtime behavior.

## Scope

- Map the canonical packet, project operating-record, source-signal/evidence, financial, schedule, and delivery adapters to their Phase 0 owners.
- Define the execution boundaries for executive-attention, conflict, and normalized-event records.
- Create implementation tickets with dependencies, owned paths, migration/provider impact, verification gates, and failure-loudly behavior.
- Exclude all runtime, migration, provider, and UI changes from this specification task.

## Source of Truth

- Canonical runtime/data owner: `intelligence_packets`, `project_current_state`, source signals/evidence, and existing transactional project/financial/schedule records, as approved in [Wayfinder Map: Executive Operating System and Global Intelligence](https://linear.app/megankharrison/issue/AAI-1086/wayfinder-map-executive-operating-system-and-global-intelligence).
- Existing shared primitives/services: `docs/architecture/AI-RAG-ARCHITECTURE.md`, `docs/architecture/content-source-and-operating-record-design.md`, `frontend/src/lib/executive/canonical-operating-packet.ts`, `backend/src/services/intelligence/compiler.py`.
- Deprecated or parallel paths: page-local synthesis, parallel report generators, and any new RAG/state model are prohibited.

Verification contract: Not applicable. This task changes planning/tracking artifacts only; the child implementation tickets carry runtime, browser, and screenshot proof requirements.

## Acceptance Criteria

- [x] Concrete Phase 0 adapter ownership is bounded by the adapter-registry execution ticket.
- [x] Execution tickets have non-overlapping ownership and native Linear dependencies.
- [x] Every ticket names its proof and failure-loudly contract.
- [x] No code, migration, provider, or route behavior is changed by this task.

## Implementation Checklist

- [x] Existing canonical writers/readers are mapped to Phase 0 adapter owners.
- [x] Executive-attention, conflict, and normalized-event boundaries are separated from generic tasks and transaction records.
- [x] Implementation tickets are created and linked to AAI-1095.
- [x] Linear kickoff and handoff records are posted.

## Integration and Verification

- [x] Planning artifacts are internally consistent with the approved Wayfinder map.
- [x] Linear children and blockers render the intended execution order.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an implementation ticket lacks a canonical owner, dependency, proof contract, or a path conflicts with another ticket.
- Detection path: review of the Phase 0 specification, Linear child relations, and `npm run linear:codex:check`.
- Recovery path: correct the ticket boundary or blocker before any implementation session claims it.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: prior executive work could drift into parallel packet/state/report paths without one contract map.
- Prevention: Phase 0 tickets bind all new work to approved canonical owners and explicit proof gates.
- Guardrail evidence: this task file; Linear child dependencies.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Created before execution-ticket work. |
| Orchestration claim | `docs/ops/orchestration/session-board.md` S156 | Pass | Single active ownership scope recorded. |
| Linear hierarchy | AAI-1095 → AAI-1098 → AAI-1097 → AAI-1096 | Pass | Native child/blocker sequence established. |

## Remaining Risk

- Existing runtime adapters require a detailed path inventory before child implementation can start; owner: Phase 0 adapter-inventory ticket.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A for this planning-only task.
- [x] Deferred implementation has owner: AAI-1098; next action: claim the adapter-registry ticket.
