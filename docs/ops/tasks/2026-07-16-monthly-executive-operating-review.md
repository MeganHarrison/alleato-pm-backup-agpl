# Task: Monthly Executive Operating Review

Status: Complete
Owner: Codex S177
Created: 2026-07-16
Task ID: AAI-1107
Linear Issue: [AAI-1107](https://linear.app/megankharrison/issue/AAI-1107/publish-the-monthly-executive-operating-review-from-portfolio-state)
Related Handoff: `docs/ops/handoffs/2026-07-16-S177-monthly-executive-operating-review.md`

## Objective

Publish an approval-gated, immutable Monthly Executive Operating Review that consumes the governed portfolio artifact and visibly blocks release when finance close or executive approval is missing.

## Scope

- Extend the existing governed executive artifact and delivery-ledger boundary with a monthly consumer and immutable review-governance record.
- Expose the canonical monthly route and capability-protected API with finance readiness, source coverage, approval, delivery, and supersession history.
- Excludes a parallel report compiler, direct client database access, or a second delivery ledger.

## Source of Truth

- Canonical runtime/data owner: `loadGovernedExecutiveArtifact("monthly")`, `loadExecutivePortfolioState`, and existing packet-correlated AI Ops delivery ledger.
- Existing shared primitives/services: `governed-executive-artifact.ts`, `executive-portfolio-state.ts`, `GovernedExecutiveArtifactStatus`.
- Deprecated or parallel paths: page-local monthly aggregation or standalone report persistence.

Verification contract: Required

## Acceptance Criteria

- [x] Monthly review reads shared portfolio state rather than a separate report-generation path.
- [x] Financial readiness, executive approval, source coverage, delivery status, and supersession history are recorded.
- [x] Missing finance close or approval leaves the artifact visibly Draft or Blocked.
- [x] Monthly content and delivery are proven against the canonical state and evidence ledger.

## Implementation Checklist

- [x] Task-owned modules and migration contract identified before edits.
- [x] Shared monthly governance adapter owns approval/release interpretation.
- [x] API authorization and specific recovery errors are implemented.
- [x] Remote migration, generated types, and ledger verification are recorded.

## Integration and Verification

- [x] Focused tests and targeted static checks pass.
- [x] Live API/readback proves canonical state, governance, and delivery linkage.
- [x] Canonical desktop/mobile evidence and independent review are recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit `Draft` or `Blocked` review state with the missing finance-close or executive-approval owner/action.
- Detection path: monthly API, canonical route, governance table/version readback, and packet-correlated delivery ledger.
- Recovery path: record finance close and approval against the immutable governed artifact version; never edit the rendered monthly review or create a parallel report.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: immutable governance records keyed to the governed artifact version and explicit release-state reducer tests.
- Guardrail evidence: focused tests, remote privilege/ledger readback, and browser proof.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Database | `npm run db:migrations:verify-applied -- <both AAI-1107 migrations>` | Pass | Remote ledger contains `20260716210236` and `20260716212045`. |
| Regression | Focused Jest, 2 suites / 6 tests | Pass | Contract and API authorization/governance coverage. |
| Static | Targeted ESLint | Pass | Monthly adapter, API, route, UI, and tests. |
| Live governance | `remote-governance-readback-v2.json` | Pass | Immutable portfolio/delivery snapshots, exactly-once events, predecessor supersession, and duplicate-close rejection. |
| Browser | v2 desktop/mobile screenshots | Pass | Existing `test1` detail/admin test principal proved Draft → finance close → approval on the canonical route. |
| Independent review | `independent-review.md` | Pass | Fresh sub-agent re-review approved the remote and browser proof. |

## Remaining Risk

- The first monthly review is intentionally Draft/Blocked until authorized finance close and executive approval are recorded.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
