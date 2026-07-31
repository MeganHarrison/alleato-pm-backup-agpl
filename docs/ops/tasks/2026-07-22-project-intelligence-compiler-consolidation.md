# Task: Project Intelligence compiler consolidation

Status: Complete
Owner: Codex
Created: 2026-07-22
Task ID: AAI-1249
Linear Issue: [AAI-1249](https://linear.app/megankharrison/issue/AAI-1249/extract-daily-brief-compiler-into-project-intelligence-core-and)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-project-intelligence-compiler-consolidation.md`

## Objective

Move the active Daily Brief compiler and its owned run, corpus, schedule, and projection collaborators into the canonical `project-intelligence` module, deleting every former functional path in the same change.

## Scope

- Move the compiler, run contract, report contract, source-corpus contract, scheduler policy, recovery policy, and daily projection consumer into their canonical module seams.
- Move focused tests with their owners and update all active imports, commands, Docker references, verifiers, and runtime docs.
- Do not retain wrappers, compatibility shims, archived implementations, or duplicate functional copies.
- Exclude backend Python compiler/synthesis consolidation, owned by AAI-1250.

## Source of Truth

- Canonical runtime/data owner: `project-intelligence/runner` and `project-intelligence/core`.
- Existing shared primitives/services: current `scripts/intelligence/**` implementations being moved.
- Deprecated or parallel paths: none may remain after this task; Git history is the only recovery record.

Verification contract: Required

## Acceptance Criteria

- [x] Compiler and direct owned collaborators exist only under `project-intelligence/**` locally.
- [x] Former functional paths are absent locally and from `origin/main`.
- [x] Scheduled execution, source completeness, publishability, and projection tests pass from canonical paths.
- [x] Runtime commands and documentation reference only canonical paths.
- [x] Failure-loud architecture guard rejects reintroduction of former paths.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared module seams own core, runner, ingestion, and projections.
- [x] Errors remain specific and actionable.
- [x] No database or provider contract changes are introduced.

## Integration and Verification

- [x] Focused Node tests pass.
- [x] Canonical runner/compiler import and syntax checks pass.
- [x] Source-of-truth/ownership verifier passes.
- [x] Evidence artifacts are recorded and attached to AAI-1249.
- [x] Task-owned files are published to `origin/main` and remote deletion is verified.

## Failure-Loudly Contract

- Cause surfaced as: `Project Intelligence ownership violation` naming the noncanonical path.
- Detection path: canonical ownership test plus repository path audit.
- Recovery path: move functionality into the declared module seam and delete the former path.

## Incident Learning

- Failure fingerprint: `architecture.project-intelligence-runtime-ownership-drift`
- Root cause: functional ownership remained distributed after artifact authority was documented.
- Detection gap: no executable path audit rejected duplicate or former runtime owners.
- Prevention: canonical module boundaries, moved tests, forbidden-path guard, and remote-tree deletion readback.
- Guardrail evidence: 48 canonical runtime assertions, 15 checkout-lease assertions, source-of-truth verifier, and the former-path negative test pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Done gate defined before compiler movement. |
| Focused regression | `node --test` across canonical core/ingestion/runner plus DB-connection contract | Pass (48 assertions) | Moved code and tests resolve from canonical paths. |
| Syntax | `node --check` on compiler, projections, and maintenance runner | Pass | No broken ESM imports. |
| Source-of-truth guard | `node scripts/verify/daily-brief-source-of-truth.mjs` | Pass | Former functional paths absent locally. |
| Runtime commands | Static `package.json` command-contract assertion | Pass | Brief, consumers, and backfill commands resolve only through `project-intelligence/**`. |
| Lease recovery guard | `node --test scripts/ops/__tests__/checkout-session-gate.test.mjs` | Pass (15 tests) | Expired dirty ownership is recoverable only by the original session/task/path; temporary test repositories are cleaned after each test. |
| Live scheduler/ledger | `node scripts/verify/verify_daily_executive_brief_schedule.mjs` | Pass | Live Render cron active on main; latest current packet `3319916c-db56-4a2a-a278-65e0ea1041e2`, compiler contract unchanged. |
| Viewable proof | `docs/ops/evidence/2026-07-22-project-intelligence-compiler-consolidation/architecture-proof.png` | Pass | Attached to AAI-1249 as attachment `9999ffab-be94-4428-bead-6b24a480a154`. |
| Docker build | `docker build -f backend/Dockerfile.executive-brief .` | Blocked (unrelated environment) | Local Docker daemon is not running; Render deployment build remains the production proof path after publish. |
| Remote publication | `git push origin HEAD:main`; remote tree/package readback | Pass | `HEAD == origin/main == b80a15418d720da91fa96d2380e15609b0544261`; former tree empty and canonical commands present. |

## Remaining Risk

- Backend Python intelligence jobs remain a separate scheduled ownership seam under AAI-1250.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred work names its owner and next action.
