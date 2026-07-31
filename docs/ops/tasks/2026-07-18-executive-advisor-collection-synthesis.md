# Task: Executive-Advisor Collection Synthesis

Status: In Progress
Owner: Codex S199
Created: 2026-07-18
Task ID: AAI-1182
Linear Issue: AAI-1182 — https://linear.app/megankharrison/issue/AAI-1182/replace-robotic-collection-summaries-with-an-executive-advisor
Related Handoff: `docs/ops/handoffs/2026-07-18-S199-executive-advisor-collection-synthesis.md`

## Objective

Make exhaustive collection questions use one semantic membership boundary and return candid, evidence-backed executive counsel. The implementation must not depend on keyword, phrase, or banned-word lists for either retrieval membership or response quality.

## Scope

- Own the shared collection boundary, selector, synthesis, and their focused tests.
- Own collection-path metadata, direct-response trace identity, and Langfuse quality integration.
- Own the production canary contract, exact-prompt replay, evidence, learning, and feedback artifacts.
- Preserve canonical source rendering and fail loudly on incomplete coverage, invalid evidence IDs, or advice that does not meet the semantic contract.

## Source of Truth

- Collection boundary: `frontend/src/lib/ai/retrieval/collection-planner.ts`
- Exhaustive membership: `frontend/src/lib/ai/retrieval/meeting-collection.ts`
- Executive response: `frontend/src/lib/ai/retrieval/collection-synthesis.ts`
- Runtime persistence and trace: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- Production guardrail: `docs/ops/evals/collection-analysis-production-canary.json`

Verification contract: Required

Verification manifest: `docs/ops/evidence/2026-07-18-executive-advisor-collection-synthesis/verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-18-executive-advisor-collection-synthesis/verification-result.json`

## Acceptance Criteria

- [x] Natural-language collection membership does not use keyword, phrase, or exclusion lists.
- [x] Every authorized record remaining after explicit typed filters reaches semantic adjudication.
- [x] Missing, invented, duplicate, or uncertain selector decisions fail loudly.
- [x] The answer leads with a diagnosis, prioritizes consequences, gives operating decisions, and places coverage last.
- [x] Every cited evidence ID is constrained to a retrieved meeting and rendered as its canonical source reference.
- [x] Synthesis and semantic review use separately pinned capable models.
- [x] A failed review retry revises the prior grounded draft instead of regenerating blindly.
- [x] Quality metadata and direct Langfuse trace identity persist with the assistant row.
- [ ] The exact production prompt passes at the deployed revision and is manually accepted as natural executive counsel.
- [ ] A viewable screenshot from the canonical `/ai` route is attached to AAI-1182.

## Integration and Verification

- [x] Focused retrieval, synthesis, handler, scoring, and Langfuse tests pass.
- [x] Collection canary audit tests pass.
- [x] Targeted ESLint, changed-file type-debt gate, and diff hygiene pass.
- [x] Vocabulary-free production replay proves `candidateMatches == enumerated == adjudicated`.
- [ ] Final exact-SHA production canary passes both prompt variants.
- [ ] Final persisted metadata and Langfuse trace readback pass.
- [ ] Canonical screenshot is captured, visually reviewed, and attached to Linear.
- [ ] Independent fresh-context review approves the exact final revision.
- [ ] Verification contract returns PASS.
- [ ] Final task artifacts are published and `HEAD == origin/main`.

## Failure-Loudly Contract

- Retrieval stops if any authorized candidate lacks one explicit semantic decision or any selected transcript cannot be read.
- Synthesis stops if the typed structure, evidence lineage, or semantic advisor review fails after bounded correction attempts.
- The user sees a concise failure; detailed coverage, selection, synthesis, and trace diagnostics persist for operators.
- There is no conversational fallback that presents partial or generic analysis as complete.

## Runtime Localization and Incident Learning

