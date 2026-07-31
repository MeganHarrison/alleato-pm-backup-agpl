# Task: Align Alleato Brain search types

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-PHASE3-SEARCH-TYPES
Linear Issue: ALL-11
Related Handoff: N/A — bounded single-session type contract update.

## Objective

Align the checked-in AI Database type boundary with the live, branch-scoped
`search_document_chunks` function.

## Scope

- `frontend/src/types/rag-database.types.ts`
- Runtime search behavior and database migration are owned by
  `ALL-11-PHASE3-SEARCH` and excluded here.

## Source of Truth

- Canonical runtime/data owner: AI Database `public.search_document_chunks`
- Existing shared primitive: `createRagServiceClient`
- Deprecated or parallel paths: PM APP `database.types.ts` is not the RAG owner

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Function arguments include the exact optional Business Area filter.
- [x] Function returns include the typed Business Area and ranking fields.
- [x] PM APP generated types remain unchanged.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Canonical RAG type boundary is updated without a parallel type.
- [x] Live generation output matches the checked-in function contract.

## Integration and Verification

- [x] `git diff --check` passes.
- [x] Supabase type generation against project `fqcvmfqldlewvbsuxdvz` confirms
      the exact argument and return field set.
- [x] The parent search task owns live database and authorization evidence.
- [x] Task-owned files are published through `codex:finish`.

## Failure-Loudly Contract

- Cause surfaced as: TypeScript rejects an unknown RPC argument or return field.
- Detection path: generated AI Database types and changed-file quality checks.
- Recovery path: regenerate the RAG type boundary from the live AI project.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The checked-in RAG function type predated the expanded live RPC.
- Detection gap: The migration draft initially did not include its type owner.
- Prevention: Treat the RAG type boundary as part of RPC signature changes.
- Guardrail evidence: Live Supabase type generation output.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Diff integrity | `git diff --check` | PASS | No whitespace errors. |
| Live type contract | `supabase gen types ... --project-id fqcvmfqldlewvbsuxdvz` | PASS | Arguments and return fields match. |

## Remaining Risk

- None in this type-only slice; runtime risk remains governed by the parent
  high-risk task.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No deferred work remains in this slice.
