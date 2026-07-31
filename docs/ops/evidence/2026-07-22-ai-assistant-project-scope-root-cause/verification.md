# AI Assistant Project-Scope Verification

Status: Complete — canonical production flow and trace contract proven
Task: AI-ASSISTANT-SCOPE-ROOT-CAUSE-0722
Date: 2026-07-22

## Root-Cause Comparison

| Boundary | Before | After local repair |
| --- | --- | --- |
| Missing selected project | Trace `e71341bf-935b-46c5-91f9-2c4a028d4d31` searched broadly | Trace `ab9a5db4-8aaf-4dd4-9fd8-3f42079fa549` stopped with `selected_project_context_missing` and zero sources |
| Scoped meeting request | 1,938 records enumerated, 39 analyzed, 104,479 ms, unrelated citations | Trace `e2fe746c-ee05-4600-9ee5-180174727268` carried project 1102, enumerated 0 project records in 228 ms, and substituted nothing |
| Construction vocabulary | `this job` could bypass the literal-project guard | Trace `f6087d33-0204-4bc1-bc02-30f17305140c` stopped `this job` before retrieval |
| Follow-up | Shorthand could re-enter unscoped semantic retrieval | Trace `44692bce-9783-4284-9b9f-02927a586ce8` kept `What about the risks?` fail-closed |
| Picker interaction | Radix portal at z-50 sat behind the fixed widget at 2147483003 | Shared popover layer renders at 2147483004; desktop and mobile option clicks select project 1102 |
| First resend after scope stop | `cite` made the scoped resend follow up to the empty stop; semantic selection enumerated project 1097 but matched 0 | Trace `ca19e248-766c-42b9-9583-031b03a8003a` routes to `project_context_source_specific_rag_recent_meetings`, returns the one Park Collective meeting, and grounds decisions/follow-ups/risks |

## Action Log

1. Reproduced the canonical production prompt in the global widget.
2. Read the production Langfuse trace hierarchy and persisted chat row.
3. Confirmed the request carried `selectedProjectId=null` and meeting collection
   enumerated the organization corpus.
4. Reproduced the project option click timeout and captured the intercepting
   widget panel in the browser error.
5. Added planner preflight, deterministic persisted stop, shared portal layer,
   accessible selected-project state, recurring-failure fingerprint, and tests.
6. Ran local desktop and mobile browser flows. Both project-picker option clicks
   succeeded; local request traces were read back through the Langfuse API.
7. Independent review found and blocked two scope aliases plus one sticky-followup
   overcapture. Each was corrected with positive and negative regression tests.
8. Published the scope guard and reproduced the recovery flow in production.
   Trace `c27d3650-674c-4c83-85cc-4f416117f949` preserved project 1097 but
   exposed that `cite` incorrectly followed up to the scope-stop response.
9. Repaired the follow-up ownership boundary, added direct and wrapper tests,
   obtained an independent APPROVED review, and proved the exact resend locally.
10. Corrected the stale direct-source trace orchestrator label and received a
    separate independent APPROVED review for that metadata-only delta.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Planner, collection, handler-order, trace ownership, and rendered popover tests | Pass, 112/112 | `pnpm exec jest --runInBand --runTestsByPath ...` |
| Existing mixed-source research contract | Pass, 11/11 | `research-contract.test.ts`; `mixed-source-research-seam.test.ts` |
| Targeted ESLint | Pass | Ten task-owned TypeScript/TSX paths |
| Changed-code type debt guard | Pass | `npm run typecheck:changed` |
| Full frontend typecheck | Known unrelated failure | 385 existing error lines; none name a task-owned AI scope path |
| Learning registry JSON parse | Pass | `JSON.parse(recurring-failures.yaml)` |
| Local desktop negative path | Pass | `local-desktop-sticky-scope-stop.png` |
| Local desktop selected-project result | Pass | `local-desktop-scoped-result.png` |
| Local mobile picker | Pass | `local-mobile-project-picker.png` |
| Local mobile selected state | Pass | `local-mobile-project-selected.png` |
| Local recovery answer | Pass | `local-desktop-recovery-answer.png`; trace `ca19e248-766c-42b9-9583-031b03a8003a` |
| Verification contract | Pass | `verification-manifest.json`; `verification-result.json` |
| Production scope-stop release | Pass | deployment `dpl_FTWo5Wrv4T1SC1ejYjaehknpCviC`; trace `2fae94df-3475-4416-87e4-2f33435cfc84` |
| Production recovery canary | Detected and localized | trace `c27d3650-674c-4c83-85cc-4f416117f949`; exact project preserved, wrong post-stop route used |
| Final production deployment | Pass | `dpl_CsK12d5x55sBmx57X2JTHMNwQDE8`; commit `7cdcc7eb750967e64b6d750fe4aadad6b2e2abba`; canonical alias confirmed |
| Final production negative path | Pass | `production-desktop-scope-stop.png`; trace `40046286-2ce4-4c0f-b3f7-d9b7f35e1fb3` |
| Final production selected-project answer | Pass | `production-desktop-scoped-result.png`; `production-desktop-scoped-insights.png`; trace `4b205201-c972-4d8b-b0c2-47ecd054ed57` |
| Final production mobile picker | Pass | `production-mobile-project-picker.png`; `production-mobile-project-selected.png` |

## Visual And Noise-Gate Review

- Primary user: an Alleato operator asking the assistant about the project they
  believe is selected.
- Primary job: get evidence from exactly that project without cross-project
  leakage.
- Tier 1 content: current project context, prompt, grounded answer, and explicit
  recovery when context is missing.
- Removed/simplified: no new panel, banner, card, helper module, or duplicate
  CTA was added. The existing folder control now exposes its selected state.
- Container depth: unchanged.
- Accent palette and shadows: unchanged.
- Failure loudly: missing project context returns a persisted deterministic stop
  and a Langfuse `projectContextRequired` trace instead of running retrieval.
- Noise gate: Pass in production on desktop and mobile. No new card, wrapper,
  banner, helper panel, decorative element, or duplicate action was introduced.

## Final Trace Contract

- Missing scope: trace `40046286-2ce4-4c0f-b3f7-d9b7f35e1fb3`, project null,
  `project-scope-preflight`, zero retrieval readers.
- Recovered scope: trace `4b205201-c972-4d8b-b0c2-47ecd054ed57`, project 1097,
  `project_context_source_specific_rag_recent_meetings`, one Park Collective
  meeting source, grounded follow-ups/risks, zero tool failures.
- Trace ownership: `retrieval-planner-v2-direct-recent_meetings`, matching the
  actual reader rather than the prior stale `recent-teams` label.

## Remaining Proof

None for this repair. LangSmith dual-write is separately unavailable because
the local credential returns 403 and Vercel's key is empty; canonical Langfuse
production readback is complete.
