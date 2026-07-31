# Task: Financial Workflow and Training Freshness Follow-ups

Status: Complete with Deferred Render Verification
Owner: Codex SROOT-FOLLOWUPS
Created: 2026-07-27
Task ID: APP-FINANCIAL-TRAINING-FRESHNESS-20260727
Linear Issue: ALL-30 owns automated documentation-freshness findings.
Related Handoff:
`docs/ops/handoffs/2026-07-27-SROOT-financial-training-freshness-followups.md`

## Objective

Make the canonical financial journey reliable, keep automatically discovered
training resources behind admin review, feed human review outcomes into future
candidate selection, and replace silent documentation-freshness logging with a
scheduled, read-back-verified review delivery.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Financial failures were localized at their first runtime boundary before
  product edits.
- [x] The canonical financial workflow completes without unsolicited reloads
  or `ERR_NETWORK_CHANGED`.
- [x] Published training resources are revalidated idempotently; repeated
  changed/unavailable evidence enters admin review without overwriting the
  approved source.
- [x] Candidate discovery remains review-only; Archive requires reviewer
  feedback and Publish/Archive decisions are persisted.
- [x] Future candidate selection consumes published and archived examples:
  approved examples influence ranking and archived near-matches are rejected
  with the admin feedback surfaced in the outcome.
- [x] Weekday documentation freshness performs a real scan and delivers a
  specific finding to the existing Linear review issue with readback.
- [x] Admin authorization and human approval remain mandatory.
- [x] Scheduled failures are specific and fail after persisting/reporting their
  actionable outcome.
- [x] Independent review approves the high-risk change.
- [x] Exact task-owned files are published to `origin/main`.
- [x] The production GitHub workflow is dispatched and read back after
  publication.
- [x] The documentation generators complete on GitHub-hosted runners without
  direct IPv6 database access or Management API throttling.

## Runtime Localization

1. Webpack dev exceeded 6 GiB and reloaded during the financial form journey;
   the same route under Turbopack did not reload.
2. Stored Playwright authentication could contain a revoked JWT; auth setup
   trusted file age rather than Supabase `auth.getUser`.
3. The budget UI posted zero-dollar lines after contract execution without the
   API's required `allowZeroAmount` policy receipt, producing HTTP 400.
4. The prime-contract detail action had no route to the existing invoice
   creation owner.
5. Financial selectors drifted from canonical controls and sometimes selected
   hidden mobile duplicates or the Status select instead of Contract Company.
6. Candidate Archive persisted only status, so admins could not explain a
   rejection and future discovery could not use review outcomes.
7. Training freshness had no durable repeated-observation review owner.
8. The documentation schedule logged summaries but did not deliver them to an
   admin-owned review surface.
9. The first production scan proved delivery/readback but found the project map
   had been generated before concurrent main-branch changes were integrated.
10. GitHub-hosted runners could not route to the direct IPv6 Supabase database
    host.
11. The existing Management API fallback issued three queries per table and
    was throttled before it could build a complete 520-table inventory.

## Durable Changes

- The financial journey now uses a validated session, Turbopack isolation,
  exact labeled controls, exact POST/status assertions, and deterministic
  cleanup.
- Budget creation sends the server-owned zero-amount policy receipt, and prime
  contracts route into the canonical invoice form.
- Four applied Supabase migrations add idempotent freshness review state,
  constrained candidate reviewer feedback, and an atomic bridge from freshness
  decisions into the canonical good/bad examples consumed by discovery.
- The training review page reuses the existing resource card/queue and provides
  a single labeled feedback field with Archive and Publish actions.
- Weekday freshness promotes only repeated evidence and never mutates a
  published resource without admin action.
- Candidate discovery reads the latest approved/archived examples for the
  topic, prioritizes approved patterns, and rejects closely matching archived
  patterns.
- The documentation runner posts a Markdown finding to Linear ALL-30, reads the
  exact comment back, then fails loudly for blocked/failed findings.
- A weekday GitHub Action owns production scheduling and validates all required
  secrets/variables before scanning.
- The production documentation workflow now uses the Supabase HTTPS Management
  API for both databases, and the inventory generator loads complete
  stats/counts/column snapshots in three queries per database instead of three
  requests per table.
- The database inventory source now documents the 15 live tables that the
  production schema-drift gate found, including the training feedback/freshness
  tables and durable agent-runtime ledgers.

## Verification

