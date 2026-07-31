# Task: Prime Contract Change Orders require resolvable parent and fail loud on missing parent

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-01
Related Handoff: Not yet created

## Objective

1) Identify how `prime_contract_change_orders` records with both `prime_contract_id` and `contract_id` NULL are being created.
2) Backfill derivable parents (`prime_contract_id`) for legacy orphans.
3) Prevent future orphan creation at API-level and generic insert path.
4) Return clear `404`/`422` for document-center PDF requests when parent is missing.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is completed, with evidence and outcomes.
If any item cannot be completed, mark status as `Blocked/Deferred` and document owner + next action.

## Scope Checklist

- [x] Relevant API/code paths that create `prime_contract_change_orders` identified.
- [x] Distinguish import/automation paths from user UI paths.
- [x] Shared validator/helper extracted rather than duplicated at multiple call sites.
- [x] Existing legacy `contract_id` path behavior preserved where contract route intentionally writes that linkage.

## Implementation Checklist

- [x] Add DB migration for backfill of derivable orphan `prime_contract_change_orders` rows.
- [x] Add DB check constraint/guard for future inserts requiring at least one parent key.
- [x] Add/extend runtime validation in direct prime CO create API to resolve parent from sole project prime contract when absent.
- [x] Add/extend generic table-insert guard for `prime_contract_change_orders`.
- [x] Fix `convert-to-co` flow to include parent assignment where derivable.
- [x] Make PDF loader return explicit status for missing parent instead of implicit 500.
- [x] Add clear detection messages and return codes for `document-center` PDF endpoint.

## Verification Checklist

- [x] Live DB evidence captured for orphan counts and derivable count.
- [ ] Migration applied and verified in remote Supabase with `npm run db:migrations:verify-applied`.
- [x] Admin repair surface for non-derivable orphans is implemented (`/prime-contract-change-order-orphans` admin workflow).
- [ ] Targeted API tests/run(s) and smoke checks captured for:
- [ ] End-to-end proof command or DB proof for repaired behavior where practical.

## Evidence

- [x] DB evidence (orphan total and derivation candidates):
  - `supabase` query + helper script indicates `orphan_total 122`, `derivable 0`, `ambiguous 51`, `no_prime_contract 71` on 2026-07-01.
  - `created_by` null: 118/122, `acumatica_external_key` non-null: 116/122 among null-created rows, indicating historical Acumatica projection path as dominant source.
- [ ] Migration evidence.
- [ ] API error behavior evidence.
- [ ] Completion evidence for non-import origin:
  - Remaining 4 non-null `created_by` rows in project 67 had historical four-prime-contract ambiguity and were not derivable from project contract counts.

## Policy Decision for Non-Derivable Orphans

### Bucket A: `ambiguous` (51 rows)

- These projects have 2+ candidate prime contracts, so the parent is not uniquely derivable.
- **No automatic backfill or assignment allowed.**
- Repair is manual: admin assigns a single `prime_contract_id` explicitly after project review.
- The API supports explicit assignment by `PATCH /api/admin/prime-contract-change-order-orphans`.

### Bucket B: `no_prime_contract` (71 rows)

- These projects have 0 prime contracts, so there is no valid target.
- **No automatic backfill or assignment is possible.**
- Repair options:
  - create the missing `prime_contracts` row(s) first, then perform reassignment, or
  - archive/invalidate/remove the orphan PCCO rows if they are invalid legacy artifacts.

## Files Changed

- frontend/src/app/(admin)/prime-contract-change-order-orphans/page.tsx
- frontend/src/lib/prime-contracts/resolve-pcco-parent.ts
- frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/route.ts
- frontend/src/app/api/table-insert/route.ts
- frontend/src/app/api/projects/[projectId]/pcos/[pcoId]/convert-to-co/route.ts
- frontend/src/app/api/projects/[projectId]/prime-contract-pcos/[pcoId]/promote/route.ts
- frontend/src/app/api/projects/[projectId]/prime-contract-pcos/promote-bulk/route.ts
- frontend/src/lib/documents/record-documents.ts
- frontend/src/app/api/document-center/[recordType]/[recordId]/pdf/route.ts
- backend/src/services/acumatica_sync.py
- supabase/migrations/20260701000000_prime_contract_change_order_parent_guardrails.sql
- frontend/src/app/api/admin/prime-contract-change-order-orphans/route.ts

## Final Status

- [ ] All checklist items complete.
- [x] Known unrelated failures documented with owner and next action.

## Blocker

- `npm run db:migrations:verify-applied -- supabase/migrations/20260701000000_prime_contract_change_order_parent_guardrails.sql` reports migration `20260701000000` not applied on remote ledger.
- `npm run db:push` fails with `Invalid access token format. Must be like 'sbp_0102...1920'.`
