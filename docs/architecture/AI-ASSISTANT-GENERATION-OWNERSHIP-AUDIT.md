# AI Assistant Generation Ownership Audit

Status: **Failed — architecture remediation required before Workflow adoption**  
Audit date: 2026-07-22  
Production route: `https://projects.alleatogroup.com/ai`  
Production code under test: `b9fd86668ed9a55f5a9f9e04752619e03c665da8`  
Tracking: AAI-1150 and AAI-1264

## Decision

Do not add Vercel Workflow to the interactive AI Assistant.

The signed AI SDK approval boundary works when execution reaches it, but the
Assistant does not have one generation owner. The production request passes
through an ordered forest of deterministic routers, direct database workflows,
delegated backend agents, retrieval fast paths, and a final `streamText`
fallback. Those paths do not share one intent contract, one mutation boundary,
one persistence contract, or one audit metadata shape.

Workflow would make these branches durable. It would not make them correct.
The current priority is deletion and ownership consolidation.

## Progress-report Workflow canary verdict

The canary now does the comparison the right way: it imports the current repo's
`generateProgressReportSections`, reads live `project_progress_reports`, and
runs that same generator once directly and once inside Workflow. It is not a
second progress-report implementation.

Current verification:

- Typecheck and five focused tests passed.
- The live adapter read 20 current progress reports.
- Exol Morrisville run `wrun_01KY5F45WF08DBRH3XC969MP4Y` completed on
  attempt 1. Its Workflow lane was about 23 seconds faster than the direct lane.
- Goodwill Noblesville run `wrun_01KY5ZW6D25Z0WR0R0KQ2V3CZ2` completed on
  attempt 1. Its Workflow lane was about 18 seconds slower than the direct lane.
- The two generated drafts differed materially even though they used the same
  generator. Each lane still queries and generates independently because the
  current generator does not expose one immutable source packet. Those content
  and timing differences are model/provider variance, not evidence that
  Workflow improved or degraded quality or performance.

Opinionated verdict: the canary technically works, but it is not better than the
current generator. It adds a durable run ID, retry boundary, step receipt, and
recoverability. It has not demonstrated an enrichment-quality or performance
benefit. Keep it as an unshipped comparison harness. Reconsider it only when
durable retry/resume is the actual progress-report failure being solved and a
fixed-packet, multi-run quality/latency/cost evaluation passes.

## Production proof

The production test used authenticated project context `Test July 2026`
(`#1142`) and queried `public.rfis` before and after each action.

| Probe | Observed production path | Result |
| --- | --- | --- |
| Exact-field request | `deterministic-rfi-preview-router` | Failed. The supplied subject and question were discarded and replaced with `RFI - Field Question` / `Please clarify field question.` |
| Cancellation | `deterministic-rfi-preview-router` | Failed. `Do not create ... Cancel it` regenerated the same preview because the matcher sees `create` + `RFI` and has no negation/cancellation state. No row was written. |
| Router-shaped approval probe | preview router, then `ai-gateway` | Authorization passed, intent fidelity failed. The displayed signed tool payload differed from the preceding preview. Approval created exactly one row; scoped cleanup deleted that exact row and verified zero remained. |
| Router-shaped denial probe | preview router, then `ai-gateway` | Passed. The signed tool call was denied and the exact subject count stayed zero. |

Production persistence proves the owner switch:

- Preview rows store `provider_decision.providerPath = deterministic-rfi-preview-router`.
- The typed `confirm` turn is replanned as `general_conversation` and sent to
  `ai-gateway`; it is not a continuation of a bound preview transaction.
- The approval auto-resume persists the same user `confirm` turn again because
  chat history inserts are not idempotent by `client_message_id`.
- The pending approval turn also persisted an `empty_model_response` assistant
  row before the approval response completed.

Artifacts:

- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/production-intent-mismatch.png`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/production-cancel-repreview.png`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/production-signed-approval-pending.png`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/production-signed-approval-completed.png`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/production-signed-denial-pending.png`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/production-signed-denial-completed.png`
- `docs/ops/tasks/2026-07-17-ai-sdk-tool-approval-hardening-proof/production-forensic-readback.json`

## Production generation inventory

`POST /api/ai-assistant/chat` and `POST /api/ask-alleato/chat` both call
`handleChatV2`. Surface capability is server-owned, but generation ownership is
split inside the 6,000+ line handler.

The order below is executable precedence, not a conceptual diagram.

