# Task: Record Auditable Field Schedule Updates

Status: Complete
Owner: Codex SROOT1189A
Task ID: AAI-1189
Linear: [AAI-1189](https://linear.app/megankharrison/issue/AAI-1189/enable-field-schedule-updates-with-impact-audit)
Canonical route: `/<projectId>/schedule`

## Contract

The canonical schedule task route gains a project-scoped field-update endpoint. It accepts actual start/finish, forecast start/finish, remaining duration, delay reason, notes, and attachment references; delay-relevant changes require a reason. Each accepted update creates an immutable audit record containing actor, timestamp, prior/new values, reason, and a server-calculated downstream-impact snapshot.

## Checklist

- [x] Red validation tests reject incomplete delay changes, fractional/invalid durations, and invalid date payloads.
- [x] Red route tests reject unauthenticated and cross-project task updates.
- [x] Migration adds field-update storage, immutable audit records, authorization, and read model.
- [x] Authorized update persists exact before/after values, actor, timestamp, reason, notes, attachments, and impact.
- [x] Focused tests are green and migration is applied/read back.
- [x] Independent review is accepted before closeout.

## TDD Evidence

- Red: `field-update-validation.test.ts` failed because the validation module did not exist; the reviewer rework also reproduced a failing fractional duration (`1.5`) acceptance case.
- Green: validation and endpoint coverage passes 2 suites / 8 tests, including delay reason, date/duration, attachment, unauthenticated, cross-project, and fractional-duration authorization paths.
- Migration ledger: `20260721230000_schedule_field_updates_audit.sql` and its downstream-impact CTE correction `20260721234500_fix_schedule_field_update_impact_cte.sql` are both applied and verified. The canonical API now invokes the authenticated atomic RPC.
- Green: the shared task-edit-modal tests pass 2 suites / 3 tests; the committed Playwright mobile acceptance test passes 1/1 against production, scrolling to, verifying in-viewport, and activating Record field update at 390×844.
- Canonical browser proof: production `https://projects.alleatogroup.com/43/schedule`, project 43, records the field update through the modal at desktop and mobile widths. Linear attachments: `6d598633-acc2-4810-9a55-7d114e2a88eb` (desktop) and `a88e4340-35ec-4359-920c-6d3cc0e1fe95` (mobile).
- Live audit readback: Install Sanitary Sewer recorded forecast finish `2025-04-22 → 2025-04-24`, remaining duration `5 → 3`, actor/timestamp, reason, note, attachment URL, and downstream-impact snapshot after the CTE correction.
- Full frontend typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` currently reports 293 unrelated baseline errors in daily briefs, feedback inbox, observability, Project Intelligence, RAG source-sync, AI chat, progress reports, and submittals. It reports no AAI-1189 modal or field-update errors.
- Independent re-review: passed on `f22236372`; it verified the two-migration chain, server-side whole-day validation, and the committed production mobile action test. No concrete blockers remain.

## Environment Incident and Guardrail

- Cause: production Vercel Supabase connection variables were present but empty, so a valid saved test session landed on `access-denied?reason=no-profile`.
- Detection gap: browser verification rejected only login redirects and could have recorded an authorization-denied page as evidence.
- Prevention: `scripts/agent-browser/agent-browser-verify.mjs` now classifies and fails on access-denied landings; its focused contract test passes 3/3. The primary Supabase production variables were restored from the existing secure configuration.
