# Task: Preserve mixed-source assistant retrieval

Status: In Progress
Owner: Codex (Sroot)
Created: 2026-07-22
Task ID: AAI-1244
Linear Issue: [AAI-1244](https://linear.app/megankharrison/issue/AAI-1244/preserve-communication-source-search-for-mixed-fmds-and-process)
Related Handoff: N/A — canonical checkout writer lease `Sroot`

## Objective

When a user requests Alleato process mapping plus meeting, email, and Teams research in an FMDS/ASRS turn, the AI assistant searches those communication sources while preserving revision-scoped FMDS engineering evidence.

## Scope

- `frontend/src/lib/ai/retrieval/planner.ts` and FMDS domain classification
- `frontend/src/lib/ai/fmds-tool-policy.ts` and regression coverage
- Explicit exclusion: changing FMDS corpus data, connector configuration, or generic RAG policy

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- Existing shared primitives/services: `frontend/src/lib/ai/retrieval/planner.ts`, `frontend/src/lib/ai/fmds-tool-policy.ts`, `frontend/src/lib/ai/tools/project-tools.ts`
- Deprecated or parallel paths: N/A

Verification contract: Required

## Acceptance Criteria

- [x] Explicit mixed FMDS + meeting/email/Teams requests compile to a typed mixed-source plan.
- [x] The tool policy retains only the dedicated FMDS and explicitly requested communication-source tools.
- [x] A missing required communication tool fails loudly with its name.
- [x] Engineering conclusions remain protected from generic RAG and legacy FMDS sources.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files. (None in targeted checks.)
- [x] Task-owned files are published and local `HEAD` equals `origin/main`. (`0e75b347e99af2fccb860f707fb5aec7be06c558`)

## Failure-Loudly Contract

- Cause surfaced as: `FMDS mixed-source chat tools are unavailable: missing <tool names>.`
- Detection path: planner/tool-policy unit tests and canonical chat runtime.
- Recovery path: register the named source tool in the strategist tool factory, then rerun the policy tests.

## Incident Learning

- Failure fingerprint: `ai.collection-analysis-source-free-fallback`
- Root cause: FMDS routing encoded a whole-turn exclusivity rule even when the user asked for separate communication-source research.
- Detection gap: The test suite covered FMDS-only plans but no mixed-intent plan.
- Prevention: A typed source scope and an allow-listed mixed-source tool policy.
- Guardrail evidence: targeted planner and FMDS tool-policy tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file; Linear AAI-1244 | Pass | Scope and done gate recorded before implementation. |
| Runtime localization | User-provided chat response; `handler-v2.ts` tool-policy boundary | Pass | FMDS plan removed the communication tools. |
| Live failure-loudly proof | Local authenticated `/ai` chat | Pass | The first mixed-policy attempt named every unavailable raw source tool instead of pretending they had been searched; canonical repair is the registered Microsoft specialist seam. |
| Targeted tests and lint | `cd frontend && pnpm exec jest --runInBand --runTestsByPath src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/__tests__/fmds-tool-policy.test.ts src/lib/ai/retrieval/__tests__/system-prompt.test.ts && pnpm exec eslint ...` | Pass | 104 tests passed; ESLint passed. Expected context-budget warnings came from existing system-prompt coverage tests. |
| Authenticated user flow | `/tmp/aai-1244-mixed-source-chat.png`; Linear attachment `Mixed-source AI assistant proof` | Pass | Canonical `/ai` route rendered `Search Meetings By Topic`, `Search Emails`, `Search Teams Messages`, and `Search Fmds2026 Evidence`, then a separated process map. |

## Remaining Risk

- None.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
