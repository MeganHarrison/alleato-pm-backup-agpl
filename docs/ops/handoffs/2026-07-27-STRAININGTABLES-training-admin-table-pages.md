# Training Admin Table Pages Handoff

Delivery lane: High-risk

## Outcome

Implemented a shared owner-only administration surface for all ten
training-owned tables at `/training-data/[tableKey]`. Every table uses
`UnifiedTablePage` and real allowlisted CRUD APIs with search, sorting,
pagination, filters, column visibility, CSV export, create, edit, single delete,
and bulk delete.

## Verification

- Pass: 3 focused suites, 19 tests.
- Pass: focused ESLint, changed-scope type guard, unsafe-pattern guard, and
  route naming gate.
- Pass: live read access confirmed for all ten Supabase tables.
- Pass: dynamic route compiled and a non-owner session failed loudly through
  the access-denied route.
- Pass: independent review findings were resolved by aligning navigation with
  owner-only authorization and making asset deletion reversible through storage
  quarantine and rollback.
- Baseline debt: repository TypeScript reports 275 unrelated diagnostics; none
  are in task-owned files.
- Blocked: authenticated owner list/create/edit/delete browser proof. The
  existing auth bootstrap reports missing `ADMIN_E2E_EMAIL` and
  `ADMIN_E2E_PASSWORD`.

## Migration ledger evidence

No migration was created or changed.

## Failure contract

Invalid table keys, malformed payloads, stale records, authorization failures,
relationship failures, and storage rollback failures return specific errors.
Training Docs storage objects are quarantined before database deletion,
restored on database failure, and purged only after database success.

## Remaining action

Configure the existing secure admin E2E credential inputs and capture the
owner CRUD browser artifacts. No product-code change is expected for that step.
