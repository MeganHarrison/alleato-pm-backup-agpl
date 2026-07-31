# Task: Repeatable training doc skill for browser-captured workflows

Status: In Progress
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-781 - https://linear.app/megankharrison/issue/AAI-781/create-repeatable-training-doc-skill-for-browser-captured-step-by-step
Related Handoff: N/A

## Objective

Create a reusable repo-local skill that captures an Alleato workflow step by
step, saves a walkthrough video plus per-step screenshots, uses the stored
support-article corpus as source material, and emits Alleato-only markdown docs
with external-brand mentions, external links, and inapplicable source content
removed.

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

- A repo-local skill exists for repeatable step-by-step workflow capture and doc authoring.
- Tutorial capture writes `manifest.json`, markdown, per-step screenshots, and a
  single session video from one run.
- A documentation composer can query the stored support-article corpus and
  produce an Alleato-only draft without external-brand mentions or external
  documentation links.
- The generated draft explicitly removes or omits source material that does not
  apply to Alleato workflows.
- Failure states for missing auth, wrong route, missing support results, or
  source contamination fail loudly with specific next actions.

## Source Of Truth

- Capture runtime: `scripts/tutorials/tutorial-recorder.ts`
- Tutorial publish path: `scripts/tutorials/publish-tutorial.ts`
- Support corpus: `support_articles` / `search_support_articles`
- Repo-local skill entrypoint: `.codex/skills/<new-skill>/SKILL.md`

## Files Changed

- `docs/ops/tasks/2026-06-30-repeatable-training-doc-skill.md` - working definition of done and evidence.
- `scripts/tutorials/tutorial-recorder.ts` - shared tutorial capture runtime.
- `scripts/tutorials/publish-tutorial.ts` - publish captured assets back to training docs.
- `scripts/tutorials/run-tutorial.ts` - CLI entrypoint if new options are needed.
- `scripts/tutorials/compose-training-doc.mjs` - support-corpus-backed markdown draft composer.
- `scripts/tutorials/__tests__/compose-training-doc.test.mjs` - composer guardrail tests.
- `frontend/src/app/api/admin/training-docs/[docId]/publish/route.ts` - keep video assets in the shared publish path.
- `frontend/src/features/knowledge/app-training-doc-page.tsx` - render walkthrough videos in the in-app training doc surface.
- `frontend/src/lib/training-docs/constants.ts` - register `video` as a training-doc asset type.
- `frontend/src/lib/training-docs/docs-site.ts` - publish walkthrough videos alongside screenshots.
- `frontend/src/lib/training-docs/__tests__/docs-site.test.ts` - docs-site render guardrail for video assets.
- `.codex/skills/repeatable-training-docs/SKILL.md` - repeatable repo-local skill instructions.
- `.codex/skills/repeatable-training-docs/templates/training-doc-template.md` - doc structure template.
- `package.json` - convenience script entrypoint(s), if needed.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `frontend: eslint src/features/knowledge/app-training-doc-page.tsx src/app/api/admin/training-docs/[docId]/publish/route.ts src/lib/training-docs/docs-site.ts src/lib/training-docs/constants.ts`; `git diff --check`; `node scripts/tutorials/compose-training-doc.mjs --help`; `npx tsx scripts/tutorials/run-tutorial.ts --help`; `npx tsx scripts/tutorials/publish-tutorial.ts --help` | Pass | Shared frontend surfaces lint clean; CLI entrypoints load and print usage. |
| Targeted tests        | `node --test scripts/tutorials/__tests__/compose-training-doc.test.mjs`; `cd frontend && ./node_modules/.bin/jest src/lib/training-docs/__tests__/docs-site.test.ts --runInBand` | Pass | Composer sanitization tests and docs-site render tests both passed. |
| Browser/user-flow     | Fresh `tutorial:capture` run with authenticated storage state | Not run | The new recorder code path was implemented, but a fresh authenticated browser capture was not run in this session. |
| DB/provider read-back | `node scripts/tutorials/compose-training-doc.mjs docs/tutorials/commitments/create-commitment/manifest.json --query "create a commitment workflow required fields schedule of values attachment" --title "Create a Commitment" --no-ai` | Pass | Support corpus search returned 5 matches and wrote `source-brief.md`, `documentation-input.json`, and `documentation-draft.md`. |
| End-to-end proof      | Generated artifacts at `docs/tutorials/commitments/create-commitment/source-brief.md`, `documentation-draft.md`, `documentation-input.json` | Pass | The repeatable draft-generation path ran end to end from an existing manifest and produced sanitized documentation artifacts without forbidden source-brand leakage. |

## Risks / Gaps

- Existing training-doc generation and tutorial capture paths overlap. The new
  skill must unify them instead of creating a third workflow.
- The AI-backed draft path currently returned `fetch failed` in this session, so
  only the deterministic fallback composer was verified live. The sanitizer and
  failure path are in place, but the model-backed prose path still needs one
  successful run.
- The updated tutorial recorder was not re-run against a fresh authenticated
  browser session in this session, so `session.webm` capture is implemented but
  not independently re-proved here.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
