# Task: Project Owner and Developer Handoff

Status: Blocked/Deferred — documentation drafted locally; Linear reauth is required before the formal tracking step can be completed.

## Scope

Create a concise, durable documentation package that an owner can use to explain the project and that a new developer can use to get productive without reverse-engineering the repo.

## Checklist

- [x] Review the current architecture, project map, folder structure, and docs operating model.
- [x] Draft a handoff-oriented documentation artifact with owner-facing and developer-facing sections.
- [x] Include the repo entry points, scripts, and guardrails a new developer actually needs.
- [ ] Create the formal Linear issue and kickoff comment. Blocked by `oauth_token_invalid_grant` / reauthentication requirement.
- [x] Run markdown validation or direct file inspection on the new documentation files.
- [x] Add the corresponding worker handoff record and keep it aligned with the task status.

## Failure-Loudly Guardrail

The handoff must fail loudly on ownership ambiguity. If the next developer cannot tell which runtime owns the work, where the route lives, or which command proves the change, the documentation is incomplete.

## Evidence

- Repo map and boundary docs reviewed: `docs/architecture/PROJECT-MAP.md`, `docs/architecture/ALLEATO-SYSTEM-MAP.md`, `docs/architecture/FOLDER-STRUCTURE.md`, `docs/architecture/DOCS-OPERATING-MODEL.md`.
- Root and frontend scripts reviewed from `package.json` files to capture the real developer entry points.
- Linear connector attempted and failed with `oauth_token_invalid_grant`; the tracking step is deferred until reauthentication is available.
- New handoff and task files were created under `docs/ops/handoffs/` and `docs/ops/tasks/`, and the handoff now points at the real `docs/ops/memory/current-state.md` file.
- `npm run linear:codex:check -- docs/ops/handoffs/2026-07-13-S128-project-owner-developer-handoff.md` passed after aligning the handoff to the repo parser shape, but the real Linear issue creation step remains blocked by auth.