| Order | Path | Trigger/owner | Output owner | Mutation or fallback behavior | Decision |
| --- | --- | --- | --- | --- | --- |
| 1 | Daily Deep Read packet | phrase matcher | deterministic handler branch | Read-only packet/candidate lookup | Retain, but register explicitly |
| 2 | Executive briefing metadata | phrase matcher | deterministic handler branch | Read-only canonical packet lookup | Retain, but register explicitly |
| 3 | RFI preview router | `create|draft|log|prepare` + `RFI` regex | handler-local parser | Replaces structured fields; ignores negation; returns before the model | Delete |
| 4 | Change-event intake | retrieval-plan intent + persisted draft metadata | deterministic handler branch | Persists preview/workspace state, then later relies on legacy `confirmed` prompts | Replace with one typed draft owner and one signed write owner |
| 5 | Generated tasks today | phrase matcher | deterministic handler branch | Direct read with a widget | Retain, but register explicitly |
| 6 | Personal task register | phrase matcher | deterministic handler branch | Direct read with a widget | Retain, but register explicitly |
| 7 | Source health | planner intent | deterministic handler branch | Direct operational read | Retain as an explicit diagnostic route |
| 8 | CMO weekly content | phrase matcher | handler directly calls marketing service | **Writes three product tables before AI SDK approval exists** | Remove direct branch immediately |
| 9 | Project-scope guard | planner response format | deterministic handler branch | Correct fail-closed boundary | Retain |
| 10 | Microsoft specialist | planner reason | Render backend agent | Backend tool catalog contains Graph draft/category mutations and an urgent Teams auto-send path outside AI SDK approval | Make delegated runtime read-only; move mutations to signed frontend tools |
| 11 | Deep Agent executive bridge | planner intent/reason | Render backend | Direct response or context injection; failure falls back to local retrieval | Retain only behind a named route contract |
| 12 | Deep Agent research bridge | planner intent/research contract | Render backend | Direct response or context injection; failure falls back to local retrieval | Retain only behind a named route contract |
| 13 | Project intelligence packet | packet eligibility | client packet fast path | Deterministic direct answer; errors fall through to local retrieval | Retain, but make fallback observable in persisted route metadata |
| 14 | Meeting collection analysis | planner response format | collection synthesizer | Separate generation call and deterministic coverage footer | Retain as a registered read route |
| 15 | Document intelligence eval | eval flags + message matcher | deterministic eval branch | Eval-only response | Exclude from production route registry unless explicitly enabled |
| 16 | Direct project briefing | planner + retrieval eligibility | deterministic formatter | Direct RAG answer | Retain as a registered read route |
| 17 | Direct semantic source lookup | planner + semantic results | separate `generateText` call | On generation error, logs server-side and silently falls through to general synthesis | Make fallback explicit or fail the route |
| 18 | Direct source-specific answer | planner + source result | deterministic formatter | Falls through when eligibility is not met | Retain with named eligibility/fallback metadata |
| 19 | General strategist | everything else | AI SDK `streamText` | Only path using the shared signed approval policy; may include MCP tools and registry tools | Retain as the sole action-capable generation owner |

## Findings

### P0 — Product writes bypass the signed approval boundary

The CMO branch calls `createWeeklyMarketingContentWorkflow` directly from the
handler. That service inserts marketing intelligence items, calendar items, and
content assets. The call occurs before `streamText`, `toolApproval`, and
`experimental_toolApprovalSecret` are constructed.

The Microsoft specialist is also invoked before `streamText`. Its backend tool
catalog always includes Outlook draft, Teams draft, and triage-write tools. The
current `render.yaml` contract sets `MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_TEAMS_ALERT=true`,
so the Teams "draft" tool can post an urgent Teams DM. Outlook draft/category
mutations are currently configured false, but the same delegated tool remains
capable of Graph draft creation if that flag changes. None of those side
effects is bound to the frontend AI SDK signature.

This means AAI-1150's original statement that every canonical write or delivery
call is signed is not currently true.

### P0 — The RFI preview and write are different transactions

The deterministic router derives only an `about ...` topic. Any other explicit
field syntax becomes `field question`. It returns a preview and discards the
structured payload as executable state.

When the user types `confirm`, the planner classifies that new turn as general
conversation. The model reconstructs another `createRFI` payload. Production
showed that the signed payload can differ from the displayed preview. The
signature correctly binds the second payload; it cannot repair the lost
relationship to the first preview.

### P1 — Cancellation is treated as creation

`shouldUseRfiPreviewRouter` is a positive keyword regex. It has no cancellation,
negation, pending-draft, or finite-state contract. A message saying not to
create the RFI still matches and produces another preview.

This should not be repaired with a larger regex. The matcher is the wrong owner.

### P1 — Approval auto-resume corrupts chat history

