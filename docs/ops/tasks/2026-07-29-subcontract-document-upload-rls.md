# Task: Restore Subcontract Document Upload Access

Status: Implemented, live, and verified
Owner: Codex S019fabcf
Created: 2026-07-29
Task ID: LOCAL-2026-07-29-SUBCONTRACT-DOCUMENT-RLS
Linear Issue: Not created; this is a bounded same-session production defect.

## Objective

Allow authenticated project members to upload and link documents to commitments while preserving row-level security for anonymous users and nonmembers.

## Scope

- Correct the shared `subcontract_documents` RLS policies.
- Verify the Avita at Bradenton SC-001 path with Andrew Cannon's authenticated identity.
- Preserve the existing Pattern C upload and metadata behavior.
- Exclude changes to project membership, commitment data, or uploaded customer documents.

## Source of Truth

- Database policy owner: `supabase/migrations/20260729235959_fix_subcontract_documents_rls.sql`
- Runtime upload owner: `frontend/src/lib/documents/pattern-c-attachments.ts`
- Access helper: `public.user_can_access_entity(text, text)`
- Governed commitment-to-project mapping: `public.commitments_unified`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] SELECT, INSERT, UPDATE, and DELETE policies authorize only the `authenticated` role.
- [x] Every operation resolves the subcontract UUID through the supported `commitment` entity path.
- [x] Andrew Cannon's active Avita membership authorizes SC-001.
- [x] Anonymous and nonmember identities remain denied.
- [x] A real link insert succeeds under Andrew's session and the verification row is removed.
- [x] The migration is replay-safe and covered by a focused regression test.

## Diagnosis

The upload completed far enough to insert `document_metadata`, then failed when linking it to `subcontract_documents`. All four junction policies called `user_can_access_entity('subcontract', ...)`, but that helper has no `subcontract` branch and deliberately returns false for unknown entity types. Andrew is an active member of Avita project 1149 and is not an app administrator, so the unsupported discriminator denied his insert.

The existing `commitment` branch is the correct authority because `commitments_unified` exposes subcontract UUIDs with their project IDs and then applies `current_is_project_member`.

## Evidence

| Check | Result |
| --- | --- |
| Pre-fix identity probe | Andrew: active Avita member; old `subcontract` path false; supported `commitment` path true. |
| Focused Jest regression | Passed; asserts complete restrictive blocks for all four policies and replay-safe drops. |
| Independent review | Approved after the regression test was strengthened. |
| Live policy readback | Four policies, role `{authenticated}`, correct `USING`/`WITH CHECK`, all using `commitment`. |
| Migration ledger | Version `20260729235959` is present locally and remotely. |
| Live Andrew insert | One verification link inserted successfully under Andrew's authenticated session. |
| Cleanup readback | Zero verification rows retained. |
| Negative paths | Anonymous false; authenticated nonmember false. |

## Failure-Loudly Contract

- Cause surfaced as: the focused test fails if any policy loses its authenticated role, operation guard, supported entity path, or replay-safe drop.
- Detection path: targeted Jest test plus linked-database policy and identity readback.
- Recovery path: correct the shared policy migration; do not bypass RLS, grant anonymous access, or special-case one user.

## Incident Learning

- Failure fingerprint: `documents.subcontract-junction-unsupported-rls-entity`
- Root cause: Every `subcontract_documents` policy passed the unsupported `subcontract` discriminator to the central helper, whose fail-closed default denied all non-admin users.
- Detection gap: No regression proved that each document-junction discriminator was implemented by the helper or that every operation retained its complete restrictive policy block.
- Prevention: every document junction must use an entity discriminator implemented by the central access helper and must have per-operation restrictive regression assertions.
- Guardrail evidence: `frontend/src/lib/documents/__tests__/subcontract-documents-rls-migration.test.ts`
