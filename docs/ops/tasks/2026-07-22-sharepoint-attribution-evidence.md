# Task: Require SharePoint evidence for Project Intelligence attribution

Status: Complete
Owner: Codex SROOT-SHAREPOINT-ATTRIBUTION
Created: 2026-07-22
Task ID: AAI-1263
Linear Issue: [AAI-1263](https://linear.app/megankharrison/issue/AAI-1263/require-sharepoint-proposal-and-estimate-evidence-for-project)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-sharepoint-attribution-evidence.md`

## Objective

Make the daily Project Intelligence run use SharePoint job-folder, proposal, and estimate evidence before assigning source material to a project, so a source about Space Coast cannot be published as Port Collective or Union Collective.

## Scope

- Add one shared SharePoint attribution-evidence owner used by the daily compiler.
- Read indexed SharePoint metadata from `04 - Estimate` and `05 - Proposal` job folders, including job number, project name, location, path, and source URL.
- De-attribute unresolved entity conflicts and preserve a source-resolved label instead of asserting the wrong registered project.
- Surface reference coverage, corrections, and unresolved conflicts in the source manifest.
- Update the architecture and operator runbook.
- Correct and regenerate the affected Project Intelligence artifact only after the guardrail passes.
- Exclude project creation: Space Coast remains an unregistered opportunity unless a separately authorized workflow creates a project.

## Source of Truth

- Canonical runtime/data owner: `project-intelligence/runner/run-scheduled-daily-executive-brief.mjs` -> `project-intelligence/core/compile-daily-executive-brief.mjs`.
- Existing shared primitives/services: `project-intelligence/ingestion/daily-source-corpus.mjs`, application `document_metadata`, Microsoft Graph SharePoint ingestion, and canonical `projects` rows.
- Deprecated or parallel paths: title-only `correctAttribution` remains a compatibility backstop but is not sufficient evidence for proposal/estimate identity.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The compiler enumerates indexed SharePoint proposal and estimate evidence before synthesis.
- [x] Port Collective resolves to job `25-107`, Savannah, Georgia, from its SharePoint evidence.
- [x] Union Collective resolves to job `26-119`, Union, Kentucky, from its SharePoint evidence.
- [x] A Port-assigned source naming Space Coast Town Center is de-attributed, labeled Space Coast Town Center, and cannot be synthesized as Port.
- [x] SharePoint evidence unavailability fails the run before publication with an actionable error.
- [x] Source manifest records reference coverage, evidence URLs, corrections, and unresolved conflicts.
- [x] Detailed and structured synthesis fail before publication if the model merges project identities or cites a source under the wrong project.
- [x] Focused regression tests, a controlled run, database readback, and independent review pass.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] `project-attribution-evidence.mjs` owns SharePoint path parsing, profiles, validation, and receipts.
- [x] Compiler integration occurs before model input is constructed.
- [x] Model-facing source labels use the evidence-resolved label.
- [x] Errors identify the unavailable evidence boundary or unsafe source alias.
- [x] Documentation states that proposals and estimates are mandatory attribution evidence, not optional research.

## Integration and Verification

- [x] Targeted Node tests pass.
- [x] A controlled source-only run proves live SharePoint evidence enumeration and the corrected Space Coast label.
- [x] A full controlled regeneration produces a complete current packet without the false Port attribution.
- [x] Database and packet readback prove the source and report lineage.
- [x] Independent review approves the implementation and evidence.
- [x] Task-owned files are published and remote-main parity is verified.

## Failure-Loudly Contract

- Cause surfaced as: `SharePoint attribution evidence unavailable` or `Unsafe project attribution remains` with the affected source alias and evidence state.
- Detection path: focused contract test, source-manifest attribution receipt, controlled run, and packet/source readback.
- Recovery path: restore SharePoint ingestion/read access or resolve the specific source/project identity; rerun only after the attribution gate passes.

## Incident Learning

- Failure fingerprint: `intelligence.sharepoint-project-attribution-drift`
- Root cause: the daily compiler trusted upstream `project_id` and only compared exact project names in source titles; it never consulted authoritative SharePoint job folders, proposals, estimates, job numbers, or locations.
- Detection gap: full-source and publication receipts proved completeness but did not prove that each source was assigned to the correct project or that model output preserved a corrected identity.
- Prevention: build SharePoint-backed project identity profiles before synthesis, de-attribute unsupported assignments, preserve unresolved entity labels, pass a source-to-project contract into both model stages, deterministically reject cross-project citations, and refuse to proceed when either evidence or synthesis attribution is unsafe.
- Guardrail evidence: `node --test project-intelligence/core/__tests__/project-attribution-evidence.test.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Acceptance and fail-loud contract captured before implementation. |
| SharePoint source check | Union and Port proposal/estimate paths and PDFs | Confirmed | Union is `26-119`, Union KY; Port is `25-107`, Savannah GA; neither supports Space Coast attribution. |
| SharePoint metadata sync | Bounded Microsoft Graph sync of Port proposal + Union estimate/proposal folders | PASS | 18 files synced, 0 failed, and all 18 have source URLs. |
| Source-only compiler | `node project-intelligence/core/compile-daily-executive-brief.mjs --date 2026-07-21 --sources-only --no-write ...` | PASS | 625 rows enumerated, 224 sources materialized, 25 proposal/estimate files accepted into 6 profiles; Space Coast is unregistered and not Port. |
| Source repair | Exact application + RAG rows for `01KY0HFE665Z1STG28FRGFR22Y` | PASS | Both rows changed from Port project `34` to null with transactional readback. |
| Independent verification | Node Project Intelligence tests + learning audit + diff check | PASS | 96 tests, 0 failures; 24 learning fingerprints. |
| Independent review | Adversarial reproduction of poisoned-row, no-profile, body-token, email-header, and substring cases | APPROVED | No findings after the final strict attribution gate. |
| First full regeneration | Packet `4c99f541-1790-4556-8392-b28066386baa` | REJECTED / STALE | Model merged Space Coast and Port after correct input attribution; deterministic post-synthesis gates were added and the packet was marked stale. |
| Strict full regeneration | Scheduler run `c4150e6d-5100-444e-9ba3-439a3e19fff9` | FAILED CLOSED | No packet persisted: the report cited unassigned S137/S149 under Playmakers/Ulta Dallas. The retry loop now includes the failed candidate before repair instructions. |
| Accepted full regeneration | Packet `e7e55360-bfa2-455c-b012-2c7f3cb817e1` | PASS | Fresh/current; scheduler succeeded at attempt 26; zero Port artifacts; exact markdown DB parity; all corpus, SharePoint, attribution, and consumer readbacks complete. |
| Production release | `origin/main` `c35cf4997469e35fe46d74e72adfa7cd68bef400`; Render `dep-d9ggptf7f7vs73f5nkgg` | PASS | Exact file publication verified; canonical daily-executive-brief cron deployment is live on the same commit. |
| Supabase types gate | `npx supabase gen types ...` | Blocked by missing CLI token | Existing generated types confirm all queried columns; provider credential gap is recorded and no schema change is required. |

## Remaining Risk

- Live SharePoint metadata freshness depends on the canonical Microsoft Graph ingestion succeeding before the morning Project Intelligence run; the attribution receipt must expose zero/unavailable evidence rather than silently falling back.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work names cause, detection gap, prevention, owner, and next action.
