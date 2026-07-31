# Task: AI Content-Creation Catalog

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: AI-CONTENT-CREATION-CATALOG
Linear Issue: Not requested
Related Handoff: N/A — single-session task

## Objective

Make the existing `procore_features` catalog an honest inventory of every native content-creation workflow the AI can currently create or help create, including a visible implementation status and the assistant preview-to-approval flow.

## Scope

- `procore_features` schema and idempotent catalog seed data.
- Implemented and unavailable native content-creation flows.
- Screenshot reference and inspectable assistant workflow metadata.
- Explicit exclusion: building missing AI tools or publishing mock screenshots.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/ai/tool-registry.ts` and `frontend/src/lib/ai/tools/write/`.
- Existing shared primitives/services: preview-first action tools and `ai_tool_write_audits`.
- Deprecated or parallel paths: `ai_agents` is an agent runtime registry and is not the feature catalog.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Every currently registered native content-creation tool has a `procore_features` entry.
- [x] Native creation screens without a registered AI write tool are explicitly marked `not_implemented`.
- [x] Every implemented entry documents prompt, preview, explicit approval, execution, and audit stages.
- [x] The catalog has a dedicated `ai_chat_screenshot_url` column; no mock is supplied for unavailable flows.
- [x] Migration is applied and its remote ledger entry is verified.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared catalog table owns cross-cutting behavior.
- [x] Unavailable actions are explicit rather than silently inferred.
- [x] Database contract is applied remotely and types are regenerated.

## Integration and Verification

- [x] Targeted migration verification passes.
- [x] The current type inventory confirms `procore_features` is live and the existing status/screenshot fields are present.
- [x] Remote readback proves seeded rows and screenshot URLs.
- [x] Browser capture was attempted against local and production assistant surfaces; the production hostname was unreachable and local port 3000 did not accept the browser connection, so no fabricated screenshot was added.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a first apply attempt rejected unsupported `complexity='high'` values; the live constraint accepts `trivial`, `easy`, `medium`, `hard`, or `very_hard`.
- Detection path: Supabase Management API returned `procore_features_complexity_check` before the transaction committed.
- Recovery path: use the allowed vocabulary, rerun the atomic migration, then verify the remote feature counts and ledger.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: The catalog used a human-facing priority word (`high`) for a constrained implementation-complexity field.
- Detection gap: The local generated types do not expose database check values, and the initial static validation did not query the live constraint.
- Prevention: The seed now uses the live vocabulary and the static validation rejects unsupported values before remote execution.
- Guardrail evidence: the live constraint was read before the corrected retry; the atomic transaction prevented partial catalog rows.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Tool inventory | `frontend/src/lib/ai/tool-registry.ts` and `frontend/src/lib/ai/tools/write/` | Pass | Catalog covers registered record-creation tools and marks unregistered native creators unavailable. |
| Database type gate | `npm run db:types` | Pass | Generated Supabase types successfully after authenticated access was supplied. The worktree also contains unrelated generator churn, so only the migration/task files are owned by this task. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260724194500_catalog_ai_content_creation_features.sql` | Pass | Remote ledger confirms version `20260724194500`. |
| Remote catalog readback | Supabase Management API query | Pass | 12 implemented, 7 not implemented, 12 implemented rows with screenshot/workflow metadata, both new columns present. |
| Browser screenshot | `npx agent-browser ... open` | Blocked | Production domain was unreachable; local port 3000 did not accept browser traffic. Existing current assistant entry screenshot is referenced only for implemented actions. |

## Remaining Risk

- The existing screenshot reference shows the current assistant entry surface, not an end-to-end screenshot for each individual action; capture current live flows after authenticated browser access is restored.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Deferred work includes cause, detection gap, prevention step, owner, and next action.
