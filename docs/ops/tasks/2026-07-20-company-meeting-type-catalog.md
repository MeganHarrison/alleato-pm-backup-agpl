# Task: Governed Company Meeting Type Catalog

Status: In Progress
Owner: Codex
Created: 2026-07-20
Task ID: AAI-1200
Linear Issue: [AAI-1200 Company Settings: establish a governed meeting-type catalog](https://linear.app/megankharrison/issue/AAI-1200/company-settings-establish-a-governed-meeting-type-catalog)
Related Handoff: Deferred while the shared orchestration board has unrelated staged/unstaged edits.

## Objective

Let app admins define, rename, reorder, and archive company meeting types through a typed catalog that can become the canonical meeting-workflow source, while preserving imported Fireflies metadata as read-only source data.

## Scope

- Create a company-owned `meeting_types` catalog with stable IDs, normalized names, ordering, archival state, and audit timestamps.
- Protect the catalog with `is_admin` RLS and matching app-admin API/page guards.
- Provide a focused Company Settings surface for the catalog with explicit archive behavior.
- Keep `document_metadata.meeting_type` out of the write path; it remains imported source metadata.

## Source of Truth

- Canonical runtime/data owner: `meeting_types` catalog and `/api/admin/meeting-types` API.
- Existing shared primitives/services: `requireAppAdmin`, `withApiGuardrails`, shared `Button`, and Company Settings registry.
- Deprecated or parallel paths: raw `document_metadata.meeting_type` is not a configuration catalog and must not be edited as one.

Verification contract: Required

## Acceptance Criteria

- [ ] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [ ] Shared abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: duplicate or blank names return a field-specific validation error; archive is blocked if a future canonical consumer reports dependencies.
- Detection path: API contract tests, remote migration-ledger verification, and authenticated browser create/archive proof.
- Recovery path: correct the name, or resolve the named dependent records before archive.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before database work. |
| Types gate | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` | Passed | Generated types include `company_meeting_types`. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260720201912_company_meeting_types_catalog.sql` | Passed | Local migration filename matches the applied remote ledger entry. |

## Remaining Risk

- A meeting-type catalog does not automatically rewrite historical Fireflies metadata. Owner: AAI-1200. Prevention: retain the imported metadata as a separate read-only source field.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
