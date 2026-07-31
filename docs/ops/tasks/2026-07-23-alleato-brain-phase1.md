# Task: Alleato Brain — Phase 1 Business Areas Foundation

Status: In Progress
Owner: Codex (session SBRAIN1)
Created: 2026-07-23
Task ID: ALL-7
Linear Issue: ALL-7 — https://linear.app/alleato-group/issue/ALL-7/alleato-brain-move-company-knowledge-out-of-fake-projects-full
Related Handoff:
`docs/ops/handoffs/2026-07-24-SBRAIN1-alleato-brain-foundation.md`

## Objective

Create and harden the hidden "Business Area" (Alleato Brain branch)
classification in the live databases: five seeded branches, membership,
fake-project→branch mapping, exact document/RAG labels, and deny-by-default
Finance authorization.

## Scope

- New tables `business_areas`, `business_area_memberships`, `business_area_project_map`
- `document_metadata.business_area_id` (nullable FK + partial index)
- `current_is_business_area_member()` helper + additive RLS policies
- Seed: leads, ai, finance (restricted), internal-operations, marketing; map 756/767/60/90/89
- AI Database direct-access lockdown for the server-only RAG tables
- Excluded (later phases): durable ingestion routing, Brain UI, archiving

## Source of Truth

- Canonical runtime/data owner: production PM Supabase (`lgveqfnpkxvzbnnwuled`)
- Existing shared primitives/services: RLS idiom from `supabase/migrations/20260427130000_secure_rag_documents_rls.sql`
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Migration applies cleanly to the live database and appears in the remote ledger
- [x] Five branches exist; Finance `is_restricted = true`; five project mappings exist
- [x] `document_metadata.business_area_id` exists; Phase 1 initially left all
      existing rows null, then the separately recorded Phase 2 operation
      labeled exactly 2,115 rows without clearing their legacy project stamp
- [x] Finance access is fail-closed through a restrictive RLS guard; legacy
      team, leadership, and project-60 membership do not bypass it
- [ ] Durable ingestion prevents new legacy-container rows from drifting
- [x] Failure-loudly behavior is defined (below)

## Implementation Checklist

- [x] Files/modules to change are listed before edits
- [x] Shared abstraction owns cross-cutting behavior (mirrors `current_is_project_member` idiom)
- [x] Errors are specific and actionable
- [x] Database contracts handled: remote ledger verified and the generated
      frontend types on `origin/main` contain the Business Area tables,
      membership table, mapping table, helper function, and document column

Owned files:

- `supabase/migrations/20260723180000_create_business_areas_foundation.sql`
- `supabase/migrations/20260724043000_harden_business_area_authorization.sql`
- `scripts/database/rag/migrations/20260724044500_lock_down_rag_knowledge_tables.sql`
- `scripts/database/rag/migrations/20260724045000_backfill_fireflies_business_area_drift.sql`
- `scripts/database/verify-alleato-brain-foundation.mjs`
- this task file and `docs/ops/evidence/2026-07-23-alleato-brain-phase1/`

## Integration and Verification

- [x] `npm run db:migrations:verify-applied -- supabase/migrations/20260723180000_create_business_areas_foundation.sql` passes
- [x] Live readback: branches, mappings, labels, policies, and unarchived containers verified by SELECT
- [ ] Fresh readback: current app and RAG Business Area labels exactly match
      retained legacy container labels after durable Fireflies routing lands
- [ ] Independent review approves the final hardening contract
- [x] Interim evidence artifacts recorded in the evidence directory

## Failure-Loudly Contract

- Cause surfaced as: migration apply error from Management API / ledger verify failure
- Detection path: `npm run db:migrations:verify-applied` + live SELECT readback (evidence)
- Recovery path: inspect the exact failed statement and remote ledger before
  retrying; the migration is additive but policy creation is intentionally
  ledger-governed and must not be blindly replayed

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260723180000_create_business_areas_foundation.sql` | Pass | Remote ledger contains `20260723180000`. |
| Live foundation readback | `ALLEATO_ENV_FILE=... node scripts/database/verify-alleato-brain-foundation.mjs` | Blocked | The hardened verifier correctly detects one new Fireflies project-60 row without the exact Finance label. |
| Phase 1 snapshot | `docs/ops/evidence/2026-07-23-alleato-brain-phase1/phase1-evidence.md` | Pass | Proves zero rows were changed by the foundation migration itself. |
| Phase 2 snapshot | `docs/ops/evidence/2026-07-23-alleato-brain-phase1/phase2-evidence.md` | Pass | Proves exact initial relabel parity without deletes or access tightening. |
| Patch hygiene | `git diff --check` | Pass | No whitespace errors. |

## Remaining Risk

- Finance has zero memberships, so it remains fail-closed in the now-published
  AI authorization layer. Membership seeding requires an approved roster.
- Named branch owners and task disposition are governance gates; no owner or
  workflow assignment is fabricated by this foundation slice.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Final evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Current ingestion blocker names the cause and safe next action.
