# Task: Harden Alleato Brain document reads

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-DOCUMENT-READ
Linear Issue: ALL-11 (referenced by the migration blueprint; Linear connector is unavailable in this session)
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINDOC-alleato-brain-document-read.md`

## Objective

External authenticated contacts cannot read, insert, update, or delete a
Business Area document through a legacy permissive `team` policy.

## Scope

- Add the active-internal restrictive `document_metadata` policy, upgrade the
  restricted-area guard to all operations, and add a live rolled-back
  internal/member/external principal verifier.
- Do not change unscoped legacy documents, owner assignments, Finance
  memberships, Phase 2 stamps, or cutover state.

## Source of Truth

- Canonical runtime/data owner: PM Supabase `document_metadata` RLS
- Existing shared primitives/services:
  `current_is_active_internal_employee`, `current_is_app_admin`, and
  `current_is_business_area_member`
- Deprecated or parallel paths: legacy permissive `access_level='team'`
  document read policy remains for unscoped records

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Business Area documents require an active internal employee at the RLS boundary.
- [x] Active-membership and app-admin alternatives independently protect and
      authorize every restricted-area operation.
- [x] Unscoped legacy document behavior is unchanged.
- [x] The migration is applied and present in the linked remote ledger.
- [x] A rolled-back live fixture proves internal open-branch CRUD, Finance
      nonmember/inactive-member denial, active-member CRUD, independent
      app-admin CRUD, external-contact CRUD denial, and preserved unscoped CRUD.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned paths:

- `supabase/migrations/20260724100000_harden_business_area_document_reads.sql`
- `scripts/database/verify-alleato-brain-document-read.mjs`
- `docs/ops/tasks/2026-07-24-alleato-brain-document-read.md`
- `docs/ops/handoffs/2026-07-24-SBRAINDOC-alleato-brain-document-read.md`
- `tests/agent-browser-runs/2026-07-24-alleato-brain-document-read/**`
- `docs/ops/learning/recurring-failures.yaml`

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Independent high-risk review approves the exact live state.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `ALLEATO_BRAIN_DOCUMENT_*` assertion naming a missing
  policy, invalid policy contract, missing fixture prerequisite, accepted
  forbidden operation, or broken positive authorization path.
- Detection path: exact migration ledger check plus live policy readback and a
  rolled-back authenticated principal transition.
- Recovery path: restore the restrictive policy from the timestamped migration
  and rerun the verifier before re-enabling the Brain UI release.

## Incident Learning

- Failure fingerprint: `security.business-area-document-external-read`
- Root cause: a permissive `access_level='team'` document policy treated every
  authenticated identity as internal while Business Area routing assumed
  company-staff semantics.
- Detection gap: existing external-principal proof covered Meetings and Tasks,
  but not Business Area Knowledge/Files or the signed-source boundary.
- Prevention: require active internal status and restricted-area membership in
  restrictive `ALL` policies; exercise all four operations as nonmember,
  member, and external principal; preserve unscoped behavior explicitly.
- Guardrail evidence:
  `scripts/database/verify-alleato-brain-document-read.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Migration compile | verifier `--compile` | Pass | Exact migration compiled in the linked database and rolled back. |
| Migration ledger | `db:migrations:verify-applied` | Pass | Exact version `20260724100000` is present locally and remotely. |
| Live authorization | document-read verifier | Pass | Open/member/admin CRUD passed independently; nonmember, inactive-member, and external Business Area paths were denied; unscoped CRUD passed; rollback completed. |
| Independent review | `independent-review.md` | Pass | Final review approved the exact all-operation policy and live principal matrix. |
| Verification contract | `verification-manifest.json` + `verification-result.json` | Pass | Every declared claim binds to current evidence and final approval. |

## Remaining Risk

- Unscoped legacy `team` documents keep their prior visibility by design; this
  policy is intentionally scoped to rows owned by a Business Area.
- `npm run db:migrations:verify-clean` remains red on historical remote-only
  versions absent from this checkout. The exact task migration ledger check
  passes; those historical files are not owned by this task.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
