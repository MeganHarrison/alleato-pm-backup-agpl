# Task: Machine-Enforced Sub-Agent Verification Contract

Status: Complete
Owner: Codex
Created: 2026-07-14
Task ID: AAI-1073
Linear Issue: [AAI-1073](https://linear.app/megankharrison/issue/AAI-1073/build-machine-enforced-sub-agent-verification-contract)
Related Handoff: `docs/ops/handoffs/2026-07-14-S151-subagent-verification-contract.md`

## Objective

Create a deterministic verification contract that prevents sub-agents from claiming `PASS` when required functional, visual, persistence, reload, or failure-path evidence is missing.

## Scope

- Add a versioned verification manifest and evidence/report validator.
- Add focused tests for pass, missing evidence, contradictory status, and malformed manifests.
- Document the builder, functional verifier, visual verifier, and evidence judge responsibilities.
- Preserve `tests/agent-browser-runs/` as the canonical browser evidence sink.
- Explicit exclusion: feature-specific product fixes and full CI orchestration are follow-up slices.

## Source of Truth

- Canonical browser runner: `scripts/agent-browser/agent-browser-verify.mjs`
- Canonical browser evidence sink: `tests/agent-browser-runs/`
- Verification routing: `docs/ops/skills-routing.md`
- Closeout contract: `AGENTS.md`, `docs/ops/tasks/TASK-TEMPLATE.md`

Verification contract: Required

## Acceptance Criteria

- [x] A manifest can declare required flows, evidence, visual checks, persistence checks, reload checks, and negative-path checks.
- [x] A validator deterministically rejects `PASS` when required evidence is missing or contradictory.
- [x] `INCONCLUSIVE`, `BLOCKED`, and `NOT_RUN` cannot be promoted to `PASS`.
- [x] Malformed manifests fail with specific actionable errors.
- [x] Focused tests cover valid and invalid verification results.
- [x] Failure-loudly behavior is documented for sub-agents and evidence judges.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared validator owns cross-cutting evidence behavior.
- [x] Errors identify the missing artifact, criterion, or status conflict.
- [x] Existing browser artifact paths remain unchanged.

Planned files:

- `scripts/verification/verification-contract.mjs`
- `scripts/verification/__tests__/verification-contract.test.mjs`
- `scripts/ops/codex-finish.mjs`
- `scripts/ops/check-review-queue-verification.mjs`
- `scripts/ops/__tests__/check-review-queue-verification.test.mjs`
- `scripts/ops/verification-closeout-policy.mjs`
- `scripts/ops/__tests__/verification-closeout-policy.test.mjs`
- `scripts/verification/fixtures/pass-result.example.json`
- `scripts/verification/fixtures/aai-1073-manifest.json`
- `scripts/verification/fixtures/aai-1073-blocked-result.json`
- `scripts/verification/fixtures/aai-1073-pass-result.json`
- `scripts/verification/fixtures/evidence/*`
- `scripts/verification/fixtures/evidence/aai-1073-independent-review.md`
- `.github/workflows/guardrail-pr-check.yml`
- `docs/ops/orchestration/review-queue.md`
- `scripts/templates/verification-manifest.example.json`
- `docs/ops/verification/subagent-verification-contract.md`
- `package.json`
- `docs/ops/handoffs/2026-07-14-S151-subagent-verification-contract.md`

## Integration and Verification

- [x] Focused validator tests pass.
- [x] Example manifest validates successfully with a checked-in result fixture.
- [x] Non-PASS CLI results are recorded with their true status and do not emit PASS success text.
- [x] `codex:finish` accepts paired verification manifest/result arguments and runs the contract before commit.
- [x] Review-queue verifier rejects Required handoffs without a contract-valid PASS result.
- [x] CI runs strict review-queue verification for changed handoffs.
- [x] PASS requires an explicit independent approved review artifact.
- [x] Required closeout rejects non-PASS results.
- [x] Implementation files without a staged task definition are rejected.
- [x] Changed verification artifacts resolve linked handoffs or fail as orphaned.
- [x] Verification manifest/result task IDs are bound to the handoff Task ID.
- [x] Invalid evidence input fails with actionable output.
- [x] Evidence artifacts are recorded.
- [x] Checked-in PASS fixture validates with an independent review artifact.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `Verification contract failed: <specific criterion or artifact>`.
- Detection path: validator command and focused test output.
- Recovery path: create the missing evidence or change the result to `FAIL`, `BLOCKED`, or `INCONCLUSIVE`; do not override the validator.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: Agent completion claims were not mechanically tied to a complete evidence set.
- Detection gap: Existing instructions required evidence but did not validate every report before closeout.
- Prevention: Versioned manifest plus deterministic evidence validator integrated into routine verification.
- Guardrail evidence: `scripts/verification/fixtures/evidence/aai-1073-independent-review.md`; publication gate: `npm run codex:finish`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Existing runner inspection | `scripts/agent-browser/agent-browser-verify.mjs` | Pass | Canonical artifact sink confirmed. |
| Linear tracking | `AAI-1073` | Pass | Issue created before implementation. |
| Contract PASS fixture | `npm run verify:contract -- --manifest scripts/templates/verification-manifest.example.json --result scripts/verification/fixtures/pass-result.example.json --root .` | Pass | PASS requires claim-level evidence and independent approved review metadata. |
| Review acceptance negative path | `npm run verify:contract -- --manifest scripts/verification/fixtures/aai-1073-manifest.json --result scripts/verification/fixtures/aai-1073-blocked-result.json --root . --require-pass` | Expected fail | BLOCKED cannot be promoted to publishable PASS. |
| Review acceptance | `npm run verify:review-queue -- --strict docs/ops/handoffs/2026-07-14-S151-subagent-verification-contract.md` | Pass | AAI-1073 PASS result is bound to the task file and independent approval artifact. |
| Review verifier tests | `node --test scripts/verification/__tests__/verification-contract.test.mjs scripts/ops/__tests__/check-review-queue-verification.test.mjs scripts/ops/__tests__/verification-closeout-policy.test.mjs` | Pass, 21/21 | Includes PASS/BLOCKED behavior, task-file identity binding, template-manifest linking, orphan detection, and implementation task policy. |
| CI guardrail | `.github/workflows/guardrail-pr-check.yml` | Pass | Strict verifier runs against changed handoffs. |
| Required-task negative gate | `npm run verify:contract -- --manifest scripts/templates/verification-manifest.example.json --result scripts/verification/fixtures/blocked-result.example.json --root . --require-pass` | Expected fail | Required closeout rejects `BLOCKED` with the explicit status error. |
| Independent review gate | `scripts/verification/fixtures/evidence/aai-1073-independent-review.md` | Pass | Erdos independently reran the focused suite and both prior adversarial reproductions and returned APPROVED. |

## Remaining Risk

- Validator is wired into closeout, review-queue acceptance, and changed-handoff CI checks. Root implementation files require task metadata, task IDs bind artifacts to the handoff, and independent visual/evidence judging is a required input to PASS. Legacy task metadata migration remains follow-up work after this task.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
