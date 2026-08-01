# Task: Retire legacy recovery state

Status: Complete
Owner: Codex
Created: 2026-07-31
Task ID: LEGACY-RECOVERY-20260731
Linear Issue: Not requested
Related Handoff: N/A

## Objective

Remove obsolete local recovery state without losing any non-sensitive unfinished work.

## Scope

- Retire empty and temporary Git stashes.
- Create remote archive tags for non-sensitive legacy recovery content.
- Excludes release or deployment of stale implementation code.

## Source of Truth

- Canonical runtime/data owner: Git stash and local branch references.
- Existing shared primitives/services: `scripts/ops/isolated-session-workspace.mjs`.
- Deprecated or parallel paths: unmanaged local recovery state.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] No empty or temporary recovery stash remains.
- [x] Non-sensitive legacy recovery content is recoverable from a verified remote tag.
- [x] No credential, saved-auth, or certificate path is included in archival commits.
- [x] No stale implementation is deployed as part of this cleanup.

## Failure-Loudly Contract

- Cause surfaced as: unsafe recovery content or an unverified archive tag.
- Detection path: raw Git-tree path scan and remote tag read-back.
- Recovery path: retain the source stash and stop before deletion.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- |
| Inventory | `git stash list` | Pass | Legacy stash inventory captured before mutation. |
| Archive read-back | `git ls-remote --tags origin 'archive/2026-07-31/recovery/sanitized-legacy-stash-*'` | Pass | Four sanitized archive tags are present remotely. |
| Sensitive-path scan | `git ls-tree -r --name-only <archive-tag>` | Pass | No auth, certificate, key, token, or environment paths are in archival commits. |
| Local cleanup | `git stash list` | Pass | No local stashes remain. |
| Release assessment | `git diff --stat <archive-tag> HEAD` | Pass | July 21 scheduling code and July 17 AI-specialist code remain archived; neither was revived or deployed. |

## Remaining Risk

- Stale implementation contained in archived commits is intentionally not deployed. Any reuse requires a new task against current `main`.

## Final Status

- [x] All required cleanup and verification items are complete.
