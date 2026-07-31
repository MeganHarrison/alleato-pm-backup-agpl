# Task: Machine-Backed Database Type Generation

Status: Complete
Owner: Codex Sworktreetype
Created: 2026-07-29
Task ID: local-machine-db-types
Linear Issue: Not requested; single-session tooling correction.
Related Handoff: Not required for a Standard single-session change.

## Objective

Generate the remote Supabase schema from any worktree using machine credentials,
without requiring Docker when the current CLI rejects a valid versioned token.

## Scope

- `scripts/generate-db-types.mjs`
- Focused fallback and shared-environment regression tests

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Shared machine environment loads before checkout-local environment files.
- [x] The known CLI token-format rejection falls back to postgres-meta.
- [x] Unrelated generation failures remain visible.
- [x] Remote generation works without Docker.

## Failure-Loudly Contract

- Cause surfaced as: exact CLI or fallback failure.
- Detection path: `node scripts/generate-db-types.mjs --check`.
- Recovery path: repair machine credentials or the reported schema mismatch.

## Evidence

| Check | Result |
| --- | --- |
| `node --test scripts/ops/__tests__/generate-db-types.test.mjs` | Pass, 3/3 |
| `node scripts/generate-db-types.mjs --check` | Remote schema generated through postgres-meta; existing tracked types correctly reported stale |
| Main publication | Pending exact-file publication through `codex:finish` |

## Remaining Risk

- `frontend/src/types/database.types.ts` is already stale and owned by separate product work; this tooling change detects it but does not overwrite that active scope.
