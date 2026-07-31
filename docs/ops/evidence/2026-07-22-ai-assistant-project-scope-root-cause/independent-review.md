# Independent Review

Decision: APPROVED
Reviewer: `ai_scope_independent_review` (independent reviewer agent)
Reviewed at: 2026-07-22T13:56:37Z
Task: AI-ASSISTANT-SCOPE-ROOT-CAUSE-0722

## Review History

The first review rejected two bypasses: construction aliases such as `this job`
could evade the literal-project guard, and a contextual follow-up could resume
unscoped retrieval. The second review rejected an overbroad sticky rule that
captured unrelated fresh questions after a scope stop.

## Final Decision

APPROVED with no remaining findings in the reviewed scope.

- Direct deictic `project`, `job`, `jobsite`, and `site` requests fail closed
  when no selected project ID is present.
- Explicit contextual continuations remain fail closed after the scope stop.
- Fresh organization/general questions reset the topic and are not hijacked by
  the prior scope stop.
- The popover regression includes a rendered Radix portal interaction test.
- The focused suite passed 109/109.

The reviewer recommended proceeding with publication and canonical production
trace verification.

## Recovery-Route Review

Decision: APPROVED
Reviewer: `ai_scope_recovery_review` (independent reviewer agent)
Reviewed at: 2026-07-22T14:26:55Z

The first production canary exposed a second boundary: after the deterministic
scope stop, selecting a project and resending a prompt containing `cite` was
misclassified as a follow-up to the empty stop. That let semantic collection
planning replace the canonical recent-meetings reader.

The reviewer approved the narrow repair: follow-up reuse is disabled only when
the latest prior assistant turn is the project-scope stop. The resend then uses
`project_context_source_specific_rag_recent_meetings`, preserves the selected
project ID, and keeps ordinary follow-ups unchanged. Both the direct planner
and semantic-classifier wrapper have behavioral regression coverage.

The same reviewer separately approved the trace-label correction after the
local canary exposed `recent_meetings` retrieval under a stale `recent-teams`
orchestrator label. The identifier now derives from the closed
`sourceSpecificKind` union, matching the response label, model ID, and actual
reader. The final focused suite passed 112/112.
