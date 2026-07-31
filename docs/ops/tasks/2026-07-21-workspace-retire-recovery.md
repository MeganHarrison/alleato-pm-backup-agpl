# Task: Recover Published Isolated Workspaces Reliably

Status: In Progress
Owner: Codex SROOTOPS1
Verification contract: targeted script syntax and stale-workspace recovery

## Checklist

- [x] Root cause identified: retirement checks local branch merge state after proving `origin/main` ancestry.
- [x] Retire skips an already-removed worktree and deletes only the proved-published branch.
- [ ] Targeted verification and recovery of the stale AAI-1188 registry entry are complete.

## Evidence

- Detection: SROOT1188E worktree was removed, but branch deletion failed because local `main` was stale; registry was never marked retired and blocked subsequent owned paths.
- Guardrail: retirement now treats `origin/main` ancestry as authoritative, handles a missing worktree idempotently, and updates the registry after exact-branch deletion.
