# Task: Canonical Executive Intelligence Adapter Registry

Status: Accepted
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1098
Linear Issue: [Phase 0A: Publish the canonical Executive Intelligence adapter registry](https://linear.app/megankharrison/issue/AAI-1098/phase-0a-publish-the-canonical-executive-intelligence-adapter-registry)
Related Handoff: `docs/ops/handoffs/2026-07-16-S158-executive-intelligence-adapter-registry.md`

## Objective

Publish a machine-checkable registry that gives every existing executive input one canonical source, writer, reader, freshness owner, authority class, and failure detector.

## Scope

- Document the existing Daily Executive Brief, project operating record, evidence/signal, financial, schedule, and delivery seams that feed Executive Operating System work.
- Add a focused verifier that fails on unmapped, duplicate-writer, or freshness-owner gaps.
- Exclude runtime projections, new routes, migrations, provider changes, and UI behavior.

## Source of Truth

- Canonical runtime/data owner: `intelligence_packets` / `daily-executive-brief`, `project_current_state`, `source_signal_candidates`, authoritative transactional finance/schedule tables, and the existing delivery ledger.
- Existing shared primitives/services: `frontend/src/lib/daily-briefs/canonical-packets.ts`, `frontend/src/lib/ai/intelligence/packet-service.ts`, `frontend/src/lib/executive/canonical-operating-packet.ts`, `frontend/src/lib/executive/financial-pulse.ts`, `backend/src/services/health/project_intelligence_staleness_check.py`.
- Deprecated or parallel paths: `daily_recaps`, page-local synthesis, dashboard-preview data, and generic project tasks as executive attention.

Verification contract: Required. The registry is a release guardrail for future runtime work; it must fail loudly before an unowned source can be used.

## Acceptance Criteria

- [x] Every Phase 0 executive input is mapped to its canonical source, writer, reader, freshness signal, authority, and detector.
- [x] Duplicate writers, unmapped sources, and absent freshness ownership cause a specific verifier failure.
- [x] Deprecated or read-only legacy paths are explicitly identified.
- [x] No runtime, migration, provider, or route behavior changes.

## Implementation Checklist

- [x] Registry and schema are listed before edits.
- [x] Focused verifier validates registry invariants and repository anchors.
- [x] Registry points to shared canonical abstractions rather than copied queries.
- [x] Handoff and Linear evidence are updated.

## Integration and Verification

- [x] Focused registry verification fails loudly on the detected ownership conflict.
- [x] Registry anchors resolve to the inventoried owners.
- [x] Evidence artifact is recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a registry entry has no canonical writer/reader/freshness owner, claims a duplicate writer, or its code anchor disappears.
- Detection path: `node scripts/verify/verify-executive-intelligence-adapter-registry.mjs`.
- Recovery path: restore the canonical owner or explicitly mark the input deferred before downstream work begins.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: Executive surfaces previously relied on architecture prose rather than one enforceable ownership registry.
- Prevention: registry verification blocks a downstream Executive Operating System slice when ownership drifts.
- Guardrail evidence: registry verifier and its focused tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Registry verification | `node scripts/verify/verify-executive-intelligence-adapter-registry.mjs` | Pass | Verifies six canonical inputs and two explicitly deferred domains after AAI-1096 established the controlled projection boundary. |
| Existing daily-brief guardrail | `node scripts/verify/daily-brief-source-of-truth.mjs` | Pass | Existing canonical packet contract remains intact. |
| Linear handoff validation | `npm run linear:codex:check -- docs/ops/handoffs/2026-07-16-S158-executive-intelligence-adapter-registry.md` | Pass | Intake block and evidence references are complete for review submission. |
| Verification contract | `node scripts/verification/verification-contract.mjs --manifest docs/ops/evidence/2026-07-16-executive-intelligence-adapter-registry/verification-manifest.json --result docs/ops/evidence/2026-07-16-executive-intelligence-adapter-registry/verification-result.json --task-id AAI-1098 --require-pass` | Pass | Current independent approval artifact supports PASS. |
| Independent review | `independent-review.md` | Pass | Independent reviewer approved the reconciled registry and valid Linear evidence. |
| Task screenshot | Linear attachment `96e17ca3-cac5-4a12-a387-b9b0f13fb12b` | Pass | Viewable browser-rendered registry verification result attached in Linear. |

## Remaining Risk

- Deferred: executive attention/conflict schema belongs to AAI-1097; no generated database type exists for that domain yet.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A; this task established a guardrail rather than remediating a runtime incident.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
