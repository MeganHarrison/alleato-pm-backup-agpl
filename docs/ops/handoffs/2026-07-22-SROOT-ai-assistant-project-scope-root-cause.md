# Handoff: AI Assistant Project-Scope Root Cause

Status: Complete
Session: SROOT-AI-ASSISTANT-SCOPE-0722
Task: AI-ASSISTANT-SCOPE-ROOT-CAUSE-0722

## Intake Block

1) Session ID: SROOT-AI-ASSISTANT-SCOPE-0722
2) Task ID: AI-ASSISTANT-SCOPE-ROOT-CAUSE-0722
3) Linear issue: unavailable; no Linear connector is exposed
4) Linear URL: N/A
5) Current status: complete and verified on the canonical production alias
6) Files changed: exact task, handoff, learning, overlay, planner, handler, and focused test paths held by the writer lease
7) Commands run and outcome: 112/112 focused scope/overlay/recovery/trace tests pass; 11/11 mixed-source tests pass; targeted lint and changed-code type guard pass; full typecheck has unrelated debt only
8) Evidence artifacts: `docs/ops/evidence/2026-07-22-ai-assistant-project-scope-root-cause/`; production failure trace `e71341bf-935b-46c5-91f9-2c4a028d4d31`; live scope-stop trace `40046286-2ce4-4c0f-b3f7-d9b7f35e1fb3`; live recovered trace `4b205201-c972-4d8b-b0c2-47ecd054ed57`; final deployment `dpl_CsK12d5x55sBmx57X2JTHMNwQDE8`
9) Top findings: project context arrived as null; the picker portal was pointer-blocked; missing scope silently expanded meeting retrieval to 1,938 organization records; the first resend after selection treated `cite` as a follow-up to the scope stop and bypassed the canonical recent-meetings reader
10) Recommended next action: keep a trace canary for deictic project requests and alert if a null project ID reaches an organization-wide reader
11) Handoff file path: this file
12) Migration ledger evidence: Not applicable; no database migration is in scope.

Independent review: APPROVED after two rework rounds; artifact at
`docs/ops/evidence/2026-07-22-ai-assistant-project-scope-root-cause/independent-review.md`.
Verification contract: PASS; manifest/result are in the same evidence directory.

## Root Cause Evidence

- The production request carried `selectedProjectId=null`.
- The resulting collection enumerated 1,938 meetings and spent 104,479 ms in
  collection analysis before citing unrelated projects.
- A controlled project-picker click timed out because the fixed widget panel at
  z-index 2147483003 intercepted the Radix popover portal at z-50.
- The current `main` already preserves explicit Teams/email research through the
  typed chat-turn research contract; this task does not replace that owner.
- Independent review rejected literal-project-only and broad sticky-follow-up
  attempts. The corrected contract covers project/job/jobsite/site, preserves
  contextual follow-ups, and allows fresh organization/general topic resets.
- The first production canary caught a recovery-only route defect: the word
  `cite` made the resend follow up to the deterministic scope-stop response.
  The planner now treats that first resend as a fresh scoped request and routes
  it to `source_specific_rag` for recent meetings.
- The repaired local trace exposed a stale hard-coded `recent-teams`
  orchestrator label on the recent-meetings fast path. It now derives from the
  typed reader kind so future trace diagnosis cannot confuse the two readers.

## Verification Contract

- Planner: unresolved selected-project language returns
  `project_scope_required` with zero sources.
- Handler: the deterministic response persists and renders before
  `executeRetrievalPlan` can run.
- UI: the shared popover primitive inherits the global widget overlay layer and
  the selected project name is exposed in the button label.
- Production: a project selection is clickable, the request and Langfuse trace
  carry the exact project ID, and citations remain inside that project.

## Release Evidence

- Production deployment: `dpl_CsK12d5x55sBmx57X2JTHMNwQDE8`
- Production commit: `7cdcc7eb750967e64b6d750fe4aadad6b2e2abba`
- Canonical alias: `https://projects.alleatogroup.com`
- Missing-scope trace: `40046286-2ce4-4c0f-b3f7-d9b7f35e1fb3`
- Recovered selected-scope trace: `4b205201-c972-4d8b-b0c2-47ecd054ed57`
- Migration ledger evidence: not applicable.

## Remaining External Observability Note

LangSmith is not configured operationally: the local credential returns 403
and the Vercel variable is empty. Langfuse is the canonical product trace path
and has complete final readback. A future dual-write setup belongs to platform
observability and requires a valid LangSmith credential plus canary trace.
