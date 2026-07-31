# Task: Harden Alleato Brain parallel reads

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-PARALLEL-READ
Linear Issue: ALL-11
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINREAD-alleato-brain-parallel-read.md`

## Objective

Authenticated company staff can read legacy mapped Meetings and Tasks for
non-restricted Business Areas during the parallel run, while Finance remains
fail closed even for fake-project members.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] A legacy project-only Meeting and Task in an unrestricted mapped branch
      are visible to an authenticated non-project-member.
- [x] A legacy project-only Finance Meeting and Task remain hidden from a
      non-admin fake-project member without Finance membership.
- [x] Mismatched direct/project scopes fail closed, including for a Finance
      fake-project member.
- [x] Company-wide legacy reads require an active internal employee.
- [x] Direct Business Area policies remain intact.
- [x] The transition mapping helpers are fixed-search-path and not callable by
      anonymous users.
- [x] The signed document route remains RLS-bound and supports every visible
      Brain file category without unsafe URL redirects.
- [x] Migration is applied and present in the remote ledger.
- [x] Live rolled-back authorization proof passes.
- [x] Final independent review passes.

## Failure-Loudly Contract

- Cause surfaced as: migration policy assertion or a named live visibility
  mismatch.
- Detection path:
  `ALLEATO_ENV_FILE=... node scripts/database/verify-alleato-brain-parallel-read.mjs`.
- Recovery path: restore the preceding policy definitions from migration
  `20260724061000`, repeat the verifier, and keep the Brain operational tabs
  unreleased.

## Incident Learning

- Failure fingerprint: `security.security-definer-anon-execute`
- Root cause: the UI's mapped-project OR-filter could not expand visibility
  beyond base-table project RLS.
- Detection gap: the first browser proof used an app-admin account, so it did
  not exercise an ordinary staff principal.
- Prevention: encode transition visibility in RLS, test a real non-admin
  principal with a rolled-back Finance project membership, and retain the exact
  mapping helper after cutover for ledger readback.
- Guardrail evidence:
  `ALLEATO_ENV_FILE=... node scripts/database/verify-alleato-brain-parallel-read.mjs`
  verifies the effective helper ACLs and the live authorization boundary.
