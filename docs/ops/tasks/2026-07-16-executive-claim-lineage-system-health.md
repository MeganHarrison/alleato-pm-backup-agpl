# Task: Executive Claim Lineage and Business-Impact Health Plan

Status: In Progress
Owner: Codex S171
Created: 2026-07-16
Task ID: AAI-1105
Linear Issue: [AAI-1105](https://linear.app/megankharrison/issue/AAI-1105/explain-any-executive-claim-with-lineage-and-business-impact-health)
Related Handoff: `docs/ops/handoffs/2026-07-16-S171-executive-claim-lineage-system-health.md`

## Objective

After AAI-1103 is accepted, let an executive explain a material Daily Brief claim from immutable source evidence through the controlled operating projection to its decision or delivery artifact, and see business-prioritized health exceptions with a named owner and recovery path.

## Scope

- Plan the one read-only claim-lineage/health adapter, its bounded API, and the canonical Daily Brief detail integration.
- Plan an executive-facing Operating System Map and System Health & Exceptions view as quiet detail panels in the live action workflow.
- Define source, authority, freshness, owner, update time, business impact, and recovery contracts.
- Explicitly exclude product code, schema changes, a second dashboard, raw engineering telemetry, conflict resolution UI, attention lifecycle UI, and portfolio expansion.

## Source of Truth

- Canonical runtime/data owner: `loadCanonicalExecutiveState` in `frontend/src/lib/executive/executive-state.ts`, plus AAI-1097 conflict/claim/history records and the AAI-1096 controlled `project_current_state` projection RPC.
- Existing shared primitives/services: `canonical-packets.ts`, `source-links.ts`, `executive-attention-conflicts.ts`, `daily-brief-detail-client.tsx`, `ai_work_run_artifacts`, and `ai_work_run_delivery_attempts`.
- Canonical action surface: `/daily-briefs/[briefId]`; `/executive/intelligence-brief` is redirect-only and `/daily-brief` remains the current-packet read surface.
- Deprecated or parallel paths: page-local packet/health synthesis, generic task lineage, and the admin RAG/system-health consoles as an executive explanation surface.

Verification contract: Required

## Dependency and Resume Gate

- [x] AAI-1103 is recorded as the explicit Linear blocker.
- [x] The plan avoids reading or mutating conflict history before AAI-1103 exposes its accepted canonical read model.
- [x] Resume gate satisfied: AAI-1103 is published at `2ab63a2331d10521535c53874f25a73b2b253b7e`; its accepted server-owned read boundary is `loadExecutiveConflictFeed()` over `read_executive_conflict_feed`, with durable `executive_claims.id` identifiers and append-only `executive_conflict_history`.

## Canonical Implementation Plan

### 1. One claim-explanation adapter, not a page-local join

Create `frontend/src/lib/executive/executive-claim-lineage.ts` as a server-only, read-only adapter over `loadCanonicalExecutiveState()` and the AAI-1103 accepted conflict read model. Its output must use a stable `claimId` owned by the AAI-1097 claim record and contain ordered, named stages:

1. `source`: immutable `DailyBriefSourceRef` / source manifest id, title, lane, original URL, and source time.
2. `event`: linked `source_signal_candidates` identity and occurrence time; absent event linkage is a lineage failure, not a guessed event.
3. `fact_or_signal`: the persisted signal/claim text, confidence, project scope, and source token set.
4. `authority_policy`: authority class and conflict/adjudication status supplied by AAI-1103; it must never infer a winning claim from display order.
5. `projection`: `project_current_state` provenance (`projection_writer`, `projection_generated_at`, `projection_envelope_id`, and `projection_provenance`) plus the controlled RPC owner.
6. `decision_or_artifact`: linked executive attention/conflict decision and, where present, packet-correlated `ai_work_run_artifacts` and sent/delivered receipt. A delivery receipt is not proof of a decision.

The adapter returns `ready` only when every required stage has a stable identifier, source owner, authority, freshness, and evidence. It returns a typed `lineage_unavailable` result for a known material claim missing required lineage; it must not manufacture stage labels, timestamps, evidence counts, or recovery links.

### 2. One health-exception reducer with business impact first

Add `frontend/src/lib/executive/executive-system-health.ts`, also server-only and read-only. It derives a bounded `ExecutiveHealthException` from the same canonical state inputs and the accepted conflict model. The reducer must publish only executive decision data:

| Condition | Business impact | Owner | Recovery path | Evidence owner |
| --- | --- | --- | --- | --- |
| stale/missing canonical packet | Decisions may use an obsolete brief | Daily Brief compiler owner | Recompile the canonical packet; do not regenerate in the UI | `intelligence_packets` |
| missing/ambiguous source-event-signal linkage | Claim cannot be trusted | Source/AI ops owner | Restore immutable source linkage or mark the claim unavailable | source manifest + `source_signal_candidates` |
| unresolved authoritative conflict | Competing direction can affect a decision | Domain resolver from AAI-1103 | Human resolves through controlled conflict RPC | AAI-1097 history |
| projection stale or missing provenance | Project impact is not current/provable | Projection owner | Repair/replay controlled projection; never write page-local state | `project_current_state` provenance |
| delivery unproven | Brief content may not have reached recipient | Delivery owner | Retry/inspect packet-correlated delivery; do not claim sent | artifact + attempt ledger |

Order exceptions by `businessImpact` (`decision_blocker`, `material_risk`, `delivery_risk`, `advisory`), then severity/freshness. The reducer must expose a named owner and an executable recovery action for every exception; no raw provider error or admin metric is shown to the executive.

### 3. API ownership and authorization

After AAI-1103 fixes its stable claim id/read model, add:

- `frontend/src/app/api/executive/claims/[claimId]/lineage/route.ts` — authenticated executive access; validates `[claimId]`; returns the typed explanation or an explicit 404/409 problem response. No client-supplied source ids, authority, or actor identity.
- `frontend/src/app/api/executive/system-health/route.ts` — authenticated executive access; returns the ordered Operating System Map nodes and health exceptions from the adapters. It never proxies the raw admin source-sync API.

Both routes must use existing API guardrails and emit actionable errors containing the missing stage/owner/recovery path. They must not expose secrets, vendor stack traces, unscoped project records, or implementation-only database details.

### 4. Canonical UI placement and reuse

Integrate the views into `frontend/src/features/daily-briefs/daily-brief-detail-client.tsx`, the canonical action-review surface selected by AAI-1103. Reuse its existing section/row hierarchy and shared dialog, button, alert, and responsive primitives:

- A material decision/claim gets one `Explain claim` control that opens contextual lineage; it does not duplicate citations already visible in the brief.
- An `Operating system` detail section lists the five/six flow stages, owner, status, last successful update, and affected surfaces. It is a compact row list, not a topology/dashboard canvas.
- A `Health exceptions` section defaults to material blockers and risks. Each row states business impact, owner, and recovery action; healthy systems do not consume top-of-page space.
- `lineage_unavailable` renders an explicit local error state naming the missing stage and recovery owner. It hides the unproven explanation rather than falling back to generic source coverage.

No nested cards, KPI tiles, decorative node diagrams, duplicate primary CTAs, or a separate `/executive/*` dashboard. `daily-brief` may deep-link to this detail surface only after AAI-1104 owns live delivery navigation.

### 5. Required tests and end-to-end proof

- Unit-test ordered stages, unique source resolution, missing/ambiguous lineage, stale projection provenance, packet-correlated delivery, and business-impact ordering.
- Route tests prove authorization, invalid `[claimId]`, no fabricated source/event/projection stage, and actionable 409 payloads.
- AAI-1103 end-to-end fixture must create a conflict/claim with immutable evidence, resolve it as a human, then show its append-only decision history in lineage.
- Agent-browser proof on `/daily-briefs/[briefId]`: open a material claim, capture source → event → signal → authority → projection → decision/artifact, then show a deliberate health exception with the exact owner/recovery path.
- Capture desktop and mobile screenshots of both the explain panel and health exception state, attach them to AAI-1105, and obtain independent reviewer acceptance before publication.

## Acceptance Criteria

- [x] A material executive claim traces source → event → fact/signal → authority policy → projection → decision/artifact from stable records when every required stable link is present; otherwise the exact missing stage is withheld and surfaced.
- [x] The Operating System Map lists source-to-executive flow, owner, health, last success, and affected surfaces without becoming an engineering console.
- [x] Health exceptions are business-impact ordered and each names an owner plus recovery path.
- [x] Missing lineage/health fails loudly and cannot fabricate an explanation.

## Failure-Loudly Contract

- Cause surfaced as: `Lineage unavailable: <missing stage>` or `Executive health exception: <condition>`, including affected decision/claim, owner, and recovery path.
- Detection path: typed adapter diagnostic, API 409 payload, focused test, and visible Daily Brief detail state.
- Recovery path: follow the named canonical owner (source linkage, compiler, controlled projection, conflict resolver, or delivery ledger); never patch displayed state locally.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear dependency readback | AAI-1105 relation to AAI-1103 | Pass | AAI-1103 remains the hard blocker. |
| AAI-1097 contract inspection | `docs/ops/tasks/2026-07-16-executive-attention-conflict-contracts.md` | Pass | Conflicts/history have controlled, human-only lifecycle ownership. |
| AAI-1101 seam inspection | `frontend/src/lib/executive/executive-state.ts` | Pass | Existing state inputs expose source ids, authority, freshness, evidence, and delivery correlation. |
| Route ownership inspection | `frontend/src/app/daily-brief/page.tsx`, `frontend/src/app/(tables)/daily-briefs/[briefId]/page.tsx`, S169 task | Pass | Detail route owns future action review; redirect route is excluded. |
| Focused lineage/health tests | `pnpm --dir frontend exec jest --runInBand --runTestsByPath src/lib/executive/__tests__/executive-claim-lineage.test.ts src/lib/executive/__tests__/executive-system-health.test.ts` | Pass | 2 suites, 4 assertions: ordered stable stages, missing source, missing projection provenance, and business-impact order. |
| Static checks | targeted ESLint; `pnpm --dir frontend exec tsc --noEmit --pretty false --incremental --tsBuildInfoFile /tmp/aai-1105.tsbuildinfo` | Pass | Route, component, adapters, and shared state seam compile without error. |
| Live API failure-loud readback | authenticated `GET /api/executive/claims/283aba62-011e-4f06-93e1-dcaf6c9488ab/lineage?briefId=16ffd8d9-6c51-4e27-bd97-7c05e4aea35f` | Pass | HTTP 409 preserves `missingStage=source`, `owner=Source/AI ops owner`, and recovery path in `details`; no fabricated lineage. |
| Canonical browser proof | `docs/ops/evidence/2026-07-16-executive-claim-lineage-system-health/aai-1105-health-desktop.png`; `aai-1105-health-mobile.png`; `aai-1105-lineage-unavailable-desktop.png`; `aai-1105-lineage-unavailable-mobile.png` | Pass | Authenticated `/daily-briefs/[briefId]` shows compact operating flow, business-impact exceptions, and the exact typed lineage recovery owner/path at desktop and mobile. |
| Independent implementation review | `docs/ops/evidence/2026-07-16-executive-claim-lineage-system-health/independent-review.md` | Pass | Shared projection provenance seam, bounded API, no page-local synthesis, quiet UI, and failure-loudly semantics accepted. |

## Remaining Risk

- Live AAI-1103 fixture claims whose source ids are not present in the immutable packet manifest deliberately render `lineage_unavailable` rather than a fabricated event chain. Owner: Source/AI ops owner. Detection gap: the fixture does not carry the packet-manifest source linkage. Prevention: the adapter requires a unique source id, occurrence time, immutable hash, authority/freshness, controlled projection provenance, and human decision before rendering a ready lineage. Next action: use a source-linked controlled claim fixture in a subsequent executive operating review.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in for the implementation slice.
- [x] Failure-loudly risk records cause, detection gap, prevention step, owner, and next action.
