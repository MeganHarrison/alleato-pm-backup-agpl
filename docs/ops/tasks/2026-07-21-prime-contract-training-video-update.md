# Task: Expand Prime Contract Training Video

Status: Complete - Published
Owner: Codex
Created: 2026-07-21
Task ID: AAI-783 follow-up
Linear Issue: [AAI-783](https://linear.app/megankharrison/issue/AAI-783/create-app-training-docs-for-submittals-prime-contracts-and-owner)
Related Handoff: N/A - single-session update

## Objective

Regenerate the existing Create a Prime Contract training video so it demonstrates the owner-company and invoice-contact readiness check, contract header, contract dates, estimate-based Schedule of Values import, detailed inclusions/exclusions, and final review.

## Scope

- Update the existing declarative Prime Contract training-video flow and only the shared recorder capabilities required by that flow.
- Produce and visually inspect a new MP4 from the real Alleato PM user flow.
- Reuse the existing AAI-783 training-video/tutorial ownership and the repository's training-video skill.
- Do not change Prime Contract product policy, production contract data, or owner-invoice application behavior.
- Do not create a permanent demo contact or contract; the video remains a non-submitting walkthrough.

## Source of Truth

- Canonical video owner: `.claude/skills/training-video/flows/create-prime-contract.json`
- Existing shared recorder: `.claude/skills/training-video/lib/record.mjs`
- Canonical Prime Contract form: `frontend/src/components/domain/contracts/ContractForm.tsx`
- Canonical company/contact readiness surface: `frontend/src/app/(main)/[projectId]/directory/page.tsx`
- Canonical estimate import: `frontend/src/components/domain/contracts/prime-contract-form/sov.tsx`
- Existing reference tutorial: `scripts/tutorials/workflows/prime-contracts-create-prime-contract.workflow.ts`
- Deprecated or parallel paths: the bare-footage flow is a secondary editing asset and must remain behaviorally aligned if retained.

Verification contract: Required

## Acceptance Criteria

- [x] The video shows how to verify the owner's business profile and the contact used for owner invoicing.
- [x] The video shows contract number/title, Owner/Client, status, description, retainage, and contract dates.
- [x] The video shows importing the Schedule of Values from an approved estimate/proposal workbook and reviewing the imported rows and total.
- [x] The video shows detailed inclusions and exclusions before final review.
- [x] Every required recorded interaction fails the render when its selector, date, upload, or expected result is unavailable.
- [x] Viewable screenshots and an MP4 from the same revision are retained as evidence.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared recorder owns cross-cutting date/upload/assertion behavior.
- [x] Declarative Prime Contract flow owns video-specific sequence and copy.
- [x] Errors are specific and actionable; no required step is silently skipped.
- [x] Database, provider, authentication, permission, or delivery contracts are handled where applicable.

## Integration and Verification

- [x] JSON/static checks and focused recorder tests pass.
- [x] The requested UI coverage is captured from the real production-backed flow; the final composite provenance is disclosed in Evidence.
- [x] The MP4 is visually reviewed for readable captions, correct screens, and clean pacing.
- [x] Evidence artifacts are recorded below.
- [x] Known unrelated failures name the exact command and owner files.
- [x] The public Alleato Docs page and editable workflow source are published, with live page, video, and remote commit verification recorded below.

## Failure-Loudly Contract

- Cause surfaced as: missing owner company/contact control, unavailable date, failed workbook preview/import, missing scope field, or output/transcode failure.
- Detection path: recorder exception with the failing step plus MP4 screenshot/duration inspection.
- Recovery path: correct the seeded project/selector/input artifact, rerun the same declarative flow, and do not retain a partial video as final output.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: the previous short video ended before several contract-readiness and billing-critical setup steps.
- Detection gap: the video flow had no coverage assertion for dates, estimate import, detailed scope, or owner contact readiness.
- Prevention: required flow steps fail loudly and the finished MP4 is inspected against the acceptance checklist.
- Guardrail evidence: focused recorder checks plus the rendered evidence screenshot and MP4.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Linear ownership | AAI-783 existing issue | Partial | Existing issue reused; no callable Linear connector is available in this session for a kickoff comment. |
| Focused tests | `npm.cmd test` in `.claude/skills/training-video` | Pass | 4 tests passed; required actions, strict real dates, upload assets, expected-text assertions, and safe output basenames are covered. |
| Static checks | `node --check` plus JSON parse and `git diff --check` | Pass | Recorder modules and both Prime Contract flows parse cleanly. |
| Credential pattern scan | `rg` across current training-video source, excluding dependencies/evidence | Pass | No current-source occurrence of the removed legacy email/password patterns. |
| Live owner preflight | Production company `4951133e-8d6d-4764-aae0-e3ccd081ccdf` | Pass | Company file and Create New contact fields verified without saving a contact. |
| Live SOV preflight | `prime-contract-chat-valid-estimate.xlsx` | Pass | Two mapped rows previewed; selected total was `$4,000.25`. |
| Production-backed capture | Owner/contact/header/date footage plus previously verified SOV/scope footage | Pass | The final pass reached confirmed contract dates before the saved API session expired. The clean, already verified SOV/scope tail from the prior render was reused; no production record was submitted. |
| Deliverable MP4 | `outputs/Prime_Contract_Setup_Training_Slower_With_ElevenLabs_Voiceover.mp4` | Pass | H.264/AAC, 1920x1210, 30 fps, 146.434 seconds, 16,714,212 bytes; ElevenLabs narration and the slower training pace are present. |
| Visual proof | `docs/ops/evidence/2026-07-21-prime-contract-training-video-update/Prime_Contract_Proof_01_Owner_Entity.png` through `Prime_Contract_Proof_06_Detailed_Scope.png` | Pass | Owner facts, invoice contact, dates, SOV preview/import, `$4,000.25` total, and detailed scope are readable and retained with the source. |
| Integrity | SHA-256 | Pass | `86512387E3C889C990D97D21503023714B81016E6B6A11FC935FE7123E10AE8F`. |
| Public documentation | `https://docs.alleatogroup.com/prime-contracts/create-a-prime-contract` | Pass | Public route returned HTTP 200 and includes owner entity, invoice contact, contract dates, estimate/proposal SOV, detailed scope, and execution/access guidance. |
| Published video integrity | `docs/ops/evidence/2026-07-21-prime-contract-training-video-update/live-publication-verification.md` | Pass | HTTP 200, `video/mp4`, 16,714,212 bytes, and the published SHA-256 exactly matches the approved deliverable. |
| Documentation deployment | `The-Alleato-Group/alleato-docs-site` commits `29ca3c1` and `583f3e2` | Pass | Mintlify build succeeded, authentication is Public, and the Vercel proxy cutover deployed successfully. |
| Editable source publication | `The-Alleato-Group/project-management` commit `1fc61286c` | Pass | `origin/main` resolved to the same commit after push. |
| Source authentication guardrail | Current training-video source scan | Pass | No embedded test-password fallback is present; the recorder uses a saved session or environment-provided test credentials and confirms API access. |
| Independent review | Code reviewer final verdict | Pass | No P0-P1 findings block MP4 delivery; artifact approved after safe-name validation, evidence, scope-frame, and date-navigation fixes. |
| Publication evidence review | `docs/ops/evidence/2026-07-21-prime-contract-training-video-update/independent-review.md` | Pass | Public deployment facts, retained visual proof, and the remote source commit were independently checked before final closeout. |

## Remaining Risk

- The owner invoice contact is maintained through the owner company's contact record, not a Prime Contract form field; the video explicitly demonstrates that prerequisite before opening the contract form.
- The live owner company currently shows no linked contact. The video demonstrates a complete contact example without saving it and teaches the viewer to stop and correct mismatches before proceeding.
- The unsaved contact example uses `billing@owner-example.com` to stay aligned with the recorded artifact. Moving to a reserved `.example` address is deferred until a future reshoot; no contact or message is created.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Editable source is published to `The-Alleato-Group/project-management` on `main`; the public documentation page and exact approved MP4 are live on Alleato Docs.
