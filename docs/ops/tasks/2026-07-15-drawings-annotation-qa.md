# Drawings annotation and linked-item QA

Status: In Progress
Owner: Codex
Created: 2026-07-15
Task ID: QA-2026-07-15-drawings-annotation
Linear Issue: No Linear issue-creation tool is exposed in this session; `mcp__codex_apps__linear_search` and issue-list tools were available, but no create-issue operation was available.
Related Handoff: `docs/ops/handoffs/2026-07-15-S-drawings-annotation-qa.md`

## Objective

Verify the canonical project drawing viewer and its annotation/link workflow end to end, including linking existing RFIs, documents, photos, submittals, punch list items, drawings, coordination issues, and tasks, plus creating each supported linked item successfully.

## Scope

- Canonical route: `/[projectId]/drawings/viewer/[drawingId]`, including markup tools, annotation persistence, links panel, and related-item creation/linking flows.
- Implementation scope: repair confirmed coordination-issue/task record-link gaps in the shared modal, then rerun the affected browser/database proof. Mobile layout remains a separate finding.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx`.
- Existing shared owners: `frontend/src/components/drawings/`, `frontend/src/hooks/use-drawing-annotations.ts`, `frontend/src/services/drawings/`, and the feature-specific create/link routes discovered during QA.
- Deprecated or parallel paths: `viewer-v2` and `viewer-v3` are not the acceptance route.

Verification contract: Required

## Acceptance Criteria

- [ ] Canonical drawing viewer loads with a real project/drawing and exposes annotation controls.
- [ ] Core annotation tools create, save, reload, and edit/delete without silent failure.
- [ ] Existing records can be linked from an annotation for RFI, document, photo, submittal, punch list item, drawing, coordination issue, and task where the UI advertises support.
- [ ] New records can be created from each advertised annotation-link flow and are persisted/readable after reload. (RFI, punch item, photo, coordination issue, and task proven; submittal/drawing have no create-new flow.)
- [ ] Validation, unavailable-data, permission, and failed-save states are specific and actionable.
- [ ] Desktop, tablet, and mobile layouts remain usable without clipped controls or overflow. (Desktop/mobile rerun passes; independent visual review remains.)
- [ ] Evidence is independently reviewed; unsupported claims are marked FAIL or INCONCLUSIVE.

## Implementation Checklist

- [x] Files/modules to inspect are listed before browser verification.
- [x] Shared canonical drawing viewer and link owners are identified.
- [x] Confirmed coordination issue/task UI-to-record boundary and repaired it through canonical APIs.
- [x] Repair the localized mobile side-panel layout so the drawing remains usable while links are open.
- [x] Every remaining failure includes first failing layer, likely owner file(s), detection gap, prevention step, and next action.

## Integration and Verification

- [ ] Targeted static or unit checks pass where useful.
- [x] Actual user-flow/browser proof covers existing-link and create-new paths for all currently advertised types; Submittal/Drawing existing selectors rechecked with live records.
- [ ] Evidence artifacts are recorded under `tests/agent-browser-runs/2026-07-15-drawings-annotation-qa/`.
- [x] Database/API readback verifies persisted annotation and linked-record fields, including coordination issue #10 and two task IDs.
- [ ] Reload/edit-prefill proof is captured.
- [ ] Negative-path proof is captured.
- [ ] Independent functional, visual, and evidence-judge review is complete.
- [ ] Known unrelated failures name exact command and owner files.
- [ ] Task-owned evidence is published and local `HEAD` equals `origin/main` if closeout is attempted.

## Failure-Loudly Contract

- Cause surfaced as: exact UI error/toast/validation state or failed network/API response with record context.
- Detection path: browser action log, screenshot/video, network/runtime evidence, and DB/API readback.
- Recovery path: the user can retry, correct the named field, or follow the specific unavailable dependency; otherwise create a follow-up implementation task.

## Incident Learning

- Failure fingerprint: `frontend.viewer-capability-regression` (existing registry match)
- Root cause: The canonical viewer exposes coordination/task draft-pin substitutes instead of canonical record creation, while the cross-type link contract has no deterministic fixture/availability precondition for Submittals and Drawings.
- Detection gap: Existing unit tests cover markup mechanics but do not assert every advertised linked-record type, entity-id persistence, or mobile canvas/panel usability.
- Prevention: Keep the existing viewer capability browser contract active, add type-by-type browser/database assertions, and fail the verifier when a created coordination/task pin has a null entity ID.
- Guardrail evidence: `tests/agent-browser-runs/2026-07-15-drawings-annotation-qa/negative-path.txt`, `database-readback.json`, and `visual-review.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and acceptance criteria captured before browser pass. |
| Verification manifest | `scripts/verification/fixtures/drawings-annotation-qa-manifest.json` | Pass | Created before browser verification. |
| Browser functional QA | `tests/agent-browser-runs/2026-07-15-drawings-annotation-qa/action-log.txt` | Inconclusive | RFI, document, photo, punch, coordination draft pin, and task draft pin exercised; Submittal/Drawing selectors empty. |
| Persistence readback | `tests/agent-browser-runs/2026-07-15-drawings-annotation-qa/database-readback.json` | Pass with findings | Seven pins persisted; coordination/task entity IDs are null by design. |
| Responsive visual review | `tests/agent-browser-runs/2026-07-15-drawings-annotation-qa/visual-review.md` | Inconclusive | Desktop/tablet usable; mobile links panel dominates viewport. |
| Responsive layout rerun | `tests/agent-browser-runs/2026-07-15-drawings-annotation-qa/visual-mobile-after-overlay.png` | Pass | Mobile panel overlays instead of shrinking the viewer row; 390px viewport has no horizontal overflow and 334px canvas width remains visible. |
| Focused regression suite | `tests/agent-browser-runs/2026-07-15-drawings-annotation-qa/regression-test.txt` | Pass | 5 suites, 21 tests. |
| Contract validation | `npm run verify:contract -- --manifest scripts/verification/fixtures/drawings-annotation-qa-manifest.json --result scripts/verification/fixtures/drawings-annotation-qa-result.json --root .` | Pass (recorded INCONCLUSIVE) | Contract accepts non-PASS recording; publishable PASS is not supported. |

## Remaining Risk

- Resolved: Coordination Issue and Task now create/link real records and persist entity IDs. Owner: Codex implementation. Evidence: live API readback and `coordination-task-records-linked.png`.
- Low: Existing Submittal and Drawing selectors initially appeared empty but populated after query settlement on recheck; no create-new flow is advertised for either type, so create-new coverage is not applicable to the current UI contract.
- Resolved pending independent review: Mobile Links panel now overlays the canvas at small widths and preserves a usable drawing surface. Evidence: `visual-mobile-after-overlay.png` and `visual-desktop-after-overlay.png`.
- Medium: Mobile links panel leaves little visible drawing area. Owner: frontend. Next action: add a responsive sheet/drawer contract.
- Process: Independent sub-agent verifier was unavailable. Owner: next QA run. Next action: repeat the evidence review with an independent verifier before closeout.

## Final Status

- [ ] All required checklist items are complete — INCONCLUSIVE; product findings remain.
- [x] Evidence is filled in for the completed browser slices.
- [x] Incident learning is linked to `frontend.viewer-capability-regression`.
- [x] Deferred work has cause, detection gap, prevention step, owner, and next action.
