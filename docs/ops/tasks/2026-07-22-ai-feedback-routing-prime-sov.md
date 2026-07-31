# Task: Repair AI Feedback Routing and Add Prime Contract SOV Editing

Status: Complete
Owner: Codex SROOT431A
Created: 2026-07-22
Task ID: LOCAL-AI-SOV-2026-07-22
Linear Issue: Unavailable - the enabled tools expose no callable Linear issue create/update connector (only a Notion search description that mentions Linear as a possible connected source).
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT431A-ai-feedback-routing-prime-sov.md`

## Objective

Make Alleato AI correctly route feature-gap confirmations to the existing feedback workflow and safely preview/confirm additions or updates to an existing draft Prime Contract SOV.

## Scope

- Own feedback-write intent classification and retrieval planning for explicit bug/feature-gap requests.
- Own the AI action tool contract for adding/updating existing draft Prime Contract SOV rows.
- Reuse existing project access, `contracts:write`, signed-in Supabase, approval, audit, and idempotency primitives.
- Exclude deletion of SOV rows, changes to approved/executed contracts, and automatic code repair from a chat feedback submission.

## Source of Truth

- Canonical runtime/data owner: Alleato AI v2 chat handler, AI intent/planner layers, and `contract_line_items` under the governed Prime Contract boundary.
- Existing shared primitives/services: `frontend/src/lib/ai/intent-router.ts`, `frontend/src/lib/ai/retrieval/planner.ts`, `frontend/src/lib/ai/tools/write/prime-contract-tools.ts`, `frontend/src/lib/ai/tools/write/write-audit.ts`, `frontend/src/lib/permissions.ts`.
- Deprecated or parallel paths: Direct project briefing is not permitted to own feedback-write confirmations; REST SOV routes remain the manual-UI owner and are not replaced.

Verification contract: Required

## Acceptance Criteria

- [x] Exact user wording such as "Yes please log it as a feature that is missed and have it fixed" routes to feedback submission instead of a project briefing.
- [x] Alleato AI exposes an `editPrimeContractSov` action for existing draft Prime Contracts across the chat, not only on a contract page.
- [x] The action resolves rows to active project budget codes, rejects missing/ambiguous/duplicate codes, and updates or appends rows without deleting omitted rows.
- [x] Every mutation requires project access, `contracts:write`, a preview, explicit confirmation, idempotency, and an audit record.
- [x] Non-draft contracts and unsupported destructive edits fail loudly with actionable messages.
- [x] The live authenticated chat demonstrates feedback preview routing and Prime SOV edit preview after deployment.

## Implementation Checklist

- [x] Files/modules to change are listed before edits: intent router/tests, retrieval planner/tests, Prime Contract tool/schema/registry/descriptors/strategist/catalog/tests, task/handoff/testing/incident evidence.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit user-facing denial for missing project/contract access, missing `contracts:write`, non-draft status, ambiguous codes, invalid amounts, or audit/write failure.
- Detection path: targeted Jest tests, type/lint checks, authenticated production chat preview, and persisted write-audit assertions.
- Recovery path: correct the permission, select a draft contract, disambiguate the budget code/type, or retry the identical confirmed operation using the same idempotency key.

## Incident Learning

- Failure fingerprint: `ai.feedback-write-project-briefing-collision`
- Root cause: Phrase-oriented routing treated the word "missed" in a feedback confirmation as a task follow-up, then the packet-first planner returned a deterministic project briefing before the action model could call `submitFeedback`.
- Detection gap: No regression test combined confirmation wording, prior assistant context, and a selected project.
- Prevention: Give explicit feedback-write requests a higher-priority typed intent and a conversational action-tool plan; keep an exact transcript-derived regression test.
- Guardrail evidence: Six focused intent/planner/approval/tool/migration/permission suites pass 266 tests. The exact transcript wording, production `Preview changing...` wording, read-only SOV questions, and singular/plural change-order boundaries are retained as regressions. Authenticated feedback routing and the final SOV preview both pass in production.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before product implementation. |
| Running-system localization | Production response matched `buildDirectProjectBriefingContent`; live request returned HTTP 200 | Pass | Failure is intent/planner selection, not endpoint reachability. |
| Existing issue lookup | GitHub issue search for the SOV feature | Pass | No issue was created by the chat response. |
| Recurring-failure lookup | `node scripts/ops/learning-registry.mjs lookup ...` | Pass | No existing fingerprint owns this feedback-routing collision. |
| Focused regression suite | `npm.cmd run test:unit -- --runInBand ...` | Pass | 6 suites / 266 tests, including feedback routing, production preview wording, read-only/change-order boundaries, preview binding, stale-state, authorization, precision, atomic RPC, and approval behavior. |
| Static/type boundary | changed-file ESLint; bounded TypeScript check; `node scripts/check-no-new-any.mjs`; `git diff --check` | Pass | No task-owned lint/type/new-any/diff findings. |
| Live database contract preflight | Linked Supabase `information_schema.columns` readback | Pass | Confirmed live `contract_line_items` text/UUID identifiers, numeric(15,4)/(15,2) precision, privacy fields, status, and timestamps match the migration contract. |
| Architecture freshness | `npm.cmd run map:project -- --check-only`; `npm.cmd run map:system -- --check-only` | Pass | Project and system maps are current after shared-main updates. |
| Authenticated feedback flow | `feedback-routing-preview.png`; `browser-readback.md` | Pass | Exact feedback wording ran the feature-request workflow and did not return the project briefing. |
| Authenticated SOV preview | `prime-contract-sov-preview.png`; `browser-readback.md` | Pass | Production commit `23188d0b7787bd02b2a84a8a94d9cd10491d5156`, a descendant of hotfix `8cb8cc71994fd59b7acf9ceff0f716ea6355d795`, routed the exact gerund wording to `Edit Prime Contract Sov`, returned the $5,000 to $5,100 preview, and required separate confirmation. |

## Remaining Risk

- Confirmed SOV writes affect contract financial data; production verification stopped at preview, while confirmed mutation behavior is proved with deterministic automated tests. The visible 01-3120 / Labor row remained $5,000 after verification.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
