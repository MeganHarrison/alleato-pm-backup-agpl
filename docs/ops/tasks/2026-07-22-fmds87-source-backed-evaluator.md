# Task: Source-Backed FMDS 8-34 Evaluator Results

Status: Complete
Owner: Codex SROOT-FMDS87
Created: 2026-07-22
Task ID: GitHub #87
Linear Issue: Not used — GitHub issue [#87](https://github.com/The-Alleato-Group/project-management/issues/87) is the configured implementation tracker for this ASRS workstream.
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-fmds87-source-backed-evaluator.md`

## Objective

For an FMDS 8-34 configuration backed by approved evidence, the shared evaluator returns a single source-backed Reviewed result that the existing public form, authenticated estimator, and assistant tool can render without changing their respective route ownership.

## Scope

- Shared FMDS estimator result contract, server evidence adaptation, and ASRS assistant calculation tool contract.
- Focused evaluator, server-adapter, and assistant-tool contract tests.
- Excludes concurrent ASRS intake route work, new input fields, rule-card creation/approval, deterministic head count, and FMDS 8-9.

## Source of Truth

- Canonical runtime/data owner: the dedicated FMDS0834 revision-scoped ASRS corpus and the shared evaluator contract.
- Existing shared primitives/services: `asrsEstimatorRequestSchema`, `evaluateAsrsConfiguration`, and the FMDS ASRS assistant tools.
- Deprecated or parallel paths: legacy FM lookup is not a fallback; public-form route adapters owned by AAI-1258 are excluded.

Verification contract: Required

## Acceptance Criteria

- [x] A supported evaluator result exposes Reviewed evidence state, locked revision identity, source page, table/figure/rule-card identities, and canonical evidence links.
- [x] The shared evaluator and assistant tool preserve those result semantics for the same normalized request.
- [x] Native retrieval without approved structured provenance cannot be presented as an authorized requirement.
- [x] Failure states name the missing source/review/authority rather than falling back silently.

## Implementation Checklist

- [x] Existing evaluator and citation contracts are inspected and the smallest result-contract gap is localized.
- [x] A failing external-behavior test is added at the evaluator/tool seam before implementation.
- [x] Shared result/evidence adaptation is implemented without route-local duplication.
- [x] Focused tests and changed-file static checks pass.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Existing public form, authenticated estimator, and assistant tool all consume the shared result shape without route changes.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: unavailable revision, unreviewed/missing structured provenance, missing evidence link, or evaluator failure.
- Detection path: focused evaluator and assistant-tool contract tests plus result evidence-state assertions.
- Recovery path: restore an eligible reviewed source/review event/rule card or correct the named evidence adapter input; never use generic or legacy fallback.

## Incident Learning

- Failure fingerprint: Vectorized/native FMDS text could be mistaken for authorized code-requirement evidence.
- Root cause: retrieval coverage and calculation authority were separate contracts; the evaluator discarded approved rule-card citation provenance before returning a verified result.
- Detection gap: prior coverage checks accepted an empty/non-linkable citation array on a verified evaluator requirement.
- Prevention: verified requirements now require structured source ID, review event, rule key, and canonical evidence href; the dedicated-ASRS migration backfills source IDs and rejects unresolved citation provenance.
- Guardrail evidence: focused evaluator, assistant-tool, renderer, public-action, and authenticated-route contract tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Writer lease | `checkout-session-gate.mjs claim --session SROOT-FMDS87 --task GH-87` | Pass | Core evaluator/test paths only; concurrent ASRS intake routes remain excluded. |
| Red tests | Focused evaluator/renderer tests before implementation | Pass after implementation | Initially failed because verified requirements dropped structured provenance and the renderer emitted no source link. |
| Focused contract suite | Six FMDS evaluator/public/action/API/assistant/renderer suites | Pass | 6 suites, 20 tests. |
| Changed-file type guard | `pnpm --dir frontend run typecheck:changed` | Pass | No new `any` type debt. |
| Targeted lint | ESLint on task-owned frontend sources/tests | Pass | No errors. |
| Full frontend unit suite | `cd frontend && npm run test:unit -- --runInBand` | Fail — unrelated | Existing `action-tools.test.ts` audit-client mock lacks `.in`; likely owners `src/lib/ai/tools/action-tools.ts:444` and its mock. The verifier stopped duplicate/hanging Jest processes after roughly three minutes. |
| Full frontend TypeScript check | `cd frontend && NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit` | Fail — pre-existing repo debt | Default-memory run OOMed; bounded retry reached diagnostics but exited 2 with extensive unrelated debt. Adjacent errors: `api/asrs/chat/route.ts:70` error-code union and FMDS figure-review route fields inferred as `never`; neither is owned by this source-result contract. |
| Dedicated-ASRS migration | `20260722090000_add_fmds_rule_card_citation_source_ids.sql` | Pass | Applied through direct ASRS database URL after project-link CLI auth rejected its legacy token. |
| Migration ledger/readback | Supabase remote migration list; direct SQL count | Pass | Local and remote both show `20260722090000`; 13 of 13 rule-card citations now have `source_id`. |
| Canonical browser proof | Authenticated `https://projects.alleatogroup.com/asrs/intake/submitted/73704f27-097b-4eb1-9039-a18bd2f7804e` | Pass | Post-deploy release `77cd717` renders FMDS 8-34 Table 2.1.4.5.4, PDF page 12 as a canonical source link. Artifact: `/Users/meganharrison/.codex/visualizations/2026/07/22/019f88ed-e004-7b50-97e2-f067a71a90d6/fmds87-postdeploy-source-link.png`. |
| Publish checkpoint | `git commit --only` then `git push origin main` | Pass | Path-scoped fallback preserved concurrently staged files after `codex:finish` refused the shared index. Commit `ed7e25721` equals `origin/main`. |
| Authenticated production proof | ASRS intake submission `73704f27-097b-4eb1-9039-a18bd2f7804e` | Pass | Rendered a Reviewed FMDS 8-34 Table 2.1.4.5.4 link and resolved it to `/asrs/tables/95fec116-9f3c-4ee0-8eae-1a7b65003017`. Artifacts: `/Users/meganharrison/.codex/visualizations/2026/07/22/019f88ed-e004-7b50-97e2-f067a71a90d6/fmds87-reviewed-source-link.png` and `fmds87-canonical-table-proof.png`. |
| Provenance hardening migration | `20260722140000_harden_fmds_evaluator_provenance.sql` | Pass | Applied to dedicated ASRS; remote ledger matches local. Live escalated output now returns `batch1.tfs.noncompliance_escalation`; exact source/review-event integrity query returns 0 invalid citations. |
| Independent review | Reviewer re-review of the isolated corrective diff | Pass | Missing-page, escalation-rule, and stale-ID findings all resolved; the reviewer found no remaining blocking provenance issue. |
| Production deployment | Vercel `dpl_7FRPxAUxQ9mDv6mGVkxfsYLEY2cf` | Pass | Ready production deployment for commit `77cd717`, with `projects.alleatogroup.com` assigned as an alias. |

## Remaining Risk

- The currently approved rule coverage may not include a supported head-count calculation. Owner: later rule-card slice; next action: retain nonnumeric dependent outputs.
- Sprinkler head count remains intentionally unsupported by the reviewed Batch 1 rule set. Owner: the next reviewed rule-card slice; prevention: preserve the explicit `pending_review` result rather than estimating.
- The shared checkout still has unrelated staged work, but this task's exact file set is published. Continue using a clean or path-scoped publish boundary until its owner resolves the shared index.
- Full-unit baseline has an unrelated AI write-tool test failure; owner: the action-tools audit-client mock, not this FMDS result contract. Next action: repair in its own scoped task.
- No open risk blocks this source-backed evaluator slice. Future intake/head-count work remains separately review-gated.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
