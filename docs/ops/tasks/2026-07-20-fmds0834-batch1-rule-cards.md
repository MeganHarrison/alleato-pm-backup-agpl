# Task: Build FMDS 8-34 Batch 1 Deterministic Rule Cards

Status: Pending Review
Owner: Megan Harrison
Created: 2026-07-20
Task ID: AAI-1201
Linear Issue: [AAI-1201](https://linear.app/megankharrison/issue/AAI-1201/build-deterministic-fmds-batch-1-rule-cards-and-boundary-tests)
Related Handoff: `docs/ops/handoffs/2026-07-20-S200-fmds0834-batch1-rule-cards.md`

## Objective

Convert the nine verified Batch 1 FMDS 8-34 April 2026 requirements into source-linked deterministic rule cards and executable boundary tests in the dedicated ASRS Supabase project without activating the corpus.

## Scope

- Owned database surface: Batch 1 rows in `public.fmds_rule_cards` plus a fail-closed Batch 1 evaluator contract if the existing schema cannot execute the rules safely.
- Owned implementation: a Supabase migration created with the CLI, idempotent rule-card population and verification scripts under `scripts/asrs/`, and evidence under `docs/ops/evidence/2026-07-20-fmds0834-batch1-rule-cards/`.
- Owned rule families: hose demand/duration, transverse-flue measurement and obstruction treatment, recommended transverse-flue width, vertical alignment, in-rack sprinkler escalation, and vertical-barrier triggers.
- Explicit exclusions: 2026 corpus activation, 2024 data mutation, full FMDS 8-34 calculation coverage, sprinkler-head-count calculation outside verified Batch 1 evidence, and AI-chat/provider integration.

## Source of Truth

- Canonical document: `/Users/meganharrison/Downloads/FMDS0834 - 2026.pdf`, SHA-256 `c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed`.
- Canonical runtime/data owner: dedicated ASRS Supabase project `vqnnvpnoitqhijkztyhq`, revision `65306e47-c25a-4397-92a0-c44c03903d0f`.
- Existing shared schema: `public.fmds_rule_cards`, `public.fmds_revision_coverage`, and `public.activate_fmds_revision` from `infrastructure/asrs-supabase/supabase/migrations/20260720121737_fmds_2026_versioned_corpus.sql`.
- Deprecated or parallel paths: legacy 2024 FM/ASRS tables remain comparison-only and must not be modified.

Verification contract: Required

## Acceptance Criteria

- [x] Every Batch 1 rule card cites its governing page, clause/table/figure, and attributed review event.
- [x] Rule-card conditions and outputs use typed operators and units rather than prose-only logic.
- [x] Exact boundaries are executable and tested: `>=1.5 in.`, `<=0.5 in.`, `>10 ft`, `<=12 ft`, `>=70%`, `<=4 in.`, and `>=30 degrees`.
- [x] Missing or unsupported inputs fail closed with a specific reason and source citations.
- [x] Hose-demand and transverse-flue lookup outputs are deterministic and unit-labelled.
- [x] The evaluator distinguishes Batch 1 coverage from unsupported full-design or sprinkler-head-count questions.
- [x] The staged revision remains inactive and the legacy 2024 corpus remains unchanged.

## Implementation Checklist

- [x] Create the migration with `supabase migration new`; do not invent a filename.
- [x] Add idempotent source-linked Batch 1 rule-card population.
- [x] Add a shared fail-closed evaluator contract only if required for executable tests.
- [x] Add deterministic population and verification scripts under `scripts/asrs/`.
- [x] Apply the migration to the dedicated ASRS project and verify the remote ledger.
- [x] Post kickoff, milestone, evidence, and handoff comments to AAI-1201.

## Integration and Verification

- [x] Targeted Python/static and SQL tests pass.
- [x] Live readback proves the expected rule-card keys, citations, review states, and boundary outputs.
- [x] Transactional negative tests prove unsupported/missing inputs fail closed.
- [x] Activation remains blocked and `fmds_active_chunks` remains empty.
- [x] A viewable evidence screenshot is attached to AAI-1201.
- [x] Task-owned files are published on `feat/asrs-intelligence` and local `HEAD` equals `origin/feat/asrs-intelligence`.

## Failure-Loudly Contract

- Cause surfaced as: exact missing input, unsupported Batch 1 scenario, invalid units/operator, missing review event, missing source citation, or rule coverage mismatch.
- Detection path: the live verifier compares rule keys, structured conditions/outputs, citations, review events, boundary cases, revision status, and active retrieval state.
- Recovery path: repair only the affected rule/evaluator contract; never infer an uncovered engineering rule or activate the corpus.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: typed operators, rendered-glyph boundary verification, source-linked rule events, and fail-closed unsupported-scenario output.
- Guardrail evidence: 30 live boundary checks in `verification.json`, the service-only function privilege readback, and a failed activation attempt showing only 2 of 58 table candidates are reviewed.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1201, this task file, and S200 handoff | Pass | Scope, ownership, activation boundary, and definition of done recorded before implementation. |
| Migration generation and dry run | `supabase migration new`; transactional `psql` dry run; `supabase db push --dry-run` | Pass | One generated migration was pending and the SQL completed transactionally. |
| Remote migration | `supabase db push`; `npm run db:migrations:verify-applied -- infrastructure/asrs-supabase/supabase/migrations/20260720190556_add_fmds_batch1_rule_cards.sql` equivalent ledger verifier from the ASRS subproject | Pass | Remote ledger contains `20260720190556`; idempotent rollback rerun returned nine cards. |
| Live rule verification | `python3 scripts/asrs/verify_fmds_batch1_rule_cards.py ...` | Pass | 9 cards, 9 review events, and 30 boundary checks; full-design coverage remains false. |
| Activation guard | `verification.json` | Pass | Revision is `staging`, active chunks are 0, and activation fails because only 2 of 58 table candidates are reviewed. |
| Security readback | PostgreSQL privilege and RLS queries; Supabase CLI security advisor | Pass | Evaluator is service-role-only and `fmds_rule_cards` has RLS; advisor reported only pre-existing warnings. |
| Evidence report | `report.html`, `report.png`, Linear attachment `5a62269d-5ae2-4ba0-b2b4-e3dea5b5c61a` | Pass | Screenshot is viewable on AAI-1201 and matches the live verification result. |
| Verification contract | `verification-manifest.json`; `verification-result.json`; `independent-review.md` | Pass | Claim-level live database, negative-path, screenshot, and durable verifier evidence is bound to AAI-1201. |
| Branch publication | commit `474ebf21760627d09bd0e5dfdb6ec1288bbb17b1`; local/remote SHA readback | Pass | Exact ASRS-owned artifacts published to `origin/feat/asrs-intelligence`. |
| Linear handoff | comment `fb2a8238-82a3-4f18-b991-dda086da9419`; issue state `In Review` | Pass | Scope, evidence, safety boundary, commit, and next slice are recorded. |

## Remaining Risk

- Batch 1 does not contain the complete engineering logic needed to calculate sprinkler head counts or every ASRS configuration. Unsupported questions must remain explicit until later reviewed batches add their rules.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A with prevention recorded.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
