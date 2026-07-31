# Handoff: Content Creator Operations

Status: Complete
Session: SCONTENT0731
Task: AAI-1303
Delivery lane: High-risk

## Outcome

Content Studio now gives creators one catalog with destination counts,
governance filters, saved views, owner/review/engagement columns, shared row
selection, and bounded bulk governance editing. Engagement is derived from
durable learning records and uninstrumented content is labeled `Not tracked`.

## Ownership

Exact task-owned paths are listed in
`docs/ops/tasks/2026-07-31-content-creator-operations.md`.

## Acceptance Contract

- One catalog remains authoritative.
- Engagement is derived only from durable progress/enrollment records.
- Uninstrumented content says `Not tracked`; it never reports a false zero.
- Bulk governance writes are atomic, admin-only, bounded, and explicit.
- The shared unified table owns filters, saved views, selection, and bulk edit.

## Migration Ledger Evidence

Applied and read back:

- `20260731180000 add_content_creator_operations`
- `20260731210000 align_content_creator_operations`

The second migration aligns every RPC with the existing app-admin route guard
and normalizes date-only review values to UTC calendar dates.

## Verification Evidence

- Focused Jest: 7/7 pass.
- Task-path ESLint: 0 errors, one non-blocking thin-route heuristic warning.
- Generated Supabase types: current.
- Database readback: pass, including anonymous denial, invalid field `22023`,
  missing item `P0002`, grants, function definitions, and both ledger entries.
- No task-path type errors. The repository-wide typecheck remains red on
  unrelated existing files.
- Independent review: four functional findings resolved; low residual risk is
  that action/RPC wiring is protected by integration readback, not a mocked unit test.

## Browser Artifacts

- `desktop.png`
- `desktop-bulk-edit.png`
- `mobile-390.png`
- `browser-proof.json`

## Noise Gate

- Preflight: pass.
- Primary user: content creator or executive reviewer.
- Primary job: find content requiring action and update it efficiently.
- Tier 1: title, placement, lifecycle, owner, review state, engagement, updated.
- Hidden until requested: reviewer, source, and secondary catalog metadata.
- Removal candidate: descriptive oversized create-menu rows.
- Simplified: compact create dropdown, no stat-card row, no parallel dashboard,
  and creator controls separated from the mobile title.
- Failure loudly: database and server-action errors remain visible; untracked
  engagement is labeled instead of inferred.

## Remaining Risk

Generic SOP and documentation readers do not yet emit a shared content-view
event, so those records intentionally show `Not tracked`. The next durable
slice is one reusable reader-boundary event, not page-specific counters.
