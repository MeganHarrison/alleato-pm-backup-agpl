# CRM-native leads handoff

Task ID: ALL-52

Session: S019FB13

Branch: `codex/s019fb13-all-52-894195`

Status: Complete

## Intent

Replace Acumatica/company enrollment as the only Add lead path with a CRM-native lead
identity that supports deal, activity, and shared-task workflows.

## Invariants

- Never create a `companies` row as a side effect of lead creation.
- Exactly one relationship target is present on every CRM deal and activity.
- Existing company-backed CRM behavior remains supported.
- CRM follow-ups remain ordinary shared tasks with CRM linkage.

## Verification required

- Focused component and API tests
- SQL migration tests and generated database types
- Lint/typecheck for changed files
- Independent standards/spec/security/database/React review
- Production migration ledger readback
- Authenticated desktop and mobile screenshots on the final CRM route

## Delivered

- Added the CRM-owned `crm_leads` identity and explicit lead-to-account conversion.
- Added lead relationship targets to deals, activities, and shared Tasks follow-ups.
- Added permission, owner-alignment, conversion replay, and active-account database
  guards.
- Preserved authoritative scheduling cascade and schedule-cost RPCs in generated
  `frontend/src/types/database.types.ts`.
- Applied and ledgered all six production migrations.

## Verification

- Production pgTAP: 38 assertions passed.
- Focused Jest: 6 suites and 17 tests passed.
- Focused lint and scoped changed-file type verification passed.
- Independent code, database, and security reviews: APPROVED.
- Authenticated exact-build desktop and mobile browser checks passed.
- Verification artifacts:
  `docs/ops/verification/2026-07-30-crm-native-leads-*`
- Desktop screenshot:
  `tests/agent-browser-runs/2026-07-30-crm-native-leads/crm-native-lead-desktop.png`
- Mobile screenshot:
  `tests/agent-browser-runs/2026-07-30-crm-native-leads/crm-native-lead-mobile.png`