| Boundary | Evidence | Result |
| --- | --- | --- |
| Financial browser journey | Playwright full financial workflow | 11/11 passed in 1.8m |
| Financial request contracts | Exact contract, budget, lock, modification, PO, subcontract, and invoice assertions | Passed |
| Training UI/data | Focused Jest | 5 suites / 30 tests passed |
| Finder/freshness | Focused pytest | 29 tests passed |
| Freshness live contract | `verify-training-resource-freshness-contract.mjs` | Passed live keep/archive feedback bridge plus write/readback/rollback |
| Freshness migration | Ledger `20260728003500` | Local and Remote |
| Review-feedback migration | Ledger `20260728013000` | Local and Remote |
| Freshness-feedback bridge | Ledgers `20260728021000`, `20260728022000` | Local and Remote |
| Admin freshness action | Browser screenshots plus database readback | Passed |
| Admin candidate feedback | Browser Archive plus database readback | Passed |
| Documentation agent | Typecheck and Eve info | Passed; 0 errors |
| Documentation delivery | Local comments `35d7bf…`, `842a5e…`; production comment `f07ac59f…`; exact readback | Passed |
| Workflow config | GitHub secret/variable names read back; YAML parsed | Passed |
| Production workflow | GitHub run `30321444676` on main commit `225d424d`; two findings delivered and read back before intentional blocked exit | Passed fail-loud contract |
| Production remediation | Complete MAIN/RAG Management API snapshots; 520 tables generated | Passed locally and in GitHub run `30322204176` |
| Inventory regression | `app-db-connection.test.mjs` | 4/4 passed |
| Frontend lint | Targeted ESLint | Passed |
| Frontend types | Bounded typecheck | Failed on 274 unrelated repo errors; 0 task-owned errors |
| Independent review | Required reviewer | Passed after feedback-bridge blocker was resolved |
| Publication/deployment | Initial exact publication `225d424d`; remediation `ab2b8696`; workflow dispatch/readback | Passed |

Detailed artifacts:
`docs/ops/tasks/2026-07-27-financial-training-freshness-followups-proof/`.

## Failure-Loudly Contract

- Financial actions assert the exact request path and successful response, so a
  missing request cannot age into a generic two-minute timeout unnoticed.
- Auth setup validates the token against Supabase before protected-route use.
- Training discovery/freshness names taxonomy, search, feedback-read, insert,
  and resource-check failures separately.
- The documentation runner refuses missing delivery configuration, persists a
  Linear finding, verifies the returned comment, and only then returns success
  or the specific blocked/failed status.

## Incident Learning

- Failure fingerprint: `ai.learning-review-boundary-drift`
- Root cause: stale environment/test assumptions and missing durable ownership
  at the auth, zero-amount policy, admin-feedback, repeated-freshness, and
  scheduled-delivery boundaries.
- Detection gap: earlier tests allowed optional controls, hidden duplicates,
  non-exact requests, file-age auth, console-only schedules, and status-only
  rejection.
- Prevention: exact request assertions, live auth validation, constrained
  review notes, feedback-aware candidate selection, repeated-observation
  freshness promotion, verified delivery readback, scheduled config gates, and
  batched fail-on-incomplete Management API snapshots.
- Guardrail evidence:
  `docs/ops/tasks/2026-07-27-financial-training-freshness-followups-proof/verification-summary.md`
- Release-candidate detection: the expanded live SQL contract caught a
  PostgreSQL enum-cast defect in the first feedback-bridge function before
  publication. A separate repair migration preserves the audit trail and the
  live contract now proves both Keep and Archive paths.

## Remaining Risk

- Render live-service configuration cannot be read or changed in this session
  because no Render API/CLI credential is available. The existing weekly
  finder and new weekday freshness cron are declared in `render.yaml`; live
  freshness-cron creation must be verified by a service administrator after
  providing a Render API token or connector, then reading back
  `alleato-training-resource-freshness-weekday`. This does not bypass review or
  auto-publish content.
- The local training review route still reports pre-existing/global
  accessibility issues from the project selector, orange button contrast, and
  the development Agentation overlay. The new feedback label/control is not
  implicated.

## Final Status

- [x] Independent review completed.
- [x] Exact-file publication receipt verified at `origin/main` commit
  `225d424dcdf6e044348cc87b90465aa59cd6d05d`, with production-scan
  remediation published at `ab2b8696ea0c1c349168180b89e233665a151f22`.
- [x] GitHub production workflow dispatch inspected.
- [x] GitHub production remediation workflow `30322204176` passed on
  `ab2b8696`, delivered the single non-blocking TABLE-LIST warning to Linear
  comment `02d7a595-3f2f-41e4-95d6-633456767d50`, and read it back exactly.
- [x] Deferred Render verification is recorded with the exact missing
  capability and next owner action.