The general stream path inserts the last user turn on every HTTP request. AI SDK
approval auto-resume replays message history, so the same `confirm` content is
inserted again. The writer has no uniqueness/idempotency contract for
`client_message_id`.

The `onFinish` persistence path also converts a pending tool-only response into
an "empty response" assistant row. That error row is not the state shown by the
approval UI and makes production traces look like a provider failure.

### P1 — Fallbacks change owners without one durable route record

Deep Agent failures fall back to local retrieval. Packet failures fall back to
local retrieval. Direct semantic synthesis failures fall through to the general
strategist. Some branches persist `provider_path`; others persist
`provider_decision.providerPath`; several read branches persist neither.

The user can receive a plausible response while the intended owner failed. The
UI may show a transient warning, but the durable history does not expose one
uniform selected route, attempted route, fallback reason, and final route.

### P1 — The architecture verifier certifies only part of the boundary

The current verifier scans frontend AI tool modules, known legacy paths, and a
specific direct change-event token. It does not reject direct service writes in
the chat handler and does not scan delegated backend tool catalogs for delivery
side effects. It therefore passed while the CMO and Microsoft bypasses remained.

## Deletion and consolidation plan

No step below introduces Workflow.

### 1. Close the mutation perimeter

1. Remove the direct CMO branch from `handler-v2.ts`.
2. Split marketing work into a pure `prepareWeeklyMarketingContentPlan` read and
   one transactional `persistWeeklyMarketingContentPlan` write tool.
3. Register the persist tool as a write and require the existing signed AI SDK
   approval.
4. Remove mutation-capable tools from the Microsoft delegated agent. It may
   return a typed proposal only. Outlook/Teams/category mutations must execute
   through registered frontend tools after signed approval.
5. Add a static gate that rejects product-table writes or external delivery
   calls reachable before the shared approval policy.

### 2. Delete the legacy RFI preview loop

1. Delete `shouldUseRfiPreviewRouter`, `extractRfiTopic`,
   `resolveRfiPreviewProject`, `buildRfiPreviewContent`, and the early RFI branch.
2. Delete client prompts that submit `confirmed=true` text instructions.
3. Stop treating the `confirmed` boolean as authorization. Authorization is the
   signed AI SDK approval response.
4. If a business preview is still useful, give it a separate read-only tool
   (`prepareRFI`) whose typed output becomes the immutable input to `createRFI`.
   Do not ask the model to recreate the payload after approval.
5. Preserve SOV preview tokens as concurrency/staleness controls, not as a
   second authorization system.

### 3. Replace the handler if-forest with an executable route registry

Each route definition must declare:

- stable `routeId` and version;
- matcher and precedence;
- allowed surfaces;
- read, internal-state, product-write, or external-delivery effect;
- response owner;
- allowed fallback route IDs;
- required persisted audit fields.

Selection must yield exactly one route. Ambiguous matches fail loudly. Action
routes may only select the general signed-tool executor.

Every assistant history row must persist:

```text
requested_route
selected_route
selected_route_version
fallback_route
fallback_reason
provider_path
model
approval_state
client_message_id
```

### 4. Repair the turn-state contract

1. Make user-turn persistence idempotent by session, role, and
   `client_message_id`.
2. Do not persist the empty-response fallback for an approval-pending finish.
3. Persist approval-request, approved, denied, executed, and failed as explicit
   states tied to one tool call ID and one immutable payload hash.
4. Ensure cancel clears the pending action and cannot match a creation route.

### 5. Add falsifiable production-shaped tests

Required regression cases:

1. Exact subject and question in the prompt equal the approval payload and the
   inserted row byte-for-byte.
2. One user approval produces one intended write; no typed `confirm` roundtrip.
3. Deny and cancel produce zero writes.
4. Approval auto-resume does not duplicate user or assistant history rows.
5. A direct service call from the handler to a product write fails the static
   architecture gate.
6. Delegated backend tool catalogs containing mutation/delivery tools fail the
   static architecture gate.
7. Every route and fallback produces the same audit metadata schema.

## What remains intentionally retained

- Server-owned `alleato_ai` versus read-only `ask_alleato` surfaces.
- Registry-derived signed AI SDK approvals and the required shared secret.
- Project scope fail-closed behavior.
- Read-only deterministic packet/health/task routes, once they are explicit
  registry entries with uniform audit metadata.
- Retrieval and Deep Agent paths, once owner changes and fallbacks are durable
  and visible.

## Workflow decision gate

Workflow may be reconsidered only for long-running, retryable background work
after the mutation perimeter and route registry are complete. Progress-report
enrichment is a reasonable future canary because it is durable batch work with
reviewable outputs. Interactive chat routing and tool approval are not Workflow
problems and must remain outside it.
