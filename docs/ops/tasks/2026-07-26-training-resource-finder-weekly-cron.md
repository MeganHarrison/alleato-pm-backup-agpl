# Task: Weekly training resource finder cron

Status: Complete
Owner: Session S228
Created: 2026-07-26
Task ID: ALL-23
Linear Issue: https://linear.app/alleato-group/issue/ALL-23/t9-weekly-cron-optional-in-app-trigger
Related Handoff: `docs/ops/handoffs/2026-07-26-S228-training-resource-finder-weekly-cron.md`

## Objective

Run the completed training resource finder once per week for a deterministically
rotated role/topic pair, committing at most one new free review candidate and
surfacing provider, taxonomy, or database failures in the Render cron result.

## Scope

- Owned: weekly target selector/runner, focused tests, the canonical
  `render.yaml` cron declaration, finder architecture note, task/handoff, and
  verification evidence.
- Reused without duplication: the ALL-22 deterministic eligibility service,
  atomic `create_training_review_candidate` RPC, backend Docker image, and
  required Render secrets.
- Excluded: ALL-20 guide content, schema/migrations, reviewer UI, and the optional
  privileged in-app trigger.

## Source of Truth

- Canonical runtime/data owner:
  `backend/src/services/training/finder.py`
- Existing shared primitives/services:
  `backend/src/services/training/`,
  `backend/src/scripts/run_training_resource_finder.py`,
  `backend/Dockerfile`, and Render cron conventions in `render.yaml`
- Deprecated or parallel paths: no frontend cron or second search
  implementation will be introduced.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] One UTC weekly cron is registered on Render and points to `main`.
- [x] The selected role changes on consecutive weeks under a deterministic,
  documented policy.
- [x] The cron commits no more than one eligible candidate and never publishes.
- [x] A manual dry run is read-only and names the selected role/topic.
- [x] A triggered live cron run succeeds and the review queue readback proves
  either a new review row or an explicit duplicate/no-eligible outcome.
- [x] Provider, taxonomy, database, and partial-insert failures exit non-zero.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared ALL-22 abstraction owns search, eligibility, and writes.
- [x] Weekly selector and runner are deterministic and typed.
- [x] Errors are specific and actionable.
- [x] Live cron was created with its exact environment contract and verified by
  readback; no bulk environment replacement was used.
- [x] Optional in-app trigger is explicitly deferred to avoid an unnecessary
  privileged mutation surface.

## Integration and Verification

- [x] Targeted Python compile and pytest checks pass.
- [x] Render Blueprint validation passes.
- [x] Independent review approves schedule, write cap, and failure behavior.
- [x] Live Render service/build/run readback proves the requested outcome.
- [x] Supabase review-queue readback proves the cron side effect.
- [x] Final relevance-guard changes are published and live on the cron.

## Failure-Loudly Contract

- Cause surfaced as: named finder failure in structured JSON plus non-zero cron
  exit, or Render unsuccessful run status.
- Detection path: focused pytest, manual dry run, Render build/run logs, and
  Supabase review-queue readback.
- Recovery path: repair the named provider/taxonomy/database/config boundary and
  rerun the same cron; canonical URL dedupe keeps retries safe.

## Incident Learning

- Failure fingerprint: `ai.training-resource-topic-relevance-drift`
- Root cause: free/depth gates and then broad topic-token overlap treated
  untrusted provider results as relevant without proving the selected topic.
- Detection gap: no deep/free cross-topic fixture or generic construction course
  sharing one broad word was present; the one-row cap masked false positives.
- Prevention: construction-role context plus explicit normalized phrases for
  each scheduled topic, one-row review-only cap, first-run log review, and
  recoverable cleanup of invalid candidates.
