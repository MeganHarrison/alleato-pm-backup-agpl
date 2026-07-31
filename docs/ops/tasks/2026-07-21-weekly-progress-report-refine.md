# Task: Weekly progress report refine workflow

Status: In Progress
Owner: Codex ticket09_weekly
Created: 2026-07-21
Task ID: Ticket 09
Linear Issue: unavailable in delegated task context
Related Handoff: `docs/ops/handoffs/2026-07-21-S-ticket09-weekly.md`

## Objective

Keep weekly progress reports continuously refreshed from source evidence while
preserving internal notes, client-safe output, review/send state, and an audit
history for every refinement.

## Scope

- Progress report persistence/service/API contracts, migration, and focused tests.
- UI changes only where needed to expose refine/history state; no unrelated pages.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/progress-reports/server.ts`.
- Existing shared primitives/services: deep-read assembler and report editor.
- Deprecated or parallel paths: none; legacy weekly builder remains fallback.

Verification contract: Required

## Acceptance Criteria

- [ ] Daily refresh records source evidence without overwriting human edits.
- [ ] Internal/client fields are separated and client output omits internal notes.
- [ ] Refine creates an auditable version and preserves prior content.
- [ ] Review/send transitions are explicit and fail loudly when invalid.
- [ ] Focused tests cover versioning and audience separation.

## Implementation Checklist

- [ ] Migration and typed service contract.
- [ ] Refine/history API and client hook.
- [ ] Focused unit tests.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: invalid state transition or missing source evidence error.
- Detection path: API response and audit row.
- Recovery path: review current draft, retry refine, or restore a prior version.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: versioned writes and explicit transition validation.
- Guardrail evidence: pending.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope captured before implementation. |

## Remaining Risk

- Migration application and browser screenshot require parent session credentials/lease.

## Final Status

- [ ] All required checklist items are complete.