- Original bad row: `d727dbd8-4f41-4bcc-ba9d-86a5e7a353e0`; trace: `307c0d01-f185-4872-9831-bfbc157355ba`.
- First bad boundary: a dynamic vocabulary gate silently reduced 1,913 authorized records to 38 candidates before semantic review. It has been removed; typed filters are the only pre-adjudication narrowing.
- Response boundary: the old final prompt owned a coverage-first free-form report, and generic trace scoring could pass non-empty source-bearing prose.
- Correction boundary: retries received evaluator feedback but not the candidate being criticized, so each retry started over and oscillated. `executive-advisor-v9` requires in-place revision of the prior grounded draft.
- Revision-attention boundary: the first production `v9` replay did receive the prior draft, but then appended the entire 63-review evidence corpus after the judge feedback. That buried the correction and produced four near-fresh answers that stalled below the actionability and voice gates. `executive-advisor-v10` gives retries only the evidence already cited by the grounded draft, preserves every failed score plus judge feedback, and places the substantive rewrite contract last.
- Selector-context boundary: exact canary run `29669685790` proved that two requests compiled to the same record class and semantic criteria but resolved to 59 versus 61 records, including unrelated recruiting and operating meetings. A controlled comparison showed that both the primary and stronger models could reject those records individually but over-included them inside large metadata cohorts. `taxonomy-cohort-v5` keeps exhaustive cohort adjudication, makes cohort order deterministic, and independently re-verifies every proposed inclusion as a one-record semantic decision before transcript retrieval.
- Retry-lineage boundary: the first fresh-context reviewer found that `v10` narrowed the retry prompt evidence but left the output schema open to every originally retrieved meeting ID. The schema now derives from the exact retry evidence slice, so a revision cannot introduce a source it was not shown.
- Advisor-objective boundary: exact canary run `29743080777` proved semantic membership parity at 31/31 sources, but the terse prompt failed the voice gate while the detailed paraphrase passed at 96/100 on the identical evidence fingerprint. `executive-advisor-v11` makes the typed `employee_performance_evaluation` record class own one canonical executive decision objective, so raw prompt verbosity cannot switch the synthesis into a weaker report-writing mode.
- Execution-budget boundary: exact canary run `29744367670` on the passing `v11` contracts aborted both variants at exactly 280 seconds before persistence. The completed control trace localized 93,369 ms to independent chunk extraction, 36,187 ms to final synthesis, and roughly 150 seconds to independent cohort adjudication. Revision `cf7798acb7d634be40cd90e0ba2eae9831d635ae` raises bounded parallelism only for those independent calls and persists `selectionDurationMs`; it does not relax membership, evidence, advisor, or latency gates.
- Quality-convergence boundary: fresh-context review of exact canary `29745945203` confirmed that parallel execution fixed latency and preserved the same 31-source fingerprint across both paraphrases, but four serial rewrites of one draft still failed the actionability and voice gates. `executive-advisor-v12` replaces that trapped single-draft path with three independent grounded candidates per round, strict parallel semantic judging, selection of only the highest-scoring passing candidate, and at most one evidence-constrained correction round. Required scores are unchanged.
- Failure fingerprint: `ai.collection-analysis-advisor-contract-drift`.
- Prevention: vocabulary-free exhaustive adjudication, typed evidence-bound advice, prior-draft correction, separate synthesis/review models, persisted quality/trace metadata, exact production canary, and manual visible-answer acceptance.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Original row and Langfuse trace above | Fail reproduced | Retrieval completed; robotic prose existed before UI rendering and generic quality was 0.62. |
| Vocabulary-free boundary | Production row `ce55d305-8478-4cd7-ad59-071e74172fdd` | Pass | 1,913 enumerated, 1,913 candidate matches, 1,913 adjudicated; no phrase gate. |
| Focused selector and synthesis suites | `meeting-collection.test.ts` + `collection-synthesis.test.ts` | Pass | 32/32, including independent false-positive rejection and retry evidence-lineage enforcement. |
| Collection audit | `node --test scripts/verify/__tests__/collection-audit.test.mjs` | Pass | 10/10. |
| Targeted quality | Targeted ESLint; `pnpm run typecheck:changed`; `git diff --check` | Pass | No task-owned diagnostics or new `any` debt. |
| Full TypeScript check | `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit --pretty false` | Unrelated fail | 248 existing errors; zero task-owned diagnostics. |
| Fresh-context review of `de60c7959` | Independent reviewer | Block, repaired locally | Correctly identified missing exact-SHA evidence plus the retry-schema lineage gap; final candidate requires a new clean-context review after publication. |
| Sunday production replay on exact SHA `a888b72134a723847b12c89c0f764fe33f02d3c0` | Retired local eval artifact | Fail localized | Both prompts failed before synthesis because the selector returned `uncertain` for one metadata-empty candidate in each run (`01KRP9XZ654F2G01RAR4Q0C7BW`, `01KQB1MSVG9MR3V7JFY8BVWEHH`), producing `matched=0`, `failed=1`, and no `collection_synthesis` metadata. |
| Exact canary `29669685790` on `ae7bbc6a0` | Downloaded workflow result | Fail localized | 0/2: synthesis failed; identical canonical boundaries selected 59 versus 61 sources and admitted recruiting/operating records. This failure triggered the per-record verification boundary instead of a title-word exclusion list. |
| Controlled selector comparison | Same live metadata and canonical criteria, cohort versus one-record decisions | Cause confirmed | Cohort decisions over-included screening and compensation meetings; isolated semantic verification excluded both while retaining two known annual-review records. |
| Canary `29743080777` on `d2b00f3d7` | `docs/ops/evidence/2026-07-18-executive-advisor-collection-synthesis/canary-29743080777/results.json` | Membership pass; advisor reliability fail | Both prompts selected the same 31-source fingerprint. The detailed paraphrase passed `v10` at 96/100; the terse exact prompt stalled at voice 4/5, localizing the remaining divergence to raw request phrasing at synthesis. |
| Canary `29744367670` on `7d3ae0b85` | `docs/ops/evidence/2026-07-18-executive-advisor-collection-synthesis/canary-29744367670/results.json` | Latency fail localized | Both variants were aborted by the verifier at exactly 280 seconds before persistence. The successful control trace passed `v11` at 92/100 but completed in 281 seconds, proving execution scheduling—not response quality or membership—was the remaining blocker. |
| Canary `29745945203` on `cf7798acb` | `docs/ops/evidence/2026-07-18-executive-advisor-collection-synthesis/canary-29745945203/results.json` | Quality convergence fail localized | Both variants completed under 240 seconds, exhaustively adjudicated all 1,915 live records, and selected the identical 31-source fingerprint. Both failed after four rewrites of one draft, localizing the remaining defect to single-path advisor convergence. |
| Canary `29747218168` on `39fd46203` | `docs/ops/evidence/2026-07-18-executive-advisor-collection-synthesis/canary-29747218168/results.json` | Provider blocked | Vercel AI Gateway rejected semantic planning before retrieval because the team had no positive gateway credit balance. This run did not exercise `executive-advisor-v12`. |
| Canary `29747777926` on `39fd46203` | `docs/ops/evidence/2026-07-18-executive-advisor-collection-synthesis/canary-29747777926/results.json` | Fallback provider blocked | The configured direct OpenAI credential was authenticated and had access to all required model IDs, but live chat completion returned `429 insufficient_quota`. The primary provider path was restored to `vercel_gateway`; production verification now requires a positive gateway credit balance. |
| Final production replay | Exact prompt on canonical `/ai` | Pending | Must pass `executive-advisor-v12` and manual voice review. |
| Final canary / trace / screenshot | Exact-SHA run, Langfuse readback, Linear attachment | Pending | Required before close. |

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked.
- [ ] Screenshot completion gate is satisfied.

Current blocker: Vercel AI Gateway has zero usable credits and the direct OpenAI account has `insufficient_quota`. Provider setup and key rotation were executed and read back; neither account can execute the final canary until billing credit exists. Smallest next action: authorize a Vercel AI Gateway credit purchase, redeploy `39fd46203fb7d0f85ce327e4d29c517773f4388c`, rerun the exact canary, and request a new clean-context review.
