# Task: Live Executive Delivery Views

Status: Done — published to `origin/main` at `44ea7c735`
Owner: Codex S170
Created: 2026-07-16
Task ID: AAI-1104
Linear Issue: [AAI-1104](https://linear.app/megankharrison/issue/AAI-1104/make-the-daily-and-weekly-executive-views-read-the-live-action-state)
Related Handoff: `docs/ops/handoffs/2026-07-16-S170-live-executive-delivery-views.md`

## Objective

Make the canonical Daily Executive Brief and the new Weekly Operating Review governed, versioned views of the same live executive action state. Each artifact must show the current attention/conflict state and preserve the exact state, source coverage, freshness decision, and delivery evidence that applied when its immutable version was issued.

## Scope

- Reuse `loadCanonicalExecutiveState` as the only packet/project/financial/schedule/delivery read composition seam.
- Reuse the AAI-1102 attention read boundary and AAI-1103 conflict read boundary; neither artifact route may query `executive_attention_*` or `executive_conflict_*` tables directly.
- Adapt the canonical `/daily-brief` route and its existing `ExecutiveBriefView` / `buildExecutiveBriefViewModel` pipeline; preserve packet history at `/daily-briefs/[briefId]`.
- Add one Weekly Operating Review artifact route and version/readback API only after the shared delivery adapter exists. There is no existing weekly executive review route to copy.
- Reuse the existing AI Ops ledger (`ai_work_runs`, `ai_work_run_artifacts`, `ai_work_run_delivery_attempts`) for delivery receipt and recipient proof; do not create a second delivery ledger.
- Add an immutable, versioned artifact snapshot contract which links each issued daily/weekly version to canonical packet id, canonical executive state snapshot, attention/conflict version references, source/freshness assessment, and AI Ops artifact/delivery ids.
- Explicitly render a limited/blocked artifact when a required source is missing or stale; no fallback prose may imply a healthy or complete view.

## Non-Goals and Ownership Boundaries

- AAI-1102 owns creation, triage, assignment, escalation, and resolution UI for attention records, including its `/api/executive/attention` boundary and `/daily-brief` workflow component. AAI-1104 consumes its exported read model only.
- AAI-1103 owns conflict list/read/resolve workflow and immutable resolution history. AAI-1104 consumes its exported read model only.
- AAI-1101 remains the owner of canonical packet/project/financial/schedule/delivery composition. AAI-1104 may extend it only through a reviewed adapter interface; it must not recreate those reads on a route.
- AAI-1097 remains the owner of controlled executive-domain writes and authorization. AAI-1104 must not write directly to its tables.
- Monthly review, portfolio roll-up, role restrictions, and normalized-event ownership are not in this slice.

## Canonical Owners and Required Reuse

| Need | Canonical owner to reuse | AAI-1104 adapter responsibility |
| --- | --- | --- |
| Daily packet/history | `frontend/src/lib/daily-briefs/canonical-packets.ts` | Pin a version to the exact packet id; retain existing history and packet detail behavior. |
| Current executive state | `frontend/src/lib/executive/executive-state.ts#loadCanonicalExecutiveState` | Read only through the seam; surface its diagnostics and integrity failure verbatim. |
| Daily page layout | `frontend/src/app/daily-brief/page.tsx`, `ExecutiveBriefView`, `buildExecutiveBriefViewModel` | Insert a single live-action summary adapter; do not fork the Daily Brief layout or card families. |
| Attention lifecycle/read model | AAI-1102 `/api/executive/attention` read boundary | Consume an explicit version/freshness/evidence-aware response, not raw Supabase rows. |
| Conflict lifecycle/read model | AAI-1103 exported read boundary | Consume competing claims, resolver/deadline, resolution history, and current operational meaning through one adapter. |
| Delivery proof | `frontend/src/lib/ai-ops/executive-daily-brief-ledger.ts`, `frontend/src/lib/ai-ops/ledger.ts` | Link immutable artifact versions to existing work-run artifacts and delivery attempts. |
| Daily Teams delivery | `frontend/src/lib/daily-briefs/canonical-teams-delivery.ts` and `/api/executive/daily-brief/send-teams` | Extend the shared governed artifact adapter; do not add another sender. |

## Dependency Decision

**Blocked until AAI-1102 and AAI-1103 publish their read contracts.** AAI-1102 has selected `/daily-brief` for the attention workflow, while AAI-1103 initially identified `/daily-briefs/[briefId]` for conflict action. Before implementation, their owners must publish one route decision and a shared server-side read-model contract that both locations can consume. The only acceptable outcomes are:

1. `/daily-brief` is the live current-state Center and `/daily-briefs/[briefId]` is historical immutable detail; or
2. a single documented compatibility redirect/read adapter makes the two paths one canonical surface.

AAI-1104 must not solve the disagreement with duplicate widgets or route-local queries. The implementation start gate is an accepted AAI-1102/AAI-1103 handoff that names the same read contract and route roles.

## Acceptance Criteria

- [ ] A newly assigned, resolved, or conflicted item appears consistently in the live Center and the appropriate daily/weekly artifact.
- [ ] Daily/weekly artifacts preserve source coverage, freshness, delivery status, and immutable version history.
- [ ] Missing/stale critical sources create a clearly limited or blocked artifact rather than a plausible substitute.
- [ ] Canonical artifact readback and delivery evidence are verified end to end.

## Implementation Checklist

- [x] Existing route, state, packet, and delivery owners inspected before implementation.
- [x] Route/read-model dependency decision documented before code.
- [x] Claim the implementation session only after AAI-1102/AAI-1103 accepted handoffs resolve the dependency decision.
- [x] Define a shared `governed-executive-artifact` server adapter with stable daily/weekly artifact snapshot schemas, not page-local composition.
- [x] Add a migration only if existing `intelligence_packets` plus `ai_work_run_*` cannot persist immutable artifact-to-live-state references. Generate Supabase types before database code; apply and ledger-verify any migration.
- [x] Adapt `/daily-brief` through the shared adapter and preserve `/daily-briefs/[briefId]` as pinned history.
- [x] Add the first Weekly Operating Review route through the shared adapter; do not copy the Daily generator.
- [x] Link every published version to source coverage/freshness, attention/conflict state references, packet id, artifact id, and delivery attempts.
- [x] Reject/mark limited delivery when required sources or current-state integrity are stale/missing; include actionable recovery guidance.
- [x] Add focused adapter, route, readback, and regression tests for daily/weekly consistency, immutable history, delivery linkage, and blocked/limited behavior.

## Integration and Verification Plan

- [x] Run focused unit tests for the governed artifact adapter and both route view models.
- [x] Run a controlled real record flow: create/assign attention (AAI-1102), create/resolve conflict (AAI-1103), then capture daily and weekly artifact readbacks referencing the same ids.
- [x] Run a stale/missing-critical-source fixture and verify that both routes render limited/blocked state, not substitute content.
- [x] Run a delivery dry-run using the existing AI Ops ledger and prove `packet/state snapshot -> ai_work_run_artifact -> ai_work_run_delivery_attempt` linkage.
- [x] Browser-prove authenticated canonical daily and weekly routes at desktop and mobile, attach viewable screenshots to AAI-1104, and independently review visual fidelity.
- [x] Record an independent sub-agent review, verification contract result, Linear handoff comment, and scoped publish/readback.

## Failure-Loudly Contract

- Cause surfaced as: `Executive artifact integrity failure` naming absent/stale required input, conflicting state version, or unlinked delivery receipt.
- Detection path: shared adapter integrity test, route readback, immutable-version verification, and delivery-ledger readback.
- Recovery path: restore the named canonical source or action read contract, issue a new governed version, and retain the failed/limited attempt in the existing ledger.

## Deferred Status

- Cause: AAI-1104 is explicitly blocked by AAI-1103; the required attention/conflict read contract and canonical route role are still under active implementation in AAI-1102/AAI-1103.
- Detection gap: Existing `/daily-brief` is packet-only and its historical detail route does not yet share a governed live-action adapter; there is no Weekly Operating Review route.
- Prevention: Require the shared read-contract/route decision as the implementation start gate and test daily/weekly against the same record ids.
- Owner: AAI-1102 and AAI-1103 owners for the contract decision; AAI-1104 owner for delivery adapter and artifacts after acceptance.
- Next action: Re-open this task immediately after both dependency handoffs are accepted and jointly name the read model/route contract.

## Evidence

| Check | Artifact | Result | Notes |
| --- | --- | --- | --- |
| Route ownership audit | This task and S170 handoff | Pass | `/daily-brief` is canonical current daily packet view; `/executive/intelligence-brief` is redirect-only; no weekly executive route exists. |
| State seam audit | `frontend/src/lib/executive/executive-state.ts` | Pass | Existing adapter composes canonical packet/project/financial/schedule/delivery and deliberately defers attention/conflicts. |
| Delivery ledger audit | `executive-daily-brief-ledger.ts`, `canonical-teams-delivery.ts` | Pass | Existing AI Ops artifact and delivery-attempt ledger is the only delivery owner to extend. |
| Dependency audit | AAI-1102 / AAI-1103 live Linear issues | Blocked | AAI-1103 blocks AAI-1104; route/read model decision must be accepted first. |
| Migration ledger | `20260716201026_create_executive_artifact_versions.sql` | Pass | Applied through Supabase API; local/remote ledger verification passed. |
| Shared snapshot readback | `public.executive_artifact_versions` | Pass | Daily and weekly rows use packet `16ffd8d9-6c51-4e27-bd97-7c05e4aea35f`; each snapshots 3 attention records and 1 conflict. |
| Delivery dry-run | AI Ops run `ad6976ff-2f09-4962-b6b0-2d6a47c6b4ee` | Pass | Existing Teams delivery path created artifact `16828196-7a61-429d-86d1-d2c9b017dc15` with governed version metadata and two dry-run attempt receipts. |
| Browser proof | `docs/ops/evidence/2026-07-16-live-executive-delivery-views/` | Pass | Authenticated daily/weekly desktop and mobile captures reviewed; open action and version evidence are visible without extra dashboards. |
| Snapshot churn regression | focused Jest + authenticated repeated read | Pass | Delivery-only and financial read-time changes retain the same hash; two concurrent authenticated daily artifact GETs both returned version `d6b7cabb-52e3-4680-af84-792ae723a8b8`. |
| Canonical ledger relation | AI Ops run `d2c5068e-64d3-46e0-80c9-fa810ae22e85` | Pass | Teams payload artifact `9a3dcb88-228e-4392-9d1e-d9ea4ef39bcb` records `storage_table='intelligence_packets'`, exact packet `storage_id`, and two dry-run receipts. |
| Publish readback | `origin/main` | Pass | Commit `44ea7c735c5a08d2d490158fc1d43f9fa3abf1c1` pushed; local `HEAD` equals `origin/main`. |
