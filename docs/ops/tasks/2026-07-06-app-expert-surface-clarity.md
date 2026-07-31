# App Expert Surface Clarity

Date: 2026-07-06
Linear: AAI-945
Status: Complete

## Objective

Remove ambiguity between the production backend App Expert and the experimental Eve App Expert, while documenting the recommended user-facing AI page versus developer/debug AI console split.

## Scope

- Rename the Eve App Expert identity so it is explicitly experimental.
- Update the Eve app-help verifier to enforce the new identity.
- Add an App Expert Surfaces section to the system map.
- Add a developer/test AI console recommendation to the system map.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Inspect Eve project-layout and instructions docs before renaming the Eve agent.
- [x] Rename Eve package and prompt identity.
- [x] Update Eve app-help verifier.
- [x] Update architecture guide with App Expert surface split and developer AI console recommendation.
- [x] Run targeted verification.
- [x] Record evidence and close Linear issue.

## Evidence

- Linear issue: [AAI-945](https://linear.app/megankharrison/issue/AAI-945/clarify-app-expert-surfaces-and-rename-eve-experiment)
- Eve docs inspected before rename:
  - `agent/node_modules/eve/docs/reference/project-layout.md`
  - `agent/node_modules/eve/docs/instructions.mdx`
  - `agent/node_modules/eve/docs/concepts/execution-model-and-durability.md`
- Changed files:
  - `agent/package.json`
  - `agent/instructions.md`
  - `scripts/verify/verify_eve_app_help_agent.mjs`
  - `docs/architecture/ALLEATO-SYSTEM-MAP.md`
  - `docs/architecture/AGENT-SDK-MAP.md`
  - `docs/architecture/EVE-MIGRATION-ASSESSMENT.md`
  - `docs/ops/tasks/2026-07-06-app-expert-surface-clarity.md`
- Verification:
  - `npm run verify:eve-app-help-agent` passed.
  - `npx markdownlint-cli2 --no-globs docs/architecture/ALLEATO-SYSTEM-MAP.md docs/architecture/AGENT-SDK-MAP.md docs/architecture/EVE-MIGRATION-ASSESSMENT.md docs/ops/tasks/2026-07-06-app-expert-surface-clarity.md` passed with 0 errors.
  - `npm run eve -- info` passed through the repo Node 24 wrapper with compile ready, 0 errors, and 1 warning for ignored `agent/node_modules/`.
- Caveat:
  - Direct `npm --prefix agent run info` failed because the ambient shell Node is v22.17.1 and Eve requires Node >=24. The repo-supported wrapper `npm run eve -- info` succeeded.

## Initial Constraints

- Do not change production AI assistant routing in this slice.
- Keep end-user assistant personality guidance focused on one consistent front-end experience.
- Keep the Eve version explicitly labeled as a lab/experimental comparison surface.

## Failure-Loud Guardrail

The repo should no longer have two ambiguous "Alleato App Expert" identities. If a future reader cannot tell production backend App Expert from the Eve lab by name, this task failed.
