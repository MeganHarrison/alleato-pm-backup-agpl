# Task: Fast Delivery Operating Model

Status: Complete
Owner: Codex
Created: 2026-07-22
Task ID: LOCAL-OPERATING-MODEL-0722
Linear Issue: Not required — this is the local operating-policy repair explicitly directed by Megan; no Linear issue-creation capability is available in this session.
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-fast-delivery-operating-model.md`

## Objective

Replace cumulative process gates with risk-based delivery lanes so routine changes are published quickly while high-risk releases retain independent end-to-end evidence.

## Scope

- Delivery-lane policy, verification contract, closeout rules, worker/leader protocol, and isolated-workspace retirement proof.
- Preserve existing S209 `AGENTS.md` edits; modify only the operating-model sections.
- Excludes product behavior and external service configuration.

## Source of Truth

- Canonical process owners: `AGENTS.md`, `scripts/ops/codex-finish.mjs`, and `scripts/verification/verification-contract.mjs`.
- Existing shared processes: `docs/ops/orchestration/{worker-protocol,leader-runbook}.md`.

Delivery lane: Standard

Verification contract: Optional — this is a process-policy change with no user-facing runtime route. Targeted executable policy tests are required.

## Acceptance Criteria

- [x] Fast, Standard, and High-risk lanes have explicit entry criteria and one closeout path each.
- [x] Full independent verification is limited to High-risk work.
- [x] Full suites are release/CI gates, never a default per-file or per-slice action.
- [x] Worker and leader protocols remove duplicate records for Fast and Standard work.
- [x] Automated tests cover the new contract semantics.
- [x] Existing unrelated S209 `AGENTS.md` work is preserved.

## Implementation Checklist

- [x] Replace cumulative task/screenshot/Linear policy in `AGENTS.md`.
- [x] Make verification contracts declare and enforce a risk lane.
- [x] Update the template and tests.
- [x] Update closeout and orchestration documentation.
- [x] Allow isolated workspaces to retire after exact-file remote publication.

## Integration and Verification

- [x] `node --test scripts/verification/__tests__/verification-contract.test.mjs` passes.
- [x] `node --check scripts/verification/verification-contract.mjs` passes.
- [x] `node --check scripts/ops/codex-finish.mjs` passes.
- [x] Diff review confirms only intended policy sections changed.
- [x] Task-owned files are published and remote `origin/main` contains the exact-file receipt `a02d8ab22107381955a19e531d54562089509480`.

## Failure-Loudly Contract

- Cause surfaced as: an invalid lane or a missing lane-required artifact.
- Detection path: the verification contract and targeted tests.
- Recovery path: correct the declared risk lane or supply only its required evidence.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A — this task changes operating policy rather than resolving a recurring product failure.
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Audit | Checkout gate status and policy review | Pass | Identified unowned dirty `AGENTS.md` hunk and cumulative requirements. |
| Contract tests | `node --test scripts/verification/__tests__/verification-contract.test.mjs` | Pass | 9/9; Standard evidence no longer requires High-risk artifacts. |
| Syntax | `node --check scripts/{verification/verification-contract,ops/codex-finish}.mjs` | Pass | Lane-aware closeout parses successfully. |

## Remaining Risk

- High-risk classification is intentionally conservative; ambiguous changes must use the higher lane.

## Final Status

- [x] All required checklist items are complete after publication.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
