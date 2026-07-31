# Task: Keep Prime Contract Amounts Synchronized With The SOV

Status: Complete
Owner: Codex
Created: 2026-07-29
Task ID: LOCAL-2026-07-29-PRIME-CONTRACT-AMOUNT
Linear Issue: Not requested; local high-risk bug task.
Related Handoff: N/A

## Objective

The Prime Contracts list and contract detail must report the same original
contract amount, using the contract Schedule of Values as the authoritative
source whenever SOV rows exist.

## Scope

- Synchronize `prime_contracts.original_contract_value` after every insert,
  update, or delete in `contract_line_items`.
- Backfill existing Prime Contract header values from their SOV totals.
- Exclude existing header-only Prime Contracts from the SOV backfill so a
  legitimate manually entered amount is not overwritten with zero. If an
  SOV-backed contract's final row is deleted, its SOV total intentionally
  becomes zero.

## Source of Truth

- Canonical runtime/data owner: `public.contract_line_items.total_cost`
- Existing shared primitives/services: `public.prime_contract_financial_summary`
- Deprecated or parallel paths: page-local SOV totals are display projections,
  not persistence owners.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The live Nexcom PC-001 stored list amount changes from $24,050.00 to
  $346,124.00.
- [x] Existing contracts with SOV rows have header amounts equal to SOV totals.
- [x] Future SOV insert, update, and delete operations synchronize the header.
- [x] Existing header-only Prime Contracts retain their header amount;
  deleting the final SOV row resets an SOV-backed contract to zero.
- [x] The persisted list value and detail SOV total agree.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] The commitment-only change-order trigger and financial-view read path are
  retired from Prime Contract totals.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned files:

- `supabase/migrations/20260730010000_sync_prime_contract_totals_from_sov.sql`
- `supabase/tests/prime_contract_sov_totals.sql`
- `docs/ops/tasks/2026-07-29-prime-contract-sov-total-sync.md`

## Integration and Verification

- [x] Targeted database contract test passes.
- [x] Migration is applied to the linked PM-APP Supabase project.
- [x] Live database readback proves Nexcom PC-001 is $346,124.00.
- [ ] A post-fix browser screenshot was blocked: the authenticated Chrome tab
  could not be reclaimed after the extension session timed out, and the
  in-app browser redirected to login. Database/API persistence was verified;
  rendered-page proof remains explicitly unclaimed.
- [x] Independent code and database reviews pass.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published through the exact-file remote-main
  publisher. The shared checkout is intentionally not rebased or stashed.

## Failure-Loudly Contract

- Cause surfaced as: linked pgTAP test reports any Prime Contract whose stored
  amount differs from its SOV total, or reports a missing synchronization trigger.
- Detection path: `npx.cmd supabase test db --linked supabase/tests/prime_contract_sov_totals.sql`
- Recovery path: apply the missing migration, then rerun the contract test and
  live API/UI readback.

## Incident Learning

- Failure fingerprint: `financial.prime-contract-sov-header-drift`
- Root cause: SOV child-row writes and the Prime Contract header amount had no
  shared database synchronization boundary.
- Detection gap: the UI tested the SOV footer and list independently, but no
  invariant test compared the two persisted representations.
- Prevention: database trigger plus linked invariant test.
- Guardrail evidence: `supabase/tests/prime_contract_sov_totals.sql` exercises
  SOV insert, update, delete, re-parenting, header-only preservation, approved
  change-order mutations, canonical parent precedence, and competing parent
  writers in one rolled-back database transaction.

Mismatch diagnostic:

```sql
select
  pc.project_id,
  pc.id,
  pc.contract_number,
  pc.original_contract_value as stored_original,
  round(sum(cli.total_cost), 2) as sov_total
from public.prime_contracts pc
join public.contract_line_items cli on cli.contract_id = pc.id
group by pc.project_id, pc.id, pc.contract_number, pc.original_contract_value
having round(coalesce(pc.original_contract_value, 0), 2)
  <> round(coalesce(sum(cli.total_cost), 0), 2);
```

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live layer walk | Chrome network payloads for project 1144 PC-001 | Failed before fix | Header/API $24,050; 11 SOV rows total $346,124. |
| Red regression loop | Live authenticated API invariant | Failed before fix | Raised `Prime Contract amount mismatch: stored 24050, SOV 346124`. |
| Transactional migration test | Management API rollback execution of migration plus `supabase/tests/prime_contract_sov_totals.sql` | Passed | pgTAP completed 24 assertions; no production writes committed. |
| Migration publication | `npm.cmd run db:migrations:verify-applied -- supabase/migrations/20260730010000_sync_prime_contract_totals_from_sov.sql` | Passed | Remote ledger confirms version `20260730010000`. |
| Production readback | PM-APP database query after migration | Passed | PC-001 stored original/revised = $346,124; 11 SOV rows = $346,124; global SOV/header mismatch count = 0. |
| Post-deploy contract test | Management API execution of `supabase/tests/prime_contract_sov_totals.sql` | Passed | All 24 transactional assertions completed and rolled back. |
| Independent review | Code reviewer and database reviewer | Passed | Final verdicts: GO; no remaining correctness, security, concurrency, performance, or migration blockers. |
| Rendered browser proof | Authenticated Chrome plus in-app browser retry | Blocked | Chrome control timed out; in-app browser redirected to login. No rendered-page claim made. |
| Migration ledger guard | `npm.cmd run db:migrations:verify-clean` | Blocked by unrelated history drift | The linked ledger reports more than 100 remote versions absent locally; local migration versions remain unique and `20260730010000` does not collide. |

## Remaining Risk

- Row-level SOV triggers recalculate after every affected row. The
  `contract_line_items(contract_id)` index bounds each lookup, but very large
  bulk imports should be monitored for repeated aggregate cost.

## Final Status

- [x] All implementation and database verification items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred browser proof names the exact blocker; next action is a manual
  refresh of Nexcom Prime Contracts or a new authenticated browser session.
