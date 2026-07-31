# Task: Complete Authoritative Scheduling

Status: Complete
Owner: Codex S019FAD0
Created: 2026-07-29
Task ID: SCHED-TRANSACTIONAL-COMPLETE
Linear Issue: Connector not required for this user-authorized takeover; the repository handoff is the tracking source.
Related Handoff: `C:\Users\Brandon\OneDrive - Alleato Group\Documents\PM 2\SCHEDULING-PROJECT-HANDOFF-2026-07-29.md`

## Objective

Publish and verify one production scheduling boundary that atomically applies
task, dependency, cascade, and sibling-order mutations, and complete the
remaining alert, cost, EVM, API, UI, and authenticated production evidence.

## Scope

- Atomic task/dependency/cascade/order persistence and stable conflicts.
- Two-anchor predecessor reassignment and earlier dependency deletion.
- Company alert recipient fan-out and deterministic deduplication.
- Equipment/material resource rates, explicit actuals, and EVM UI.
- Database, service, API, component, E2E, deployment, and production evidence.
- Excludes unrelated Company Brain, CRM, Recruiting, and Training changes.

## Source of Truth

- Canonical runtime/data owner: PM Supabase project and `origin/main`.
- Existing shared primitives/services: `frontend/src/lib/services/scheduling-service.ts`, `frontend/src/lib/services/schedule-resource-service.ts`, `frontend/src/lib/scheduling`, `frontend/src/components/scheduling`.
- Deprecated or parallel paths: sequential base-row then cascade-row writes must be removed.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Base scheduling mutations and derived writes commit or roll back together.
- [x] Every writer uses the project advisory lock and exact CAS snapshots.
- [x] Predecessor reassignment reconciles old and new anchors.
- [x] Dependency deletion can move a successor earlier when determinable.
- [x] Sibling ordering is atomic, contiguous, and concurrency-safe.
- [x] Eligible company recipients receive one idempotent alert each.
- [x] People, equipment, and materials persist validated rates and explicit actuals.
- [x] BAC/PV/EV/AC/CV/SV/CPI/SPI and completeness diagnostics are visible.
- [x] Unauthorized, cross-project, cycle, and stale-write attempts fail loudly with no partial write.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are handled.

## Integration and Verification

- [x] Focused database behavioral tests pass.
- [x] Focused unit, service, route, and component tests pass.
- [x] TypeScript, lint, unsafe-pattern, and scheduling release checks pass.
- [x] Authenticated production E2E proves positive and negative flows.
- [x] PM Supabase migration ledger, function, and grants are read back.
- [x] Exact published repair is contained in a Ready, aliased Vercel deployment.
- [x] Authenticated production flows and final-route screenshots prove the deployed revision.
- [x] Task-owned files are published and remote parity is recorded.

## Failure-Loudly Contract

- Cause surfaced as: stable RPC conflict/error category mapped to a specific API response.
- Detection path: database test, focused API/E2E regression, deployment readback, and live route proof.
- Recovery path: retry only stale-CAS conflicts after refreshing the authoritative model; reject all authorization, scope, graph, and validation failures without partial writes.

## Incident Learning

- Failure fingerprint: `reliability.side-effect-before-durable-ledger`
- Root cause: Scheduling mutations lacked one authoritative transaction and
  some UI/report paths derived persistence inputs from presentation state.
  Expected stale conflicts also used a server-error SQLSTATE rather than the
  PostgREST-native `PT409`.
- Detection gap: Pure planners and mocked route tests did not prove the
  production transaction, relationship resolution, root insertion, or
  PostgREST error transport.
- Prevention: One service-role-only authoritative RPC, complete snapshots,
  canonical unfiltered sibling ordering, explicit foreign-key embeds, native
  `PT409`, route contracts, authenticated production E2E, and deployment/readback
  gates.
- Guardrail evidence: 78 scheduling suites/467 tests; PostgreSQL 17 probes;
  live 14/14 conflict-function readback; both authenticated production journeys
  passed; independent transactional-owner review approved with zero findings.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | High-risk scope and acceptance contract recorded. |
| Two-anchor unit | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/lib/scheduling/__tests__/schedule-auto-scheduler.test.ts` | Pass | 25/25 tests. |
| Two-anchor lint | Focused ESLint over three owned files | Pass | No diagnostics. |
| Two-anchor TypeScript | Focused compiler API over three owned files | Pass | No diagnostics. |
| Unsafe-pattern guard | `pnpm.cmd --dir frontend run guardrails:unsafe-patterns` | Pass | No unsafe patterns in 21 changed files. |
| Scheduling release suite | `npm.cmd run test:schedule:release` | Pass | 78 suites and 467 tests passed. |
| Cost and EVM components | Focused component and calculation-engine tests | Pass | 12/12 tests. |
| Scheduling TypeScript | Scoped scheduling compiler configuration | Pass | No diagnostics after fixing MSPDI nullable-date narrowing. |
| Focused ESLint | ESLint over task-owned TypeScript and TSX files | Pass | Zero errors; only two pre-existing schedule-page warnings remain. |
| SQL compilation | PostgreSQL 17 rollback compilation probes | Pass | Authoritative, cost, assignment-preservation, and both HTTP-conflict migrations compile; the conflict definition probes passed 6/6 and 8/8. |
| SQL behavior | Cost RPC rollback probe | Pass | Create/update/delete, version bumps, stale CAS, and negative-rate rejection proved. |
| Alert behavior | Alert fan-out rollback probe | Pass | Two eligible company users included; inactive/unrelated users excluded; replay idempotent. |
| PM migration ledger | Linked migration readback | Pass | `20260729190000`, `20260729191000`, `20260729192000`, `20260729213000`, and `20260729214000` are recorded. |
| PM schema readback | `scripts/verification/evidence/scheduling-release/verify-schedule-conflicts.sql` | Pass | All 14 exact scheduling conflict functions use `PT409`; no legacy scheduling/leveling `40001` remains. |
| Production deployment | Vercel `dpl_78RhkjfHjaCvhGFas6aKY17GvfT3` | Pass | Exact application SHA `73f8edfc` is Ready and aliased to `projects.alleatogroup.com`. |
| Authenticated production | `scripts/verification/evidence/scheduling-release/verification-summary.md` | Pass | Both transactional and alert fan-out/replay journeys passed against the production alias; desktop/mobile proof captured. |
| Independent review | `scripts/verification/evidence/scheduling-release-independent-review.md` | Pass | Final re-review approved with zero findings. |
| Linked pgTAP wrapper | `supabase test db --linked` | Blocked | Supabase CLI connected, then required Docker Desktop to launch its pgTAP runner. Equivalent migrations, local SQL probes, live schema readback, and application tests passed. |

## Rollback

- Database: apply a reviewed compensating migration that revokes/drops the new RPC and additive cost schema only after confirming no dependent production writes.
- Application: redeploy the prior verified `origin/main` revision; do not roll back schema destructively.
- Data: atomic mutations require no partial-write repair; any post-release correction must be project-scoped and auditable.

## Remaining Risk

- The linked pgTAP wrapper still depends on unavailable Docker Desktop; equivalent
  local PostgreSQL probes and live readbacks passed.
- Repository-wide TypeScript still reports unrelated baseline diagnostics; the
  owned scheduling surface, lint, guardrails, and release suite pass.
- No known scheduling release defect remains.

## Final Status

- [x] All required checklist items are complete after regression repair.
- [x] Evidence is filled in.
- [x] Incident learning is recorded above.
- [x] No required phase is deferred.
