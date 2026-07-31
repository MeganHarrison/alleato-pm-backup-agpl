# Task: Self-Improving Training Discovery Loop

Status: Complete
Owner: SROOT
Created: 2026-07-30
Task ID: ALL-54
Linear Issue: ALL-54 — https://linear.app/alleato-group/issue/ALL-54/build-self-improving-training-resource-discovery-loop
Related Handoff: `docs/ops/handoffs/2026-07-30-SROOT-training-discovery-learning-loop.md`

## Objective

Make training-resource discovery measurably improve from administrator decisions while preserving review-only publication and auditable, reversible behavior.

## Scope

- Finder discovery runs, candidate evidence, structured feedback, fingerprints, and versioned policy data.
- Adaptive query strategies, near-duplicate detection, explainable ranking, and evaluation metrics.
- Existing `/training/review` administrator workflow and focused tests.
- Excludes automatic publication and unrelated training-library visual changes already present in the checkout.

## Source of Truth

- Canonical runtime/data owner: `backend/src/services/training/finder.py` and Supabase `training_resource`
- Existing shared primitives/services: existing training review route, `TrainingDataAccess`, and `create_training_review_candidate`
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required

## Workflow Brief

Primary user: Alleato application administrator
Primary job: Review discovered training resources and teach the finder which resources are useful
Primary decision: Publish or archive a candidate with structured reasons
Tier 1 content: Candidate evidence, recommendation explanation, feedback controls, and learning metrics
Hidden until requested: Detailed feature snapshots and policy evaluation evidence
Remove: N/A
Primary action: Publish or archive with feedback
Failure-loudly behavior: Persist, policy, or evaluation failures return specific errors and preserve entered feedback
Canonical owner: Existing `/training/review` work queue

## Acceptance Criteria

- [x] Every committed finder run and candidate outcome is auditable and tied to a policy version.
- [x] Publish/archive decisions persist structured feedback plus notes.
- [x] Canonical URL/video duplicates and near-duplicate content are rejected or clearly flagged.
- [x] Ranking uses historical decisions and query-strategy performance with bounded exploration.
- [x] Policy evaluation is versioned, reversible, and visible to administrators.
- [x] No resource is published without the existing administrator decision.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are handled.

## Integration and Verification

- [x] Targeted backend tests pass.
- [x] Targeted frontend tests pass.
- [x] SQL migration and policy tests pass.
- [x] Authenticated `/training/review` screenshots prove the changed desktop and 390px mobile workflow.
- [x] Live database, frontend alias, backend health/OpenAPI, and weekly-job readbacks prove the published runtime.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published through the exact-file publisher and confirmed on `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `TRAINING_DISCOVERY_*`, `TRAINING_POLICY_*`, or explicit administrator form error
- Detection path: finder response outcomes, backend logs, focused tests, and review-page error state
- Recovery path: retry the bounded run, correct the structured feedback, or reactivate the preceding policy version

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: The first live atomic-RPC contract used a PL/pgSQL variable with the same name as an `ON CONFLICT` column.
- Detection gap: Unit fakes could prove orchestration but not PostgreSQL name resolution.
- Prevention: The linked rollback SQL contract invokes the real atomic RPC before publication, and the corrected RPC uses unambiguous variable names.
- Guardrail evidence: `supabase/tests/training_resource_learning.sql`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and ALL-54 | Pass | Scope and release gate captured before implementation. |
| Backend behavior | `pytest --noconftest` for learning, finder, weekly, and admin endpoint | Pass | 37 focused tests; deprecation warnings only. |
| Frontend behavior | Five training review/data-access Jest suites | Pass | 35 focused tests. |
| Frontend lint | ESLint on changed training review/data-access files | Pass | No findings. |
| Backend lint/format | Ruff on learning/finder and focused tests | Pass | No findings; files formatted. |
| Generated schema | `node scripts/generate-db-types.mjs --check` | Pass | Types match linked Supabase schema. |
| Live SQL | `training_resource_learning.sql` and `training_resource_library.sql` via linked `db query` | Pass | Atomic creation, permissions, stale review, concurrency dedupe, feedback, reversal, and existing library contract rolled back cleanly. |
| Migration ledger | Linked Supabase migration readback | Pass | `20260730173000`, `20260730201000`, `20260730202000`, and `20260730203000` recorded applied. |
| Independent standards review | Two-pass standards review | Pass after fixes | Added atomic writes, run terminalization, row locks, topic advisory lock, database duplicate recheck, and unique DOM IDs. |
| Independent spec review | Two-pass spec review | Pass | No remaining implementation-level defect; release proof remained pending. |
| Backend deployment reconciliation | Render deploy `dep-d9lp2lflk1mc73ccpj4g` logs plus 37 focused tests from a current `origin/main` worktree | Pass after fix | First publish restored a stale Fireflies import while copying the training admin endpoint. The admin module is now reconciled to Vercel Workflow ownership with only the ALL-54 trigger-source change retained. |
| Frontend production | Vercel `dpl_GpAMQfsr3hLfQSLsmxpcE9NoX1DE` and `https://projects.alleatogroup.com/training/review` | Pass | Production alias resolves to the READY deployment; authenticated DOM readback found one learning panel and 28 publish/archive forms. |
| Backend production | Render `dep-d9lpaeht0dsc73e9rf30`, `/health`, and `/openapi.json` | Pass | Corrected revision `e3c5c7555772f7608f5939bbef651762b3de1058` is live; health is healthy and `TrainingFinderResponse` exposes `policyVersion`, `runId`, and `queries`. |
| Weekly discovery owner | Render build `bld-d9lpaf9t0dsc73e9rgf0` | Pass | Weekly cron built successfully from corrected revision and remains scheduled for Monday at 13:15 UTC with `--commit`. |
| Authenticated visual review | `tests/agent-browser-runs/2026-07-30-training-discovery-learning-loop/review-desktop.png` and `review-mobile.png` | Pass | Desktop proves structured review controls; 390px mobile proves policy/evaluation metrics. |
| Full frontend typecheck | Node 24 TypeScript with 7 GB heap | Known unrelated failure | The task-owned nullable detail error was fixed; remaining errors are pre-existing/concurrent in admin, CRM, AI, recruiting, scheduling, and other owner files outside ALL-54. |

## Remaining Risk

- Dry runs intentionally remain read-only, so their outcomes are not persisted; same-run URL and fingerprint duplicate checks still run in memory.
- Transcript availability varies by provider; deterministic search-evidence fingerprints remain the fallback and database-side topic locking prevents concurrent duplicate insertion.
- Metrics correctly begin at zero until administrators submit the first structured review; this is an empty-history state, not a runtime failure.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] No task-owned work is deferred.
