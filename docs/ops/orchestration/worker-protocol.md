# Worker Protocol

Use this protocol for High-risk and multi-session work. Fast and Standard single-session changes use the delivery-lane policy in `AGENTS.md` instead.

## Before Work

1. Confirm or create the Linear issue only for High-risk, tracked, or multi-session work.
2. Claim exact task-owned paths only when another writer may overlap.
4. Create handoff file from template:
   - `docs/ops/handoffs/YYYY-MM-DD-S<session>-<topic>.md`
5. Record:
   - Linear issue ID and URL
   - task scope
   - expected outputs
   - files/modules owned
6. Post one kickoff comment to Linear when Linear is in scope.
7. Create and enter an isolated workspace before editing. Do not mutate canonical main:

```bash
node scripts/ops/isolated-session-workspace.mjs create \
  --session S<id> --task <Linear-id> \
  --paths <exact-owned-paths> --expires-hours 24
```
8. Record the lease/session in the handoff and post a kickoff comment to Linear with scope, owned paths, stop condition, and handoff path when the connector is available.

## During Work

Update the handoff only at a material milestone, blocker, or handoff with:

- What changed
- Command evidence
- Risks discovered
- Evidence artifacts

Audit the active lease at each milestone. It renews the reservation. A failure proves another session wrote outside your ownership and must be recorded immediately:

```bash
node scripts/ops/checkout-session-gate.mjs audit --session S<id>
```

Before handoff, run:

```bash
npm run linear:codex:comment -- docs/ops/handoffs/YYYY-MM-DD-S<session>-<topic>.md
```

Post the generated body to the linked Linear issue with the Linear connector.

## Required Intake Block (No Chat Relay Needed)

Each worker handoff must include this exact block so the leader can auto-review from files:

1) Session ID
2) Task ID
3) Linear issue
4) Linear URL
5) Current status: In Progress | Pending Review | Blocked
6) Files changed (absolute paths)
7) Commands run and outcome (pass/fail counts)
8) Evidence artifacts (screenshot/video/report/log paths)
9) Top 3 findings (frontend-visible issues first)
10) Recommended next action (one line)
11) Handoff file path
12) Migration ledger evidence: required for every touched `supabase/migrations/*.sql`; include `npm run db:migrations:verify-applied -- <migration-file>` output or an explicit deferred reason.

## Completion Rules

Do not mark complete without:

- command output summary
- artifact paths
- list of changed files
- migration ledger evidence for every changed Supabase migration, when applicable
- next step for leader/reviewer
- Linear closeout comment when Linear is in scope

Run this before submitting:

```bash
npm run linear:codex:check -- docs/ops/handoffs/YYYY-MM-DD-S<session>-<topic>.md
```

## Status Labels

- `In Progress`
- `Pending Review`
- `Needs Rework`
- `Accepted`
- `Blocked`

## Hard Stops

- If an owned path overlaps another active workspace, coordinate reassignment in `session-board.md`. Unrelated canonical dirt is not a blocker and must never be staged, recovered, stashed, rebased, or overwritten.
- If canonical integration is dirty with stale unowned untracked artifacts, the integration owner uses the governed `checkout-session-gate.mjs quarantine` workflow; mutating workers continue in their isolated workspaces.
- Tracked modifications, active owners, fresh files, or open handles are never quarantined.
- If ownership conflicts appear, use the overlapping lease named by `claim` and coordinate reassignment. Do not edit the shared session board merely to obtain a lock. Non-overlapping clean paths may be claimed concurrently.
- If the checkout is dirty with stale unowned untracked artifacts, do not stop passively or delete them. Use the leader runbook's governed `checkout-session-gate.mjs quarantine` workflow, preserve its manifest in the handoff, then claim the lease.
- Tracked modifications, active owners, fresh files, or open handles remain hard stops until their named owner publishes or hands them off.
- If evidence is missing, do not claim done.
- Do not create duplicate tracking records for Fast or Standard single-session work.