- Guardrail evidence:
  `test_shared_finder_rejects_deep_free_but_contextually_irrelevant_course`;
  registry guard `training_resource_relevance_contract`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear kickoff | [ALL-23 kickoff](https://linear.app/alleato-group/issue/ALL-23/t9-weekly-cron-optional-in-app-trigger#comment-914afbdb) | Pass | Issue moved to In Progress with exact scope and optional trigger deferral. |
| Workspace ownership | S228 registry entry | Pass | No active writer overlap; Claude's guide paths remain separate. |
| Python compile | `python3 -m py_compile backend/src/services/training/*.py backend/src/scripts/run_training_resource_finder_weekly.py` | Pass | Weekly contracts, selector, and runner compile. |
| Focused regression | `cd backend && python3 -m pytest tests/test_training_resource_finder_weekly.py tests/test_training_resource_finder.py tests/test_research_agent.py -q` | Pass | 27 passed; only pre-existing framework deprecation warnings. |
| Render YAML parse | `python3 -c 'import yaml; yaml.safe_load(...)'` | Pass | Canonical file parses. |
| Render Blueprint validation | `POST /v1/blueprints/validate` | Pass | Render returned `valid=true` and included the new weekly cron in its plan. |
| Wrong-project failure proof | Dry run with a stale VS Code history Supabase pair | Pass | Runner exited non-zero with `TRAINING_TAXONOMY_LOOKUP_FAILED` / `PGRST205`; no write occurred. Cause: stale local credential source. Detection: named schema-cache failure. Prevention: use canonical `.env` project ref plus Supabase management API key readback. |
| Canonical-project dry run | `--for-date 2026-07-26` without `--commit` | Pass | Selected assistant-superintendent / look-aheads-pull-planning; 8 searched, 1 would insert, 7 rejected, 0 writes. |
| Review queue baseline | Supabase REST readback | Pass | One prior finder row exists; it remains `review` and `free`. |
| Missing-config CLI proof | Unset Supabase variables and execute the weekly module | Pass | Structured `TRAINING_WEEKLY_RUN_FAILED: TRAINING_RESOURCE_CONFIGURATION_FAILED` JSON, exit 1, no traceback. |
| Independent review | `/root/training_finder_review` | Pass | Initial configuration-boundary finding remediated; final decision `APPROVED`. |
| Main publication | `e09579c246fd5be7ec89c507ef84f46bced7fb7f` | Pass | Weekly cron release candidate published to `origin/main`. |
| Render cron creation | `crn-d9j77bbtqb8s739t4gog` | Pass | Monday 13:15 UTC, Docker runtime, `main`, auto-deploy, starter plan. |
| Render build | `dep-d9j77bjtqb8s739t4hjg` | Pass | Build is live on exact commit `e09579c246fd5be7ec89c507ef84f46bced7fb7f`. |
| Render environment | Paginated cron env-var readback | Pass | Three required keys are non-empty and `SUPABASE_URL` targets project `lgveqfnpkxvzbnnwuled`; values were not logged. |
| Triggered cron run | `crn-d9j77bbtqb8s739t4gog-1785099321` | Pass | Successful; 8 searched, 1 accepted/inserted, 7 rejected, 0 failed. |
| Queue growth/readback | Resource `1ad37217-dbda-4888-a216-26da7082cfe1` | Pass | `review`, `free`, `video`, `deep-dive`, `field`, active requested role/topic; not published. |
| First relevance retry | Run `crn-d9j77bbtqb8s739t4gog-1785099604` | Detected gap | Successful/idempotent for the first row, but generic `planning` admitted a construction-business course; runtime evidence localized the topic-matching boundary. |
| Invalid candidate cleanup | Resource `5f5b3988-b7d9-4494-9303-10ea5870a0ae` | Pass | Exact row moved from `review` to recoverable `archived`; it was never published. |
| Learning registry | `ai.training-resource-topic-relevance-drift` | Pass | Registry audit and lookup pass; recurring guard is active. |
| Final publication | `4050c73444b8a02f9ab83857a8716c7cd4df5928` | Pass | Exact final task state is on `origin/main`. |
| Final Render deploy | `dep-d9j7d2nlk1mc739vt4a0` | Pass | Live on the exact final commit. |
| Final cron run | `crn-d9j77bbtqb8s739t4gog-1785099970` | Pass | Successful; 0 inserted, 2 duplicate, 6 rejected, 0 failed; Terraform, SQL, and OneNote results rejected as irrelevant. |
| Final queue readback | Supabase finder-created rows | Pass | Two relevant rows remain `review`; the invalid development candidate is `archived`; all remain `free`, none published. |
| Linear closeout | [ALL-23 closeout](https://linear.app/alleato-group/issue/ALL-23/t9-weekly-cron-optional-in-app-trigger#comment-21859855) | Pass | Evidence posted once and issue moved to Done. |

## Review Finding

- Cause: repository construction originally happened before the shared finder
  wrapped configuration failures.
- Detection gap: first-pass tests covered already-named provider failures but
  not a raw missing-environment failure during Supabase client initialization.
- Prevention: the shared finder now converts repository initialization errors
  into `TRAINING_RESOURCE_CONFIGURATION_FAILED`, and the CLI regression unsets
  Supabase configuration and asserts structured JSON plus exit 1.
- Guardrail evidence:
  `test_weekly_cli_names_supabase_initialization_failure`.

## Live Relevance Finding

- Cause: the original eligibility policy proved free access and depth but did
  not require both construction-role and selected-topic relevance; the first
  correction still used broad single-token overlap.
- Runtime evidence: the first cron log classified unrelated Terraform and
  Oracle SQL courses as `insert_limit`, proving they had passed eligibility
  after the one relevant candidate was selected.
- Detection gap: provider-mismatch tests covered paid, Procore, shallow, and
  duplicate results but not a deep free course unrelated to the selected topic.
- Prevention: require construction/role context plus explicit normalized phrases
  for all six scheduled topics after the existing free/depth gates; unrelated
  courses now receive `irrelevant_result`.
- Guardrail evidence:
  `test_shared_finder_rejects_deep_free_but_contextually_irrelevant_course`;
  the exact construction-business fixture, and independent reviewer approval.

## Remaining Risk

- Provider results remain untrusted, but the scheduled topic phrase contract,
  one-row cap, review-only RPC, runtime logs, and recurring regression guard
  bound that risk.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning references
  `ai.training-resource-topic-relevance-drift`.
- [x] Optional in-app trigger deferral includes owner and rationale.
