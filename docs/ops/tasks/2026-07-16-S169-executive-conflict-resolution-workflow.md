# Task: Human Executive Conflict Resolution Workflow

Status: Done
Owner: Codex S169
Created: 2026-07-16
Task ID: AAI-1103
Linear Issue: [AAI-1103](https://linear.app/megankharrison/issue/AAI-1103/resolve-an-authoritative-conflict-without-losing-history)
Related Handoff: `docs/ops/handoffs/2026-07-16-S169-executive-conflict-resolution-workflow.md`

## Objective

On the canonical Daily Brief route, let a named human inspect incompatible evidence-backed claims and record a superseding operational resolution without deleting any competing claim or allowing an AI actor to choose the result.

## Scope

- Canonical conflict surface: the immutable Daily Brief detail route, `/daily-briefs/[briefId]`. The current-brief attention workspace remains `/daily-brief`; conflict resolution consumes that published attention boundary without duplicating it.
- Reuse: `loadCanonicalExecutiveState` for authority and freshness context; `executive-attention-conflicts.ts` controlled RPC client; existing shared layout, form, dialog, button, and alert primitives.
- Explicitly excluded: creating attention items or changing their lifecycle. AAI-1102 owns the now-published `/daily-brief` attention workflow and remains its sole owner.
- Explicitly excluded: a second executive dashboard, a page-local data owner, AI auto-resolution, or mutation of historical claims.

## Source of Truth

- Canonical runtime/data owner: `public.executive_claim_conflicts`, `public.executive_conflict_claims`, and append-only `public.executive_conflict_resolution_history` through `resolve_executive_claim_conflict`.
- Existing shared primitives/services: `frontend/src/lib/executive/executive-attention-conflicts.ts`; `frontend/src/lib/executive/executive-state.ts`; `frontend/src/features/daily-briefs/daily-brief-detail-client.tsx`.
- Deprecated or parallel paths: the redirect-only `/executive/intelligence-brief` route. Do not add a resolver there.

Verification contract: Required

## Acceptance Criteria

- [x] Conflicting claims show authority, freshness, evidence, impact, resolver, and due date together.
- [x] Domain-appropriate ownership routes finance, schedule/operations, project, and executive-priority conflicts correctly.
- [x] AI cannot choose a winner or close the conflict; a named human creates an auditable superseding resolution.
- [x] A real conflict is created, resolved, and traced on the canonical executive route.

## Implementation Checklist

- [x] Canonical route and controlled APIs identified before implementation.
- [x] AAI-1102 is published; its attention creation seam will be consumed rather than duplicated.
- [x] Read model/API exposes open conflict, claims, attention context, ownership routing, and immutable history.
- [x] Daily Brief detail integrates a quiet conflict list and human-only inline resolution form using shared primitives.
- [x] Resolver identity derives from authenticated human context, never client-selected actor kind.
- [x] Resolution invokes only `resolve_executive_claim_conflict`, then refreshes the canonical read model.
- [x] Finance, schedule/operations, project, and executive-priority routing is covered by tests.
- [x] AI/system mutation attempts fail loudly and resolution history remains append-only.

## Integration and Verification

- [x] Targeted unit/API checks pass.
- [x] A browser creates and resolves a real conflict from `/daily-briefs/[briefId]`.
- [x] Desktop and mobile screenshots are attached to the AAI-1103 Linear comment.
- [x] Independent reviewer accepts the final diff.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a specific controlled-RPC, authorization, malformed-evidence, or closed-conflict error.
- Detection path: visible inline error with retry guidance, mutation API test, and append-only history readback.
- Recovery path: correct the named human resolution or evidence/ownership data; never overwrite the prior claims/history.

## Incident Learning

- Failure fingerprint: the first read/resolve migration assumed conflict claim metadata was JSON-only, while the existing contract stores immutable source lineage in dedicated columns.
- Root cause: the migration was composed from the attention-evidence shape without inspecting the exact conflict row contract first.
- Detection gap: generated types were refreshed, but the conflict table/function schema was not explicitly read before the first SQL attempt.
- Prevention: inspect the exact generated table/function contract before migration SQL; retain `source_id`, `source_type`, `source_hash`, and source excerpt as immutable columns; route all mutation through service-only RPCs.
- Guardrail evidence: `supabase/migrations/20260716193701_add_executive_conflict_read_and_resolve_boundary.sql`, `supabase/migrations/20260716194648_restrict_executive_conflict_creation.sql`, and `frontend/src/app/api/executive/conflicts/[conflictId]/__tests__/route.test.ts`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Dependency readback | Linear AAI-1103 and published `0315aca4c` | Pass | AAI-1102 published the controlled attention API/read boundary. |
| Route/API discovery | `rg` readback | Pass | `/daily-briefs/[briefId]`, canonical state seam, and controlled conflict RPC client identified. |
| Targeted tests | `docs/ops/evidence/2026-07-16-executive-conflict-resolution-workflow/checks.md` | Pass | 3 suites / 9 tests; lint and incremental TypeScript pass. |
| Migration ledger | `npm run db:migrations:verify-applied -- …193701 …194648` | Pass | Both remote migration versions are present. |
| Live DB read-back | `docs/ops/evidence/2026-07-16-executive-conflict-resolution-workflow/remote-readback.md` | Pass | Real conflict is resolved with two source-backed claims and immutable created/resolved history. |
| Browser / visual proof | `aai-1103-open-desktop.png`, `aai-1103-resolved-desktop.png`, `aai-1103-resolved-mobile.png` | Pass | Canonical detail route proved at desktop/mobile; noise gate passed. |
| Independent review | `docs/ops/evidence/2026-07-16-executive-conflict-resolution-workflow/independent-review.md` | Pass | P0 direct-RPC bypass and history visibility concerns were corrected before approval. |
| Verification contract | `node scripts/verification/verification-contract.mjs --manifest … --result … --task-id AAI-1103 --require-pass` | Pass | PASS is supported by the declared evidence. |

## Remaining Risk

- No remaining implementation task. Commit `2ab63a2331d10521535c53874f25a73b2b253b7e` is published to `origin/main` and verified equal before this final status update.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in for the implementation slice.
- [x] Incident learning records cause, detection gap, prevention, and guardrail evidence.
- [x] No deferred implementation work remains.
