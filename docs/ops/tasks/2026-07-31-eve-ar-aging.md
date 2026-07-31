# Task: Restore Eve AR Aging

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: AAI-EVE-AR-AGING
Linear Issue: Not created; this is a bounded failure discovered during the active Eve tool verification.
Related Handoff: N/A

## Objective

Make `getARAgingReport` return live Acumatica AR aging through the Alleato Eve
assistant instead of a provider-side OData 500.

## Scope

- `frontend/src/lib/acumatica/client.ts`
- Focused AR aging provider-contract regression test
- No changes to Acumatica credentials, provider data, or unrelated accounting tools

## Source of Truth

- Canonical runtime/data owner: `AcumaticaClient.getARAging`
- Existing shared primitives/services: `AcumaticaClient.fetchEntity`
- Deprecated or parallel paths: N/A

Delivery lane: High-risk

Verification contract: Required. Completion requires a focused test, a live
Acumatica read, and an authenticated Eve browser turn with a persisted
`output-available` `getARAgingReport` trace and screenshot.

## Acceptance Criteria

- [x] `getARAgingReport` returns current live AR aging through Eve.
- [x] Failure-loudly behavior is defined.
- [x] The provider contract is localized before implementation.
- [x] No parallel AR aging path is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] The shared `AcumaticaClient.getARAging` owner is corrected.
- [x] Provider errors remain specific and actionable.
- [x] The live Acumatica Invoice field contract is respected.

## Integration and Verification

- [x] Focused regression test passes.
- [x] Direct live Acumatica readback passes.
- [x] Authenticated Eve browser proof passes.
- [x] Evidence artifacts are recorded.
- [x] Task-owned source files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: exact Acumatica entity, HTTP status, and provider response.
- Detection path: persisted Eve action output plus focused provider-contract test.
- Recovery path: correct the canonical Invoice `$select` field list and rerun the live tool.

## Incident Learning

- Failure fingerprint: `integrations.acumatica-ar-aging-field-contract-drift`
- Root cause: `getARAging` selected `CustomerName`, which is not declared by the
  live Acumatica Invoice endpoint and causes its OData binder to throw a
  `KeyNotFoundException`.
- Detection gap: no focused test locked the AR aging `$select` field contract.
- Prevention: request only fields needed for aging and assert the exact query.
- Guardrail evidence: `frontend/src/lib/acumatica/__tests__/client-aging.test.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Browser reproduction | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getARAgingReport-failed.png` | Fail reproduced | Persisted tool output contained the Acumatica OData `KeyNotFoundException`. |
| Provider field probe | Four direct `$select` variants against live Acumatica | Localized | Base and `Customer` passed; every variant containing `CustomerName` returned HTTP 500. |
| Focused regression | `jest --runInBand --runTestsByPath src/lib/acumatica/__tests__/client-aging.test.ts` | Pass | One test locks the exact live-safe Invoice field list and aging calculation. |
| Direct provider readback | `AcumaticaClient.getARAging()` from the task workspace | Pass | Live result returned 15 outstanding invoices totaling $1,034,777.16 across current, 31–60, 61–90, and 90+ day buckets. |
| Independent review | Reviewer agent `Avicenna` | Pass after correction | The reviewer required the projection to be reduced to the two consumed fields and the premature completion claim removed; both findings were addressed before publication. |
| Source publication | `codex:finish --session S20260731-ARAGING ...` | Pass | Client fix, focused test, and task record published to `origin/main` at `2eafab1e5dc19a17960544c25dec3faf7dc6bd85`. |
| Authenticated Eve retest | `http://localhost:3012/ai?session=fb842e5b-d957-439e-91cd-45a54f4db370` | Pass | Persisted `output-available` `getARAgingReport` trace returned $1,034,777.16 total AR and $1,034,615.87 overdue across 14 invoices. |
| Browser screenshot | `C:\Users\KimiClaw\AppData\Local\Temp\eve-tool-verification-20260731\getARAgingReport-passed.png` | Pass | Real user-visible assistant answer matches the persisted tool output. |

## Remaining Risk

- None for this provider field-contract failure.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No deferred work remains.
