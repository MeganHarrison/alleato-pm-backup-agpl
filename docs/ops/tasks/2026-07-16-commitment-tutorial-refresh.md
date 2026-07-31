# Task: Refresh and Publish the Create a Commitment Tutorial

Status: In Progress
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1138
Linear Issue: [AAI-1138](https://linear.app/megankharrison/issue/AAI-1138/refresh-and-publish-the-create-a-commitment-tutorial)
Related Handoff: `docs/ops/handoffs/2026-07-16-S176-commitment-tutorial-refresh.md`

## Objective

Publish one canonical, screenshot-backed client guide that explains and proves creating a subcontract commitment in Alleato.

## Scope

- Refresh the existing `commitments.create-commitment` workflow using the shared tutorial recorder and explicit interaction checkpoints.
- Produce the complete capture/source/draft artifact packet and publish the reviewed guide in the canonical `alleato-os` docs site.
- Do not change product policy, repair unrelated docs navigation, or build the optional Remotion renderer.

## Source of Truth

- Canonical runtime/data owner: `/[projectId]/commitments/new?type=subcontract` and the existing Playwright tutorial recorder.
- Existing shared primitives/services: `scripts/tutorials/tutorial-recorder.ts`, `scripts/tutorials/compose-training-doc.mjs`, `scripts/tutorials/promote-to-alleato-docs-site.mjs`.
- Deprecated or parallel paths: the old seven-step generated commitment packet and draft docs page; they are inputs, not the final owner.

Verification contract: Required

## Acceptance Criteria

- [ ] The capture fails loudly on missing required controls, route mismatch, incorrect selected values, failed save, or missing artifact.
- [ ] The artifact packet contains a manifest, Markdown, video, per-step screenshots, source brief, structured input, and documentation draft.
- [ ] The canonical docs page explains commitment lifecycle, type selection, SOV, access, and downstream invoicing/change-management context without unsupported product claims.
- [ ] The live docs page and legacy route behavior have browser evidence.

## Implementation Checklist

- [ ] Existing workflow/data/docs owners identified before edits.
- [ ] Shared recorder helpers own cross-cutting interaction and checkpoint behavior.
- [ ] Required interactions are semantic and error messages identify the failed checkpoint.
- [ ] Authentication, seeded data, persistence, and cleanup contracts are verified.

## Integration and Verification

- [ ] Focused recorder/workflow checks pass.
- [ ] Authenticated user-flow capture reaches and proves the saved Commitment result.
- [ ] Documentation source retrieval and sanitization pass.
- [ ] Docs screenshot/navigation checks are recorded; unrelated failures name exact owner paths.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main` in each affected repository.

## Failure-Loudly Contract

- Cause surfaced as: missing required form control, invalid route, wrong selection, failed persistence, missing video/screenshot, or stale production documentation.
- Detection path: recorder assertion, captured manifest, docs checks, and browser production assertion.
- Recovery path: correct the workflow selector or data precondition, regenerate the packet, and rerun the exact docs-site check.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: Existing Commitment capture tolerates required-action failures and only captures broad viewport states.
- Detection gap: Existing artifacts do not prove selected values or final persistence.
- Prevention: Adopt the shared semantic assertion/checkpoint contract used by the Prime Contract capture.
- Guardrail evidence: focused recorder checks, authenticated saved-result capture, and a live docs screenshot.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1138 | Pass | Scope and required release gates recorded before implementation. |

## Remaining Risk

- Existing local docs navigation debt may prevent a repository-wide nav check; it must be reported separately and cannot substitute for page-level evidence.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
