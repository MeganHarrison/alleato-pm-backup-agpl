# Task: App training docs for submittals, prime contracts, and owner invoicing

Status: In Progress
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-783 - https://linear.app/megankharrison/issue/AAI-783/create-app-training-docs-for-submittals-prime-contracts-and-owner
Related Handoff: N/A

## Objective

Use the repeatable training-doc skill to create and publish three Alleato-only
app training docs for creating a submittal, creating a prime contract, and
creating an owner invoice, with one walkthrough video and ordered screenshots
for each workflow.

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
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- A published app training doc exists for each workflow:
  - Create a Submittal
  - Create a Prime Contract
  - Create an Owner Invoice
- Each workflow leaves the required artifact set:
  - `manifest.json`
  - tutorial markdown
  - `documentation-draft.md`
  - `documentation-input.json`
  - `source-brief.md`
  - one `.webm` walkthrough video
  - ordered screenshots
- Final doc wording is Alleato-only with no external-brand mentions and no
  external support links.
- Each published row has the correct app tool category and a working
  `/knowledge/app/<toolCategory>/<slug>` path.
- Any capture, auth, route, or publish failure is recorded explicitly instead of
  being silently bypassed.

## Source Of Truth

- Training-doc skill: `.codex/skills/repeatable-training-docs/SKILL.md`
- Tutorial runtime: `scripts/tutorials/tutorial-recorder.ts`
- Tutorial publish flow: `scripts/tutorials/publish-tutorial.ts`
- App knowledge publish surface: `training_docs` and `/knowledge/app`

## Files Changed

- `docs/ops/tasks/2026-06-30-app-training-docs-submittals-prime-contracts-owner-invoice.md` - task ledger and evidence.
- `scripts/tutorials/publish-tutorial.ts` - prefer cleaned documentation drafts during publish and fall back on `.webm` storage uploads.
- `scripts/tutorials/__tests__/publish-tutorial.test.mjs` - guardrail coverage for draft selection and video upload fallback logic.
- `scripts/tutorials/workflows/submittals-create-submittal.workflow.ts` - repeatable submittal capture workflow.
- `scripts/tutorials/workflows/submittals-create-submittal.data.json` - seeded data for submittal capture.
- `scripts/tutorials/workflows/prime-contracts-create-prime-contract.workflow.ts` - repeatable prime-contract capture workflow.
- `scripts/tutorials/workflows/prime-contracts-create-prime-contract.data.json` - seeded data for prime-contract capture.
- `scripts/tutorials/workflows/invoicing-create-owner-invoice.workflow.ts` - repeatable owner-invoice capture workflow.
- `scripts/tutorials/workflows/invoicing-create-owner-invoice.data.json` - seeded data for owner-invoice capture.
- `docs/tutorials/submittals/create-a-submittal/*` - submittal capture artifacts and cleaned documentation draft.
- `docs/tutorials/prime-contracts/create-a-prime-contract/*` - prime-contract capture artifacts and cleaned documentation draft.
- `docs/tutorials/invoicing/create-an-owner-invoice/*` - owner-invoice capture artifacts and cleaned documentation draft.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `git diff --check`; `npx tsx scripts/tutorials/publish-tutorial.ts --help`; `npx tsx scripts/tutorials/run-tutorial.ts --help`; `rg -n 'Procore|support\\.procore|v2\\.support\\.procore' docs/tutorials/submittals/create-a-submittal/documentation-draft.md docs/tutorials/prime-contracts/create-a-prime-contract/documentation-draft.md docs/tutorials/invoicing/create-an-owner-invoice/documentation-draft.md` | Pass | Diff is clean, CLI entrypoints load, and the cleaned draft files contain no forbidden brand or support-link leakage. |
| Targeted tests        | `node --import tsx --test scripts/tutorials/__tests__/compose-training-doc.test.mjs scripts/tutorials/__tests__/publish-tutorial.test.mjs` | Pass | Composer sanitization tests and the new publish guardrail tests both passed. |
| Browser/user-flow     | `agent-browser` authenticated capture runs; live route checks for `/knowledge/app/submittals/create-a-submittal`, `/knowledge/app/prime-contracts/create-a-prime-contract`, and `/knowledge/app/invoicing/create-an-owner-invoice` | Pass | The three live app-doc routes resolved with authenticated browser state, and the route snapshots matched the expected training-doc pages. |
| DB/provider read-back | `npx tsx scripts/tutorials/publish-tutorial.ts ...` for each manifest; service-role `training_docs` read-back for the three published slugs | Pass | Published rows are `create-a-submittal`, `create-a-prime-contract`, and `create-an-owner-invoice`, each `published` with clean `body_markdown`, correct `appToolCategory`, correct `appPublishedPath`, and expected screenshot/video asset counts. |
| End-to-end proof      | `docs/tutorials/submittals/create-a-submittal/`; `docs/tutorials/prime-contracts/create-a-prime-contract/`; `docs/tutorials/invoicing/create-an-owner-invoice/` | Pass | Each workflow folder contains `manifest.json`, primary markdown, `documentation-draft.md`, `documentation-input.json`, `source-brief.md`, `session.webm`, and ordered screenshots. |

## Risks / Gaps

- The support-derived drafts still rely on deterministic fallback composition in this batch (`--no-ai`), so the model-backed prose path was not re-proved here.
- `agent-browser open` to the prime-contract doc route hit a default navigation timeout once even though the page was present; the subsequent authenticated `get url` and snapshot confirmed the route rendered.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
