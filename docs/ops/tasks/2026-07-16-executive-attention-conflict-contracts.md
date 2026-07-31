# Task: Executive Attention and Conflict Domain Contracts

Status: Accepted
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1097
Linear Issue: [AAI-1097](https://linear.app/megankharrison/issue/AAI-1097/phase-0b-add-executive-attention-and-conflict-domain-contracts)
Related Handoff: `docs/ops/handoffs/2026-07-16-S166-executive-attention-conflict-contracts.md`

## Objective

Provide a migration-backed, evidence-linked executive attention and conflict domain that preserves human ownership and cannot silently resolve, suppress, or downgrade a conflict.

## Scope

- New public executive attention, evidence-link, conflict, claim, and resolution-history records.
- A small frontend service boundary for creating evidence-backed attention and explicitly human-confirmed conflict resolution.
- Migration/type/service contract tests and remote migration-ledger proof.
- Exclude executive UI (Phase 1), generic project-task reuse, packet projection ownership, and normalized-event changes owned by AAI-1096.

## Source of Truth

- Canonical runtime/data owner: new `public.executive_attention_items` and `public.executive_claim_conflicts` domain tables.
- Existing inputs: `source_signal_candidates`, `intelligence_packets`, transactional records, and immutable source evidence only through typed source links.
- Deprecated or parallel paths: generic project tasks as executive attention; any AI-only conflict disposition.

Verification contract: Required

## Acceptance Criteria

- [x] Evidence-backed attention records include category, priority, owner, due date, lifecycle, escalation, assignments, resolution, and source links.
- [x] Conflict records preserve competing claims, a resolution deadline, resolver, and append-only human-confirmed resolution history.
- [x] Automated actors can create/open records but cannot silently resolve, dismiss, suppress, or downgrade either domain.
- [x] No normalized-event or Phase 1 UI ownership is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared database functions own attention and conflict lifecycle writes.
- [x] Errors are specific and actionable.
- [x] Migration is applied remotely, types regenerated, and ledger verified.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Live-system readback proves tables, functions, transition boundary, and authorization grants exist.
- [x] Evidence artifacts are recorded, including the Linear-attached screenshot and independent review.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main` (`fa5dc9e62`).

## Failure-Loudly Contract

- Cause surfaced as: direct lifecycle mutation, an evidence-less attention item, or an automated conflict disposition.
- Detection path: database check constraint/trigger exception and focused contract tests.
- Recovery path: create evidence links first, then use the domain function with a human resolver and a non-empty resolution rationale.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: New domain; no prior runtime failure was repaired.
- Prevention: Database-owned lifecycle boundary plus source-link and resolution-history requirements.
- Guardrail evidence: focused contract test and remote trigger/function readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Focused unit | `npm --prefix frontend run test:unit -- --runTestsByPath src/lib/executive/__tests__/executive-attention-conflicts.test.ts --runInBand` | Pass | 5 tests: evidence, competing claims, AI-resolution rejection, and human-only attention transitions. |
| Full frontend unit suite (delegated) | `npm --prefix frontend run test:unit -- --runInBand` | Unrelated repo debt | 479 suites / 2,605 tests passed; 59 suites fail primarily because Jest cannot transform `ai@7.0.15` ESM imports. One separate stale `home/tab-data` route expectation also failed. Neither failure imports or exercises AAI-1097 files. |
| Scoped lint | `cd frontend && npx eslint --no-cache src/lib/executive/executive-attention-conflicts.ts src/lib/executive/__tests__/executive-attention-conflicts.test.ts` | Pass | Direct file-scoped invocation used because the package lint wrapper cannot accept flat-config file flags. |
| Remote schema and authorization | `docs/ops/evidence/2026-07-16-executive-attention-conflict-contracts/remote-readback.md` | Pass | Tables/RPCs exist; direct DML false for authenticated and service roles; service role cannot resolve. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260716130000_create_executive_attention_conflict_contracts.sql supabase/migrations/20260716134500_harden_executive_domain_authorization.sql` | Pass | Both canonical migration versions are present remotely. |
| Independent review | `docs/ops/evidence/2026-07-16-executive-attention-conflict-contracts/independent-review.md` | Pass | Initial P0 review findings remediated and re-reviewed approved. |
| Screenshot evidence | `docs/ops/evidence/2026-07-16-executive-attention-conflict-contracts/aai-1097-linear.png` | Pass | Attached to AAI-1097 in Linear. |
| Verification-contract CLI | `npm run verify:contract -- docs/ops/tasks/2026-07-16-executive-attention-conflict-contracts.md` | Not applicable | Command requires `--manifest` and `--result`; this database contract has remote API proof instead of that fixture format. |

## Remaining Risk

- Phase 1 UI and normalized-event adapters remain separate follow-on work; owner AAI-1102/AAI-1103 and AAI-1096 respectively.
- Phase 1 should add a visible append-only audit event for non-terminal human attention transitions; this does not weaken the current authorization boundary.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
