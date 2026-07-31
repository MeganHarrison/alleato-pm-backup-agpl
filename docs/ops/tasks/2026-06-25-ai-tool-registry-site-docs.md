# Task: AI Tool Registry Site Docs

Status: In Progress
Owner: Codex
Created: 2026-06-25
Linear Issue: Not created yet - blocked by process, proceeding with docs draft requested in-session
Related Handoff: None

## Objective

Create docs-site pages that explain the live AI assistant tools registry in
plain English, show exactly where the registry and routing instructions live in
the codebase, and provide a reusable template for documenting and improving tool
specs against the current Alleato implementation.

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
- [ ] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [ ] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd /Users/meganharrison/Documents/github/alleato-os/apps/docs && npm run lint` | Failed unrelated repo debt | `mintlify broken-links` aborted on existing parse error in `ai-features/MICROSOFT_EMAIL_ATTACHMENTS/MICROSOFT_WORKER_EMAIL_ATTACHMENTS.md` before evaluating the new pages. |
| Targeted tests        | `node -e 'JSON.parse(fs.readFileSync("docs.json","utf8"))'` plus file existence / nav grep checks | Passed | `docs.json` parsed, new pages exist, and nav + link references point at the new docs routes. |
| Browser/user-flow     | Not run            | Pending | Docs-site browser proof still pending. |
| DB/provider read-back | Not applicable     | N/A    | Docs-only task. |
| End-to-end proof      |                    |        |       |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-tool-registry-site-docs.md` - working definition of done for the docs task.
- `docs/ops/tasks/2026-06-25-ai-tool-registry-site-docs.md` - working definition of done for the docs task.
- `docs/alleato-os-docs/developer-docs/agent-tools/agent_tools.md` - linked the new pages from the existing AI Agent Tools entry page.
- `docs/alleato-os-docs/developer-docs/agent-tools/tool-registry-improvement-guide.mdx` - Alleato-specific guidance and concrete rewrite examples for the current registry.
- `docs/alleato-os-docs/developer-docs/agent-tools/tool-spec-template.mdx` - reusable markdown template that maps spec decisions into the live registry fields.
- `docs/alleato-os-docs/docs.json` - docs navigation updates for the new AI Tools pages.

## Risks / Gaps

- Linear issue was not created before drafting docs; if strict process enforcement
  is required, create/link the issue before calling the task complete.
- Site browser proof still needs to run before this can be called done.
- Docs lint is currently blocked by an unrelated existing parse error in
  `ai-features/MICROSOFT_EMAIL_ATTACHMENTS/MICROSOFT_WORKER_EMAIL_ATTACHMENTS.md`.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
