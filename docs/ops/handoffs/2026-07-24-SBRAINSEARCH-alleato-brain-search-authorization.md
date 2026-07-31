# Handoff: 2026-07-24 — Alleato Brain search authorization

## Intake Block

1) Session ID: SBRAINSEARCH
2) Task ID: ALL-11
3) Linear issue: ALL-11 — Alleato Brain Phase 3
4) Linear URL:
   [ALL-11](https://linear.app/alleato-group/issue/ALL-11/alleato-brain-phase-3-rewire-routing-permissions-and-ai-retrieval)
5) Current status: focused verification and independent review pass; exact
   core publication is pending.
6) Files changed:
   - canonical AI tool guardrails
   - semantic, category, fallback, and source-specific retrieval
   - dedicated indexed email/Teams caller reachability
   - focused authorization and reachability tests
   - task, evidence, and this handoff
7) Commands run and outcome:
   - focused core Jest: 15 passed
   - dedicated caller Jest: 2 passed
   - targeted ESLint: pass
   - changed-file type debt gate: pass
   - source-specific RAG verifier: pass
   - chat architecture verifier: pass
   - patch hygiene: pass
   - independent review: APPROVED after three findings were fixed
8) Evidence artifact:
   `docs/ops/evidence/2026-07-24-alleato-brain-search-authorization/`
9) Top findings:
   - branch scope overrides retained legacy project scope
   - Finance remains fail-closed
   - project-pinned retrieval excludes company branches
   - indexed branch communications are allowed without widening project or
     live Graph communication access
   - all changed scope-query failures surface explicitly
10) Recommended next action: publish the verified core slice, then migrate the
    remaining ingestion sources.
11) Handoff path:
    `docs/ops/handoffs/2026-07-24-SBRAINSEARCH-alleato-brain-search-authorization.md`
12) Migration ledger evidence: N/A — no migration in this slice.
13) Task file:
    `docs/ops/tasks/2026-07-24-alleato-brain-search-authorization.md`
14) Verification manifest:
    `docs/ops/evidence/2026-07-24-alleato-brain-search-authorization/verification-manifest.json`
15) Verification result:
    `docs/ops/evidence/2026-07-24-alleato-brain-search-authorization/verification-result.json`

## Failure-Loudly Closeout

- Cause: project-only authorization assumptions remained in branch-migrated
  retrieval and communication wrappers.
- Detection gap: previous tests did not model dual-labeled branch records or
  the difference between indexed branch communications, project
  communications, and live Graph access.
- Prevention: one exact-scope predicate, a separate communication predicate,
  explicit scope-query errors, caller reachability tests, runtime retrieval
  regressions, and independent security review.
