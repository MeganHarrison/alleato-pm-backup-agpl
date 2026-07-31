# Handoff: 2026-07-22 - ALL-5 Schedule Resource Calendars and Leveling Preview

## Intake Block

1) Session ID: S218
2) Task ID: ALL-5
3) Linear issue: ALL-5 - Build Phase 4A schedule resources, assignments, and allocation
4) Linear URL: https://linear.app/alleato-group/issue/ALL-5/build-phase-4a-schedule-resources-assignments-and-allocation
5) Current status: Completed - Phase 4B is implemented, live-schema verified, browser tested, independently reviewed, and published through the governed workflow.
6) Files changed: two additive Supabase migrations; generated database types; capacity/allocation/leveling engines; resource service, guarded routes, hook, dialog, panel, task assignment integration, canonical schedule page, focused tests, authenticated E2E, architecture, task, evidence, and session-board documentation.
7) Commands/outcomes: 13 focused Jest suites / 85 tests passed; linked database types match; all three migration versions are applied; rollback-only mutation/CAS/bounded-read probes passed; authenticated Chromium E2E passed; cleanup readback is zero; targeted lint/guardrails passed. Repository-wide TypeScript/build remain bounded by unrelated existing errors and workstation heap limits, with no Phase 4B-owned diagnostic.
8) Evidence artifacts: `docs/ops/evidence/2026-07-22-schedule-resource-calendars-leveling/` contains schema/readback probes, cleanup proof, desktop/mobile screenshots, verification contract/result, and independent review record.
9) Top 3 findings: project capacity must remain explicitly distinct from enterprise availability; compare-and-swap is required to prevent editor overwrite; capacity and leveling must use one coherent database statement snapshot to avoid torn facts.
10) Next action: manually update/close Linear issue ALL-5 because active browser policy rejected `linear.app`; separately plan enterprise cross-project availability and project-keyed revision locking if those capabilities are prioritized.
11) Handoff path: `docs/ops/handoffs/2026-07-22-S218-schedule-resource-calendars-leveling.md`
12) Migration ledger evidence: Passed. Linked Supabase records `20260722161757`, `20260722172738`, and `20260722183059` as applied, and generated types match the live schema.

## Verification Contract

Verification contract: Required

- Focused capacity, allocation, leveling, service, route, and component tests must pass.
- The migration must be CLI-generated, applied to the linked Supabase project, and proven in the remote ledger.
- Readback must prove tenant-safe constraints, explicit grants/RLS, restricted fixed-search-path functions, manager-only replacement, snapshot count equality, and immutability.
- Rollback-only negative probes must reject direct DML, unauthorized, inactive, malformed, duplicate, and cross-project mutations.
- Authenticated desktop/mobile E2E must prove calendar editing, variable capacity, visible preview results/diagnostics, and invariant task dates.
- Independent code, database, and React reviews must approve before publication.

## Product and Architecture Boundary

- Only existing person rows in `schedule_resources` are configurable in this phase.
- Recurring shifts are modeled as weekday percentage-capacity overrides; hourly work calendars remain deferred.
- Effective capacity precedence is project non-working day zero, then dated resource exception, then recurring weekday override, then inherited 100 percent.
- Resource capacity is project capacity, not enterprise availability.
- Preview leveling may propose later dates but cannot write any task or calendar date.
- No Apply action, persistence table, mutation RPC, or task-update route will be added for the preview.
- Revision snapshots require separate resource-capacity provenance so older revisions are never presented as reconstructed fact.

## Linear Update

- ALL-5 still needs a manual status/comment update because the active browser policy explicitly rejected use of `linear.app`. No alternate browser, API, or indirect workaround was used.

## Known Operational Debt

- The existing revision transaction uses global `SHARE` locks. The safest Phase 4B change is to preserve the current consistency contract for the new source tables and record contention as follow-up, rather than mixing in a broad concurrency rewrite.
- Monolithic Next and TypeScript checks have exceeded practical workstation memory/time in prior phases; focused tests, exact schema gates, browser proof, and independent review remain release requirements.
