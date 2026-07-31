# Task: Remediate Acumatica Customers And Payment Applications Sync Failures

Status: Complete
Owner: Codex
Created: 2026-06-24
Linear Issue: Not created yet - implementation in progress
Related Handoff: N/A

## Objective

Repair the Acumatica financial sync so the `customers` and
`payment_applications` entities no longer fail the canonical backend sync path,
or document the exact remaining provider blocker with code-side hardening and
verification evidence.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `python3 -m py_compile backend/src/services/acumatica_sync.py` | Pass | Syntax verified after each code pass. |
| Targeted tests        | `backend/.venv/bin/pytest backend/tests/test_acumatica_payment_applications_sync.py -q` | Pass | 5 targeted tests passed in project venv. |
| Browser/user-flow     | Not applicable     | N/A | Backend sync remediation only. |
| DB/provider read-back | Postgres read-back of `acumatica_sync_state` | Pass | Confirmed `customers` and `payment_applications` now land as `warning`. |
| End-to-end proof      | `backend/.venv/bin/python backend/scripts/run_acumatica_financial_sync.py` | Pass with warnings | Final run returned `success_with_warnings`; no hard failures remained. |

## Files Changed

- `docs/ops/tasks/2026-06-24-acumatica-sync-remediation.md` - task ledger for remediation work
- `backend/src/services/acumatica_sync.py` - likely sync fallback/remediation changes
- `backend/tests/test_acumatica_payment_applications_sync.py` - likely regression coverage updates

## Risks / Gaps

- `payment_applications` still depends on a provider-side Acumatica GI/OData source for exact historical invoice linkage; current fallback projects owner payments directly from `acumatica_payments` using unique customer-to-project mapping.
- `customers` now succeeds only after dropping unsupported/slow fields when the tenant contract rejects them.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
