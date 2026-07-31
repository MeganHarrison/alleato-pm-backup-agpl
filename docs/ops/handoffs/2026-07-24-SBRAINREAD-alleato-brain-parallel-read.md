# Handoff: Alleato Brain parallel reads

Date: 2026-07-24
Session: SBRAINREAD
Task: ALL-11-PARALLEL-READ
Delivery lane: High-risk
Status: Complete

## Scope

- Transition-only Meetings/Tasks read visibility through permanent Business
  Area project mappings
- Restricted mapping guard that composes with legacy project policies
- Category-agnostic, RLS-bound document source opening for the Brain Files tab

## Non-goals

- No Phase 2 stamps, owners, Finance memberships, or fake-project archive
- No service-role read path for the Brain UI

## Implementation

- Added fixed-search-path helpers that reject mismatched direct/mapped scope,
  require active internal employment for broad legacy reads, and check every
  restricted scope.
- Replaced Meetings/Tasks restrictive policies so legacy project membership
  cannot bypass Finance membership.
- Kept the existing signed-URL endpoint path for compatibility while removing
  its obsolete `category=knowledge` restriction. The signed-in Supabase client
  and `document_metadata` RLS remain the authorization boundary.
- Regenerated the four new live function signatures into
  `frontend/src/types/database.types.ts`.

## Verification

- Migration compile transaction: PASS and rolled back.
- Remote migration ledger: PASS for `20260724090000`.
- Live rolled-back authorization fixture: PASS.
- Signed-URL unit suite: PASS, 6/6.
- Changed-file quality gate: PASS.
- Independent review: APPROVED after the initial review drove three
  high-severity fixes and live application/proof closed the operational gate.

## Migration ledger evidence

`npm run db:migrations:verify-applied -- supabase/migrations/20260724090000_harden_business_area_parallel_reads.sql`

Result: `Supabase migration ledger check passed: 20260724090000`.
