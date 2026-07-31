# Linear Codex Process

Linear is the work source of truth. The local orchestration files are the evidence ledger. Every Codex-owned issue must keep both in sync.

## Required Mapping

Every Codex task must have:

- One parent Linear issue for the user-visible outcome.
- One active Codex worker session in `session-board.md`.
- One handoff file in `docs/ops/handoffs/`.
- One Linear issue reference in the handoff intake block.
- One Linear comment for every start, milestone, blocker, review request, and completion handoff.

If the work has more than one independently verifiable slice, create Linear sub-issues immediately. Do not hide sub-work in comments when it changes ownership, evidence, risk, or definition of done.

## Issue State Contract

Use these Linear states for Codex work:

| Codex event | Linear action |
|---|---|
| Work accepted into queue | Create or update issue, assign/delegate to Codex, state `Todo` |
| Worker claims task | Set state `In Progress`, add kickoff comment, link handoff path |
| Worker discovers separate scope | Create sub-issue with `parentId`, link it in the parent comment |
| Worker is blocked | Set state `In Review` only if asking for review, otherwise keep `In Progress` and post blocker comment |
| Worker submits handoff | Set state `In Review`, post evidence comment |
| Leader accepts handoff | Set state `Done`, post acceptance comment |
| Leader rejects handoff | Set state `In Progress`, post rework comment with exact missing evidence |

## Worker Checklist

Before coding:

1. Confirm the Linear issue exists. If not, create it in the `Alleato AI` team.
2. If the issue is too broad, create sub-issues before coding and work exactly one active sub-issue.
3. Claim the same issue in `session-board.md`.
4. Create the handoff file from `docs/ops/handoffs/HANDOFF-TEMPLATE.md`.
5. Add the Linear issue ID and URL to the intake block.
6. Post a Linear kickoff comment with scope, owned paths, stop condition, and handoff path.

During work:

1. Update the handoff at meaningful milestones.
2. Run `npm run linear:codex:comment -- docs/ops/handoffs/<file>.md` to generate the Linear update body.
3. Post that body to the Linear issue with the Linear connector.
4. Create sub-issues when a finding needs independent implementation, review, or evidence.

Before handoff:

1. Run `npm run linear:codex:check -- docs/ops/handoffs/<file>.md`.
2. Post the generated completion or blocker comment to Linear.
3. Update the Linear issue state to `In Review` for review-ready work, or leave it `In Progress` for active blockers.
4. Add all evidence paths before asking for acceptance.

## Leader Checklist

At intake:

1. Reject any Codex task that has no Linear issue reference.
2. Reject any handoff that has no Linear update evidence.
3. Confirm sub-issues exist for independently owned work.

At review:

1. Compare `review-queue.md`, the handoff intake block, and the Linear issue comments.
2. Accept only when the handoff has command evidence, artifacts, changed files, known risks, and a posted Linear update.
3. If evidence is missing, mark the review row `Needs Rework` and post the same reason to Linear.
4. If accepted, set the Linear issue or sub-issue to `Done`.

## Linear Comment Format

Use this format for every Codex update:

```md
## Codex Update

Status: In Progress | Pending Review | Blocked | Accepted | Needs Rework
Session: S##
Task: AAI-###
Handoff: docs/ops/handoffs/YYYY-MM-DD-S##-topic.md

What changed:
- ...

Evidence:
- ...

Commands:
- ...

Risks / blockers:
- ...

Next action:
- ...
```

## Failure Guardrail

A Codex issue fails loudly when any of these are true:

- The handoff has no Linear issue ID.
- The handoff has no evidence artifact path.
- The handoff has no command outcome.
- The handoff has no next action.
- The Linear issue has no latest Codex comment matching the current handoff.
- A broad parent issue contains multiple untracked implementation slices.

Use `npm run linear:codex:check -- docs/ops/handoffs/<file>.md` before claiming work is ready.
