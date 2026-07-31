# Task: Recurring Failure Learning Loop

Status: Implementation Complete; Linear Tracking Blocked/Deferred
Owner: Codex
Created: 2026-07-13
Task ID: LEARNING-LOOP-2026-07-13
Linear Issue: Blocked - Linear connector returned `oauth_token_invalid_grant` on 2026-07-13
Related Handoff: `docs/ops/handoffs/2026-07-13-S135-recurring-failure-learning-loop.md`

## Objective

Turn recent incident lessons into one structured, searchable, and enforceable
learning loop so future tasks can retrieve prior failure fingerprints before
diagnosis and `codex:finish` can validate task-to-guardrail linkage.

## Scope

- Create the missing canonical task template required by `AGENTS.md`.
- Add one machine-readable recurring-failure registry seeded from verified recent incidents.
- Add lookup and audit commands with focused tests.
- Add a staged-task learning audit to `codex:finish`.
- Preserve active drawings work and avoid `package.json`, which is owned by another active session.

## Done Checklist

- [x] Full-process task and handoff created before implementation.
- [x] Linear issue creation attempted and exact auth blocker recorded.
- [x] Non-overlapping session ownership claimed.
- [x] Canonical task template includes incident-learning intake and closeout fields.
- [x] Recurring-failure registry has a validated schema and verified seed incidents.
- [x] Lookup returns relevant fingerprints from symptoms and affected file paths.
- [x] Audit rejects malformed registry entries and unknown task fingerprints.
- [x] `codex:finish` runs the staged-task learning audit.
- [x] Focused tests and syntax checks pass.
- [x] Handoff and evidence are complete.
- [x] Task-owned files are published to `origin/main`.

## Acceptance Criteria

- A developer or agent can search by symptom or owned path and receive the
  canonical owner, first checks, root cause, and preventive guardrail.
- Registry entries distinguish recorded knowledge, diagnosability, detection,
  and prevention maturity.
- Repeated incidents below detectable maturity remain visible as promotion debt.
- A task that declares a failure fingerprint cannot be finished if the
  fingerprint does not exist in the registry.
- Existing historical task files are not retroactively rejected.

## Failure-Loudly Contract

- Invalid YAML, duplicate IDs, missing required fields, invalid maturity, and
  unknown task fingerprints exit non-zero with specific remediation text.
- Lookup with no useful query exits non-zero instead of returning the full registry.
- Staged-task auditing only evaluates task files that opt into the new
  `## Incident Learning` contract, preventing unrelated historical debt from
  obscuring new failures.

## External Tracking Blocker

- Cause: Linear connector authentication is expired.
- Detection gap: the connection was not healthy when the full-process task began.
- Prevention step: connector health was checked before implementation and the
  unavailable tracking step is recorded immediately.
- Owner: workspace Linear connector administrator.
- Next action: reauthenticate Linear, create the issue, and replace the local
  placeholder in this task and handoff.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear kickoff | `linear_list_teams` | Blocked | `UNAUTHORIZED`, `TRIGGER_REAUTHENTICATION`, `oauth_token_invalid_grant`. |
| Ownership | `docs/ops/orchestration/session-board.md` | Pass | S135 owns only learning docs, scripts, focused tests, and `codex-finish`; active frontend changes remain untouched. |
| Registry unit tests | `node --test scripts/__tests__/learning-registry.test.mjs` | Pass | 7 tests cover schema validation, ranking, duplicate IDs, task linkage, N/A tasks, and placeholder rejection. |
| Registry audit | `node scripts/ops/learning-registry.mjs audit` | Pass | 8 fingerprints validated; one explicit drawings promotion debt warning remains. |
| Strict audit | `node scripts/ops/learning-registry.mjs audit --strict` | Expected fail | Strict mode turns the documented drawings browser-contract promotion debt into a non-zero result. |
| Symptom/path lookup | `node scripts/ops/learning-registry.mjs lookup --symptom 'drawing zoom control does nothing' --files frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx` | Pass | Viewer capability regression ranked first with canonical owner, first checks, cause, prevention, and promotion owner. |
| Dependency-free runtime | root Node runtime with no installed YAML package | Pass | Registry uses JSON-compatible YAML and parses through built-in `JSON.parse`; no workspace install is required. |
| Syntax and diff hygiene | `node --check scripts/ops/learning-registry.mjs`; `node --check scripts/ops/codex-finish.mjs`; `git diff --check` | Pass | No syntax or whitespace errors. |
| Canonical publish | `npm run codex:finish -- --message "Add recurring failure learning loop" --files ...` | Pass | Commit `efbc3a0e4` published to `origin/main`; finish audited 8 fingerprints and 2 staged task contracts. |

## Incident Learning

- Failure fingerprint: `process.passive-incident-memory`
- Root cause: incident knowledge is fragmented across free-form task and handoff files and is not retrieved or validated in the next task's execution path.
- Detection gap: task creation is standardized, but incident metadata and lookup are not.
- Prevention: structured registry, symptom/path lookup, staged-task fingerprint validation, and explicit maturity promotion.
- Guardrail evidence: `scripts/__tests__/learning-registry.test.mjs` and `node scripts/ops/learning-registry.mjs audit --task docs/ops/tasks/2026-07-13-recurring-failure-learning-loop.md`.

## Remaining Risk

- `package.json` command aliases remain deferred to avoid an active ownership conflict.
- Linear tracking remains blocked until connector reauthentication.
- The drawings viewer fingerprint remains `diagnosable`, not `detectable`, until
  its feature tracker becomes one rerunnable browser capability suite. Strict
  audit intentionally fails on that promotion debt.

## Final Status

- [x] Repo implementation, verification, and publication are complete.
- [x] Evidence and incident-learning linkage are complete.
- [x] External Linear tracking is explicitly Blocked/Deferred with cause, owner, and next action.
