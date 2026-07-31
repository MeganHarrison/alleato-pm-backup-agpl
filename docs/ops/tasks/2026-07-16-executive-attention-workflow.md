# Task: Executive Attention Workflow

Status: Ready for publish
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1102
Linear Issue: [AAI-1102](https://linear.app/megankharrison/issue/AAI-1102/create-an-owned-executive-attention-item-from-canonical-evidence)
Related Handoff: `docs/ops/handoffs/2026-07-16-S168-executive-attention-workflow.md`

## Objective

An executive can create, triage, assign, escalate, resolve, and audit one evidence-backed Executive Attention item from the canonical Daily Brief route.

## Scope

- Canonical `/daily-brief` Executive Attention workflow, backed by the AAI-1097 controlled RPC contract and AAI-1101 canonical-state seam.
- Authenticated executive API routes, focused tests, browser evidence, and task closeout artifacts.
- Excludes conflict disposition/history (AAI-1103), generic project tasks, new attention schema, and page-local data synthesis.

## Source of Truth

- Canonical runtime/data owner: `public.executive_attention_items` and AAI-1097 RPCs, read in the API layer only.
- Existing shared primitives/services: `frontend/src/lib/executive/executive-attention-conflicts.ts`, `frontend/src/lib/executive/executive-state.ts`, `frontend/src/app/daily-brief/page.tsx`, `frontend/src/components/ui/dialog.tsx`.
- Deprecated or parallel paths: generic `tasks` records and page-local Executive Attention table queries.

Verification contract: Required

## Acceptance Criteria

- [ ] An evidence-backed item has category, priority, impact of delay, accountable owner, due date, lifecycle, and immutable audit history.
- [ ] Critical and High items cannot proceed without required ownership, freshness, and evidence.
- [ ] AI may propose/rank/explain items but cannot silently close, downgrade, suppress, or resolve them.
- [ ] An authenticated executive flow is browser-proven with canonical-route screenshot evidence.

## Implementation Checklist

- [ ] Files/modules to change are listed before edits.
- [ ] Shared abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [ ] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a named evidence, freshness, ownership, lifecycle, or authorization requirement that prevented the action.
- Detection path: focused API/component tests and canonical `/daily-brief` authenticated browser flow.
- Recovery path: supply verified evidence/current packet freshness and named ownership before retrying; only an authenticated human can resolve or dismiss.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: API validation plus controlled AAI-1097 RPC boundaries.
- Guardrail evidence: focused API and workflow tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Hardened remote readback | `docs/ops/evidence/2026-07-16-executive-attention-workflow/remote-readback.md` | Pass | Item `d7560683-eb51-4f25-94fc-374711dbf8fe` resolved with evidence/history; authenticated direct lifecycle RPC execute is denied. |
| Browser proof | `aai-1102-hardened-resolved-desktop.png`, `aai-1102-hardened-resolved-mobile.png` | Pass | Visually reviewed canonical `/daily-brief` at desktop and mobile widths. |
| Independent review | `independent-review.md` | Pass | Independent review approved the final lifecycle authorization boundary. |

## Remaining Risk

- The canonical Daily Brief route is a custom executive layout; the workflow must preserve its reading-first visual hierarchy while keeping every attention item actionable.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
