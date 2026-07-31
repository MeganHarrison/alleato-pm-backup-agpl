# Task: Repair Eve Acumatica Project Budget Contract

Status: Verified Locally — Publication Blocked
Owner: Codex
Created: 2026-07-31
Task ID: AAI-EVE-ACUMATICA-BUDGET
Linear Issue: Active Eve tool verification audit; no separate issue created.
Related Handoff: Active AI Tools Verification coordinator task.

## Objective

Make `getAcumaticaProjectBudget` execute through the governed Eve bridge with its documented Acumatica project code while retaining strict selected-project enforcement for numeric Alleato project IDs.

## Scope

- Acumatica tool schema, adapter, focused registry and bridge tests, and real Eve browser proof.
- Excludes provider credentials and budget calculation changes.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/ai/tool-schemas/acumatica-schemas.ts`
- Existing shared primitives/services: `frontend/src/lib/ai/tools/acumatica.ts`, `frontend/src/app/api/ai-assistant/eve/tools/route.ts`
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `getAcumaticaProjectBudget` accepts `acumaticaProjectId: "26119"` through the signed Eve bridge.
- [x] Numeric Alleato `projectId` payloads remain bound to the selected project.
- [x] The real assistant returns a completed budget result and persists an exact `output-available` tool trace.
- [x] A current screenshot proves the user-visible result.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared schemas own the external identifier name.
- [x] Errors remain specific and actionable.
- [x] Provider and authorization contracts are handled explicitly.

## Integration and Verification

- [x] Focused schema, adapter, and route tests pass.
- [x] Actual Eve browser flow and persisted trace prove the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Independent review is complete.
- [ ] Task-owned files are published.

## Failure-Loudly Contract

- Cause surfaced as: schema validation rejects the obsolete `projectId` payload, while numeric internal project IDs remain governed by the existing bridge check.
- Detection path: focused schema and route regression tests plus the persisted Eve tool-part state.
- Recovery path: callers use the catalog-advertised `acumaticaProjectId`; internal tools continue using numeric `projectId`.

## Incident Learning

- Failure fingerprint: `ai.external-project-id-field-collision`
- Root cause: One external ERP code reused the reserved `projectId` field name used by the bridge for selected Alleato project authorization.
- Detection gap: Tests covered numeric mismatch but not an external provider identifier using the same field name.
- Prevention: Name external identifiers by their provider boundary and regression-test both schema and signed bridge execution.
- Guardrail evidence: Three focused suites / 20 tests passed, followed by a real Eve `output-available` trace and screenshot.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime reproduction | `getAcumaticaProjectBudget` with `projectId: "26119"` | Failed as expected | Persisted `output-error` exposed the field-name collision. |
| User-visible reproduction | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getAcumaticaProjectBudget-failed.png` | Captured | Real assistant failure before product edits. |
| Layer localization | Signed Eve request to governed bridge validation | Confirmed | The bridge rejected the string before provider execution. |
| Focused regression | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/tool-schemas/__tests__/acumatica-project-budget-schema.test.ts src/lib/ai/tools/__tests__/acumatica-project-budget.test.ts src/app/api/ai-assistant/eve/tools/__tests__/route.test.ts` | Passed | 3 suites and 20 tests; advertised schema, obsolete payload rejection, numeric guard, and complete adapter mapping are covered. |
| Real Eve answer | `http://localhost:3012/ai?session=43e4a4bf-e172-42cc-93b3-71b0b285da6a` | Passed | Live Acumatica totals returned for project code 26119. |
| Persisted trace | `/api/ai-assistant/messages/43e4a4bf-e172-42cc-93b3-71b0b285da6a?surface=alleato_ai` | Passed | `toolName=getAcumaticaProjectBudget`, `state=output-available`, exact renamed input, totals, and 22/20 line counts. |
| Browser screenshot | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getAcumaticaProjectBudget-passed.png` | Passed | Current user-visible result after the final adapter fix. |
| Independent review | Reviewer re-review after guardrail fixes | Passed | No remaining code, auth, provider-contract, or numeric project guard regression. |
| Broad registry suite | `src/lib/ai/__tests__/tool-registry.test.ts` | Unrelated existing failure | The pre-existing `getRecentEmailsInputSchema` default expectation is stale; this fix has a separate focused schema suite. |

## Remaining Risk

- Publication is blocked because local `main` and `origin/main` have independently diverged by thousands of commits, and `origin/main` does not contain the governed Eve route tree. Publishing only the route test would create a broken partial runtime. The verified local files must be included in the planned atomic Eve-runtime reconciliation.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred publication names the cause, detection gap, prevention step, owner, and next action.
