# Task: Docs site skills category

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-25
Linear Issue: Not created yet - blocked
Related Handoff: N/A

## Objective

Add a generated Skills category to `docs/alleato-os-docs` so the docs site
exposes the real installed skill set from the workspace, user-level skill
directories, and plugin caches, with one detail page per actual `SKILL.md` file.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- Docs navigation includes a dedicated Skills category.
- The docs site contains overview pages for the major skill sources and links to
  generated detail pages for every discovered `SKILL.md`.
- The `documentation-writer` skill is directly reviewable from the docs site and
  its detail page points back to the original filesystem path.
- A verifier fails if the manifest count drifts from the current filesystem scan
  or if the Skills category disappears from `docs.json`.

## Files To Change

- `docs/ops/tasks/2026-06-25-docs-site-skills-category.md`
- `scripts/dev-tools/generate-skills-docs.mjs`
- `scripts/verify/verify_skills_docs.mjs`
- `package.json`
- `docs/alleato-os-docs/docs.json`
- `docs/alleato-os-docs/skills/**` (generated)

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `node --check scripts/dev-tools/generate-skills-docs.mjs`; `node --check scripts/verify/verify_skills_docs.mjs` | Pass | Generator and verifier syntax are valid. |
| Targeted tests        | `npm run docs:generate-skills`; `npm run docs:verify:skills` | Pass | Generated 687 skills pages and verified manifest count, nav entries, and documentation-writer coverage. |
| Browser/user-flow     | `cd docs/alleato-os-docs && npm run dev` | Blocked | Mintlify preview fails on pre-existing docs parse errors outside this task: `asrs/asrs-requirements.md`, `developer-docs/database/database-tables.mdx`, and multiple `research/notebooklm-marketing-accounting-upload/*.md` files. |
| DB/provider read-back | N/A                | Pass   | No database or provider changes. |
| End-to-end proof      | `docs/alleato-os-docs/skills/index.mdx`; `docs/alleato-os-docs/skills/generated/skills-manifest.json`; `docs/alleato-os-docs/skills/generated/agents/documentation-writer-2e0cb62f.mdx` | Pass | The docs site now contains a Skills category, source overview pages, and detail pages generated from the actual `SKILL.md` files. |

## Files Changed

- `docs/ops/tasks/2026-06-25-docs-site-skills-category.md` - task ledger and evidence.
- `scripts/dev-tools/generate-skills-docs.mjs` - generator for skills docs pages and manifest.
- `scripts/verify/verify_skills_docs.mjs` - skills docs verifier.
- `package.json` - generation and verification script entries.
- `docs/alleato-os-docs/docs.json` - Skills category navigation.
- `docs/alleato-os-docs/skills/**` - generated overview, source index, manifest, and detail pages.

## Risks / Gaps

- `docs/alleato-os-docs` is a symlink to
  `/Users/meganharrison/Documents/github/alleato-os/apps/docs`; docs edits land
  in that repo boundary.
- The symlinked docs repo already has unrelated dirt; this task must stay scoped
  to the generated Skills docs files and nav only.
- Linear issue creation is blocked because the current toolset does not expose a
  Linear issue-create flow.
- Full Mintlify browser preview is blocked by existing unrelated MDX parse debt
  in other docs pages; this task does not attempt to repair those legacy files.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
