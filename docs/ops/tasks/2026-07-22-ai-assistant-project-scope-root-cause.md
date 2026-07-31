# Task: Stop AI Assistant Project-Scope Broadening

Status: Complete
Owner: Codex SROOT-AI-ASSISTANT-SCOPE-0722
Created: 2026-07-22
Task ID: AI-ASSISTANT-SCOPE-ROOT-CAUSE-0722
Linear Issue: Unavailable: no Linear connector is exposed in this session.
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-ai-assistant-project-scope-root-cause.md`

## Objective

A request about the selected project must either execute with the exact project
ID shown in the assistant composer or stop immediately with an actionable scope
message; it must never broaden to organization-wide evidence.

## Scope

- Global assistant project-picker interaction and accessible selected state.
- Retrieval-planner preflight, deterministic fail-loud response, trace metadata,
  and focused regression coverage.
- Recovery routing after the user selects a project and resends the stopped
  question.
- Production Langfuse trace and authenticated browser proof.
- Excludes rewriting the chat-turn research contract already published under
  AAI-1248 and changing meeting collection completeness policy.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
  plus `frontend/src/lib/ai/retrieval/planner.ts`.
- Existing shared primitives/services: shared `PopoverContent`,
  `DefaultChatTransport`, `ChatHistoryWriter`, and Langfuse chat tracing.
- Deprecated or parallel paths: N/A; LangSmith credentials are not operational
  in the current environment, while production tracing is owned by Langfuse.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The project picker accepts pointer selection inside the global widget.
- [x] The selected project name is observable in accessible composer state.
- [x] Project-relative wording with no `selectedProjectId` stops before every
  source reader and says why.
- [x] The same wording with a selected project preserves that exact ID through
  request, plan, retrieval, persistence, and trace.
- [x] Explicit Teams/email research still uses the existing typed research
  contract and cannot be replaced by meeting-only collection analysis.
- [x] Failure-loud behavior is visible in the UI and Langfuse.
- [x] The first resend after selecting a project uses the canonical scoped
  source-specific reader instead of following up to the scope-stop message.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared popover-layer ownership replaces per-control z-index overrides.
- [x] The planner, not an individual source reader, owns unresolved scope.
- [x] Errors are specific and actionable.
- [x] No schema, provider credential, or permission change is required.

## Integration and Verification

- [x] Focused planner, handler, and overlay tests pass (112/112).
- [x] Existing mixed-source routing guard remains green.
- [x] Authenticated production browser flow proves project selection and answer.
- [x] Langfuse readback proves exact `selectedProjectId` and bounded source scope.
- [x] Independent review approves the root-cause boundary and regression tests.
- [x] Task-owned files are published to `origin/main`; production commit
  `7cdcc7eb750967e64b6d750fe4aadad6b2e2abba` is a verified descendant of the
  task commits. The canonical checkout intentionally remains divergent because
  concurrent sessions used exact-file publication without rebasing shared work.

## Failure-Loudly Contract

- Cause surfaced as: `selected_project_context_missing` with
  `projectContextRequired` trace output and an actionable composer instruction.
- Detection path: planner contract test, handler-order contract, browser
  interaction, persisted chat metadata, and Langfuse trace readback.
- Recovery path: select the intended project in the folder control and resend;
  no organization-wide retrieval is attempted in the failed turn.

## Incident Learning

- Failure fingerprint: `ai.project-context-silent-broadening`
- Root cause: the planner treated missing project context as organization scope,
  while the widget panel sat above its portaled project picker and intercepted
  option clicks.
- Detection gap: transport wiring tests did not exercise the real pointer and
  trace boundary, and quality scoring did not validate requested scope.
- Prevention: planner preflight plus inherited overlay-layer ownership and
  production trace verification.
- Guardrail evidence: focused tests and production artifacts pending.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production reproduction | `/tmp/ai-assistant-after-0722.png` | Failed as expected | Widget remained searching while project context was null. |
| Langfuse trace | `e71341bf-935b-46c5-91f9-2c4a028d4d31` | Failed as expected | `selectedProjectId=null`; 1,938 meetings enumerated; 104,479 ms collection analysis; unrelated projects cited. |
| Controlled trace | `2157f75e-3dc7-4e99-8bb0-92d787d11990` | Failed as expected | Picker interaction did not change trace scope; `selectedProjectId=null`. |
| Picker interaction | agent-browser production click | Failed as expected | Widget panel intercepted the visible project option. |
| LangSmith credential readback | CLI/API authentication | Blocked | Local configured key returns 403; Vercel `LANGSMITH_API_KEY` is empty. Production observability is Langfuse. |
| Focused regression | 4 Jest suites | Pass | 112/112; includes job/site aliases, sticky follow-ups, scope-stop recovery, truthful trace ownership, fresh-topic resets, and rendered portal interaction. |
| Mixed-source guard | 2 Jest suites | Pass | 11/11; explicit meetings/email/Teams source contract remains authoritative. |
| Targeted lint | `pnpm exec eslint ...` | Pass | No findings in task-owned TypeScript/TSX paths. |
| Changed-code type guard | `npm run typecheck:changed` | Pass | No new `any` debt. |
| Full frontend typecheck | `npm run typecheck` | Known unrelated debt | 385 existing error lines; no task-owned AI scope path appears. |
| Local missing-scope trace | `ab9a5db4-8aaf-4dd4-9fd8-3f42079fa549` | Pass | Zero sources; deterministic stop. |
| Local scoped trace | `e2fe746c-ee05-4600-9ee5-180174727268` | Pass | Project 1102; 0 authorized meetings; 228 ms; no substitution. |
| Local alias/follow-up traces | `f6087d33-0204-4bc1-bc02-30f17305140c`; `44692bce-9783-4284-9b9f-02927a586ce8` | Pass | `this job` and contextual follow-up both remain fail-closed. |
| Local responsive browser | evidence directory | Pass | Desktop result plus mobile picker and selected-state screenshots. |
| Production deployment | `dpl_FTWo5Wrv4T1SC1ejYjaehknpCviC` | Pass | Ready production deployment at commit `3536892248f108059a1a8d05aefcbd22e3fbaf8d`; canonical alias confirmed. |
| Production missing-scope trace | `2fae94df-3475-4416-87e4-2f33435cfc84` | Pass | Release `353689224`; null project context; zero retrieval sources; deterministic stop. |
| Production selected-scope trace | `c27d3650-674c-4c83-85cc-4f416117f949` | Partial, detected recovery bug | Exact project 1097 and one meeting enumerated, but `cite` incorrectly reused the scope stop and semantic selection rejected the row. |
| Local recovered resend trace | `ca19e248-766c-42b9-9583-031b03a8003a` | Pass | Exact project 1097; canonical recent-meetings reader returned the Park Collective source and grounded insights. |
| Final production deployment | `dpl_CsK12d5x55sBmx57X2JTHMNwQDE8` | Pass | Ready production deployment at commit `7cdcc7eb750967e64b6d750fe4aadad6b2e2abba`; canonical alias confirmed. |
| Final production missing-scope trace | `40046286-2ce4-4c0f-b3f7-d9b7f35e1fb3` | Pass | Null project context; project-scope preflight; zero retrieval readers. |
| Final production recovered trace | `4b205201-c972-4d8b-b0c2-47ecd054ed57` | Pass | Project 1097; `recent_meetings`; Park Collective source and grounded insights; zero tool failures; truthful orchestrator label. |
| Final production responsive browser | evidence directory | Pass | Desktop stop/source/insight proof and mobile picker/selected-state proof. |
| Independent review | `independent-review.md` | Pass after rework | Reviewer rejected alias bypasses and follow-up overcapture; final decision APPROVED. |
| Verification contract | manifest and result JSON | Pass | Claims bind browser, trace, negative-path, regression, and independent-review evidence. |

## Remaining Risk

- LangSmith dual-vendor tracing remains unavailable: the configured local key
  returns HTTP 403 and Vercel's `LANGSMITH_API_KEY` is empty. This is not a
  runtime observability gap because the product's canonical trace owner is
  Langfuse and both final production turns were read back there. If dual-write
  tracing is desired, the platform-observability owner must provision a valid
  LangSmith credential and verify a canary trace.
- Full frontend typecheck still contains 385 pre-existing unrelated error
  lines; no task-owned AI scope path appears in that output.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
