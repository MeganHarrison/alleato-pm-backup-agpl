# Issue Tracker

Matt Pocock skills use two distinct tracker surfaces in this repository. Do
not infer task ownership from the GitHub remote.

## Linear: Codex task ownership

Linear is the source of truth for every full-process Codex task.

- Create the Linear issue before implementation, using the `Alleato AI` team
  unless the work belongs to a different explicit team.
- Record its ID and URL in the task markdown and handoff intake block.
- Post kickoff, milestone, blocker, review, and acceptance comments through the
  Linear connector.
- Use Linear states for active work. Do not mark a task done until its task file,
  evidence, and screenshot gate are satisfied.
- When `to-spec`, `to-tickets`, `triage`, or `wayfinder` says to publish a
  ticket, create or update the Linear issue and use native blocker/parent
  relations where the workflow needs them.

See `docs/ops/orchestration/linear-codex-process.md` for the required comment,
handoff, review-queue, and state transitions.

## GitHub Issues: intake and ranked backlog

GitHub Issues are the ranked intake/backlog surface for this repository.

- Read and triage incoming GitHub Issues with `gh` when the request originates
  there.
- Do not use a GitHub Issue as the ownership record for a full Codex task.
- When intake becomes approved agent work, create the corresponding Linear
  issue, link both records, and continue tracking implementation in Linear.
- External pull requests are **not** a triage request surface.

The GitHub backlog conventions live in `docs/ops/BACKLOG-SYSTEM.md`.

## Skill translation rules

| Skill wording | Repository action |
| --- | --- |
| "Publish to the issue tracker" | Create or update a Linear issue. |
| "Fetch the relevant ticket" | Read the Linear issue and its comments; read the linked GitHub Issue only when it is the intake source. |
| "Apply a triage label" | Apply the configured Linear triage label after intake is represented in Linear. |
| "Create a blocker" | Use a native Linear blocker relation and record the dependency in the issue body when useful for readers. |
