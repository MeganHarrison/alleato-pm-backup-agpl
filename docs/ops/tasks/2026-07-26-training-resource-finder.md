# Task: Training resource finder backend job

Status: Complete
Owner: Session S227
Created: 2026-07-26
Task ID: ALL-22
Linear Issue: https://linear.app/alleato-group/issue/ALL-22/t8-resource-finder-backend-job
Related Handoff: `docs/ops/handoffs/2026-07-26-S227-training-resource-finder.md`

Delivery lane: High-risk

Verification contract: Required

## Objective

Create a backend job that finds useful free construction-training resources for
one role/topic, vets them, skips canonical URL duplicates, and submits only new
`status = review` candidates through the existing atomic database boundary.

## Scope

- Owned: `backend/src/services/training/**`, the manual runner, focused backend
  tests, the shared Tavily helper, `render.yaml` secret declarations,
  architecture note, task/handoff, and verification contract.
- Reused: the existing research-agent search owner and applied training resource
  candidate RPC.
- Excluded: guide content (ALL-20), cron scheduling (ALL-23), reviewer UI
  (ALL-24), training schema/migrations, and unrelated agents.

## Workflow Map

| Boundary | Owner |
| --- | --- |
| User/operator action | Run the finder for one role and optional topic |
| Frontend owner | N/A — backend/manual job only |
| Shared capability | Existing Tavily research search |
| Request contract | Typed role/topic/search-limit inputs |
| Service owner | `backend/src/services/training/` |
| Database boundary | Existing atomic training candidate RPC |
| Tables | `training_role`, `training_topic`, `training_resource` through the RPC |
| Side effects | New free candidates enter `review`; duplicates and rejected candidates do not write |
| Success evidence | Structured counts plus inserted candidate identifiers |
| Failure behavior | Named provider, vetting, configuration, role/topic, and database failures |

## Acceptance Contract

- A role/topic run searches through the existing Tavily capability.
- Only free, non-Procore, sufficiently deep resources are eligible.
- URL canonicalization and the live database prevent duplicate candidates.
- Every accepted insert is created in `review` through the existing atomic RPC;
  the job never creates a published row or uses a direct table insert.
- Missing keys, provider failures, malformed search results, role/topic
  mismatches, and database failures fail loudly with operation context.
- A manual run for one role proves the linked-database boundary without
  publishing a resource.

## Acceptance Criteria

- [x] Finder inserts eligible review candidates for a known role.
- [x] Existing and same-run URL duplicates are skipped.
- [x] Paid, unknown-cost, Procore, and shallow resources are rejected.
- [x] Focused pytest covers free-only, dedupe, review-only insert, and failures.
- [x] Safe manual run and database readback prove the linked runtime boundary.

## Implementation Checklist

- [x] Non-overlapping path ownership registered before edits.
- [x] High-risk acceptance and failure contracts recorded before code.
- [x] Existing search and Supabase owners inspected and reused.
- [x] Typed contracts and deterministic vetting implemented.
- [x] Direct table writes and privileged bypasses absent.
- [x] Architecture note and operator command documented.

## Verification

- [x] Python compile passes for the training service and runner.
- [x] Focused pytest passes.
- [x] Safe linked-database/manual-run evidence passes.
- [x] Independent reviewer approves provider, dedupe, and write boundaries.
- [x] Render deployment is Ready from the published `origin/main` commit.

## Failure-Loudly Contract

- Cause: response identifies configuration, search, validation, lookup,
  duplicate, or insert boundary.
- Detection: focused pytest, safe manual run, linked database readback, and
  Render logs.
- Recovery: repair the named capability and rerun the same role/topic; URL
  dedupe makes retry safe.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Review Finding

- Cause: canonicalization initially preserved the provider's HTTP/HTTPS input
  scheme even though eligible public resources use HTTPS.
- Detection gap: first-pass dedupe coverage exercised tracking and YouTube-format
  variants but not a mixed-scheme database/search pair.
- Prevention: force one HTTPS identity, normalize default ports, and retain both
  unit and end-to-end mixed-scheme regression tests.
- Guardrail evidence:
  `test_skips_existing_resource_when_search_result_only_changes_scheme` and the
  canonicalization parameter suite.

## Evidence

| Check | Artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear kickoff | [ALL-22 kickoff](https://linear.app/alleato-group/issue/ALL-22/t8-resource-finder-backend-job#comment-034840c3) | Pass | Issue moved from Backlog to In Progress with exact scope. |
| Workspace ownership | S227 registry entry | Pass | Backend-only paths do not overlap the active ALL-20 guide workspace. |
| Python compile | `python3 -m py_compile ...` | Pass | Shared search helper, training service, and runner compile. |
| Focused regression | `cd backend && python3 -m pytest tests/test_training_resource_finder.py tests/test_research_agent.py -q` | Pass | 19 passed; only pre-existing framework deprecation warnings. |
| Render configuration | Individual Render env-var updates plus paginated readback | Pass | Tavily and Supabase runtime variables are present without exposing values. |
| Dry run | Project manager / project scheduling, eight results | Pass | 2 eligible, 1 existing duplicate, 5 rejected, 0 writes. |
| Atomic commit | One-candidate explicit commit | Pass | Resource `8b3e2279-7fcd-4c50-8d15-5e9d507bde94` inserted through the RPC. |
| Database readback | Supabase resource/topic/role REST readback | Pass | Row is `review`, `free`, `video`, `deep-dive`, `pm`; requested role/topic links exist. |
| Retry idempotency | Follow-up dry run | Pass | Newly inserted URL is reported as duplicate; no second write. |
| Independent review | `/root/training_finder_review` | Pass | Initial scheme-variant finding was remediated; final decision `APPROVED`. |
| Main publication | `baa339cfa209a65671db7f060842f2279416eb54` | Pass | Exact task files published to `origin/main`; remote readback matches. |
| Render release | `dep-d9j71u6q1p3s73fudicg` | Pass | Deployment is `live` on the exact main commit; production `/health` is healthy. |
| Linear closeout | [ALL-22 closeout](https://linear.app/alleato-group/issue/ALL-22/t8-resource-finder-backend-job#comment-5978acf7) | Pass | Evidence posted once and issue moved to Done. |
| Linear handoff helper | `npm run linear:codex:check -- docs/ops/handoffs/2026-07-26-S227-training-resource-finder.md` | Control-plane debt | Helper rejects the repository's current `ALL-22` identifier because it only accepts legacy `AAI-###`; Linear API kickoff and state mutation succeeded directly. |
| Ruff availability | `python3 -m ruff ...` | Unavailable | Local Python environment does not install the Ruff module; compile, pytest, and diff checks cover this slice. Prevention: pin Ruff in the backend development environment. |

## Remaining Risk

- Provider results remain untrusted external input. The deterministic regression
  suite, default dry-run, explicit commit flag, and RPC-only review boundary are
  the retained guardrails.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is complete after independent review and Render release proof.
- [x] Incident learning is explicitly N/A; the pre-release reviewer finding and
  regression guardrail are recorded separately.
