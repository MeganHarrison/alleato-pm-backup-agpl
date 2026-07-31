# Task: Canonical Executive State Seam

Status: Accepted
Owner: Codex S167
Created: 2026-07-16
Task ID: AAI-1101
Linear Issue: [AAI-1101](https://linear.app/megankharrison/issue/AAI-1101/establish-the-canonical-executive-state-seam)
Related Handoff: `docs/ops/handoffs/2026-07-16-S167-canonical-executive-state-seam.md`

## Objective

Provide one backend-neutral, fail-loud adapter for executive reads that composes existing canonical packet, controlled project state, financial, schedule, evidence, and delivery seams.

## Scope

- `frontend/src/lib/executive/executive-state.ts` and focused unit tests.
- Explicitly defer lifecycle records for executive attention/conflicts to AAI-1097; this adapter must not read or create those tables.

## Source of Truth

- Canonical runtime/data owner: `intelligence_packets` daily executive packet; `project_current_state`; existing financial pulse and delivery receipt readers.
- Existing shared primitives/services: `canonical-packets.ts`, `canonical-operating-packet.ts`, `financial-pulse.ts`, `service-db.ts`.
- Deprecated or parallel paths: page-local executive synthesis is not an input to this adapter.

Verification contract: Required

## Acceptance Criteria

- [x] Executive reads have one documented controlled state seam rather than page-local synthesis.
- [x] Every input declares canonical source, authority, owner, freshness, and evidence behavior.
- [x] Missing canonical packet, evidence, freshness ownership, or duplicate owners fails loudly.
- [x] Attention/conflict lifecycle state is explicitly deferred to AAI-1097.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared adapter owns cross-cutting composition and diagnostics.
- [x] Errors are specific and actionable.
- [x] No database/provider/auth contract changes are required.

## Integration and Verification

- [x] Focused unit tests pass.
- [x] Live-system readback proves the existing canonical sources are available.
- [x] Evidence artifacts are recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `Executive state integrity failure: ...` with the invalid seam ids.
- Detection path: focused adapter test and `loadCanonicalExecutiveState` rejection.
- Recovery path: restore the named source owner/evidence/freshness contract before an executive reader consumes the state.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: input registry and integrity validator.
- Guardrail evidence: focused adapter unit tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and exclusions captured before implementation. |
| Focused unit test | `cd frontend && npx jest src/lib/executive/__tests__/executive-state.test.ts --runInBand` | Pass | 4 tests: composition, required-source identifiers, freshness, duplicate/evidence failures. |
| Focused lint | `cd frontend && npx eslint src/lib/executive/executive-state.ts src/lib/executive/__tests__/executive-state.test.ts` | Pass | No violations. |
| Live source readback | `docs/ops/evidence/2026-07-16-canonical-executive-state-seam/live-readback.md` | Pass | Supabase API reports fresh packet with 160 evidence references, 49 project records, and 32 receipts. |
| Task screenshot | Linear attachment `b920848f-8ad5-488f-a837-019642dd9b49` | Pass | Viewable AAI-1101 Pending Review screenshot from the canonical Linear artifact. |

## Remaining Risk

- The initial seam is an adapter boundary; migration of existing executive pages to it is separately owned by follow-on AAI-1104/1106 work.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
