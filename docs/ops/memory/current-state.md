# Current State

Last updated: 2026-07-26
Owner: Engineering

## Current Focus

- Build a durable documentation and memory workflow in `docs/ops`
- Migrate high-value knowledge from legacy docs without carrying stale guidance
- Keep implementation guardrails aligned with actual code behavior
- Enforce a leader/worker orchestration model for parallel sessions
- Record production-facing regressions in `docs/ops/handoffs/` with root cause, detection gap, and prevention step
- Provide a single owner/developer handoff document that ties the repo maps, scripts, and guardrails together for feature-development onboarding

## Top 3 Priorities

1. Consolidate recurring failure patterns into one maintained source of truth.
2. Keep architecture and stack docs current enough to avoid wrong assumptions.
3. Enforce evidence-based completion (tests/logs/screenshots) in every handoff.
4. Finish the owner/developer handoff tracking step once Linear reauthentication is available.

## Active Risks

- Conflicting guidance across old docs (example: Playwright `networkidle` vs `domcontentloaded`).
- Drift between generated project-overview files and live codebase state.
- Repetition of process failures when fixes are not turned into guardrails.
- Prime contract owner/client selection can diverge from contract-company state unless the form keeps both IDs synchronized, which can leave the invoice-contact dropdown empty even when contacts exist on the selected company.
- Project Intelligence connector calls can stall before the compiler-wide
  timeout. The scheduler now records durable retries and protects the prior
  completed report; per-connector cancellation telemetry remains follow-up
  hardening.

## Open Blockers

- None

## Active Work (Live)

Reference: `docs/ops/orchestration/session-board.md`

| Session | Task ID | Status | Notes |
|---|---|---|---|
| LEADER | ORCH-000 | In Progress | Establishing orchestration control layer |
| S128 | DOCS-HANDOFF-2026-07-13 | Blocked | Drafted the owner/developer handoff; Linear reauth is required to complete tracking |
| S140 | AAI-1063 | In Progress | Building a repo-local conversation-derived frontend feedback ledger for Codex and Claude UI comments |

## Accepted Work

- 2026-06-19: Hermes/OpenClaw AI assistant plan accepted through Goal 7. Goal 1 net-policy closeout plus Goals 2-6 and Goal 7 slices G3, G6, C10, and G5 are task-complete, evidence-backed, Linear-commented, and published to `origin/main`. Review ledger entries S59-S68 are accepted.
- 2026-07-21: Project Intelligence architecture, scheduler recovery, source
  completeness, full-report authority, downstream projection governance, and
  production verification are documented in
  `docs/architecture/PROJECT-INTELLIGENCE.md` and
  `docs/ops/project-intelligence-runbook.md`.
- 2026-07-26: Training Module ALL-23 accepted. The canonical admin-only
  resource finder is live with dual authorization and server-enforced caps;
  the production flow added two review-only Procurement candidates, preserved
  the learner library, passed responsive proof, strict verification, and independent review.

## Next Actions

1. Roll out worker protocol usage across all active sessions.
2. Process first review queue entries and enforce acceptance/rework decisions.
3. Archive deprecated legacy pattern docs or add automated warning checks for canonical-only usage.
4. Add a targeted regression test for prime contract owner/client selection so invoice contacts stay populated when a company has contacts.
