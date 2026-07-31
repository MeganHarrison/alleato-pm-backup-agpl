# Task: Update Application Title

Status: In Progress
Owner: Codex
Created: 2026-07-21
Task ID: Local application-title correction
Linear Issue: Not applicable — micro-scope metadata correction; no Linear connector is available in this session.
Related Handoff: N/A

## Objective

Make the canonical application browser title read `Alleato Project Management`.

## Scope

- `frontend/src/lib/app-metadata.ts`, the shared default Next.js metadata title.
- Excludes the internal npm package name and historical documentation references to `alleato-procore`.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/layout.tsx` imports `DEFAULT_APP_METADATA_TITLE`.
- Existing shared primitive: `frontend/src/lib/app-metadata.ts`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [ ] The deployed canonical page title is `Alleato Project Management`.
- [x] The shared metadata constant owns the title; no page-local override is added.
- [x] Internal package identity is explicitly out of scope.

## Implementation Checklist

- [x] Update the shared title constant.
- [x] Keep the change to the existing metadata abstraction.

## Integration and Verification

- [x] `git diff --check -- frontend/src/lib/app-metadata.ts` passes.
- [ ] Browser readback and screenshot prove the deployed title.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the browser tab title differs from the requested product name.
- Detection path: inspect the live document title with `agent-browser get title`.
- Recovery path: correct `DEFAULT_APP_METADATA_TITLE`, publish, then recheck the canonical URL.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: `frontend/src/lib/app-metadata.ts` centralizes the application title.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Source trace | `frontend/src/app/layout.tsx` | Pass | Root metadata imports the shared constant. |
| Pre-publish static check | `git diff --check -- frontend/src/lib/app-metadata.ts` | Pass | No whitespace errors. |
| Production title | Pending | Pending | Captured after deployment. |

## Remaining Risk

- Deployment propagation may take a short time; verify before closeout.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
