# Task: Align RFI assignment layout and details hierarchy

Status: In Progress
Owner: Codex S165
Created: 2026-07-16
Task ID: AAI-1128
Linear Issue: AAI-1128 https://linear.app/megankharrison/issue/AAI-1128/align-rfi-assignment-layout-and-details-hierarchy
Related Handoff: `docs/ops/handoffs/2026-07-16-S165-rfi-assignment-layout.md`

## Objective

Make the canonical RFI creation form use one clear Assignment section, a visible Details section, and an unobstructed persistent action row.

## Scope

- Canonical RFI field owner: `frontend/src/components/rfis/rfi-form-fields.tsx`.
- Shared persistent action owner: `frontend/src/components/forms/FormActions.tsx`.
- Canonical route and focused tests: `/[projectId]/rfis/new`.
- Excludes RFI API/schema changes.

## Source of Truth

- Canonical runtime/data owner: `RfiFormFields` and `/[projectId]/rfis/new`.
- Existing shared primitives/services: `FormGrid`, `FormSection`, RHF fields, and `FormActions`.
- Deprecated or parallel paths: `additionalDetailsMode` disclosure is removed; no page-local replacement is allowed.

Verification contract: Required

## Acceptance Criteria

- [ ] Distribution List matches Responsible Contractor width and shares its row on desktop.
- [ ] The duplicate RFI Details heading and additional-details disclosure are absent.
- [ ] Assignment is the only assignment heading and Details labels the remaining metadata.
- [ ] Sticky form actions have no top border.
- [ ] Existing RFI create, edit, and drawing-pin field ownership is preserved.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [ ] Shared field/action abstractions own the behavior.
- [ ] Focused regression guardrails cover the layout contract.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual browser proof on `/1142/rfis/new` passes at desktop and mobile widths.
- [ ] Evidence artifacts are recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: layout assertions fail when a duplicate disclosure, mismatched grid span, or sticky-border class returns.
- Detection path: focused source tests plus canonical browser screenshots.
- Recovery path: restore the shared FormGrid placement or FormActions surface treatment, then rerun the focused checks.

## Incident Learning

- Failure fingerprint: `process.passive-incident-memory`
- Root cause: the prior progressive-disclosure implementation was visually inconsistent with the approved RFI form layout.
- Detection gap: the first browser proof captured a generic Tier 2 pattern rather than the approved Assignment/Details hierarchy.
- Prevention: focused source assertions now guard section naming, disclosure removal, and two-column assignment layout.
- Guardrail evidence: RFI form field unit test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1128 | Pass | Scope and closeout criteria recorded before implementation. |

## Remaining Risk

- Production deployment proof follows publication.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
