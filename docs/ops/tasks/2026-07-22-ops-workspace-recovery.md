# Task: Workspace Recovery Enforcement

Status: In Progress
Task ID: LOCAL-OPS-RECOVERY-0722
Delivery lane: Standard
Verification contract: Optional

## Objective

Replace the self-deleting workspace closeout with an explicit publication receipt and canonical-only retirement sweep.

## Checklist

- [x] Preserve the canonical dirty snapshot before recovery.
- [x] Prove the former closeout workspace is missing before retiring its registry entry.
- [x] Remove per-workspace Git bundles from handoff generation.
- [x] Record publication without deleting the active workspace.
- [ ] Prove sweep retires only a workspace whose files are published on `origin/main`.
- [ ] Publish the workflow change.

## Guardrail

An unpublished or dirty workspace is preserved. A workspace is eligible for deletion only after its publication receipt and exact remote-file comparison both pass.
