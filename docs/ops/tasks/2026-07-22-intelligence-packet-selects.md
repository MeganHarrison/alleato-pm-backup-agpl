# Task: Bound Product Intelligence Packet Reads

Status: In Progress
Owner: Codex
Created: 2026-07-22
Task ID: AAI-1260
Linear Issue: AAI-1260 — https://linear.app/megankharrison/issue/AAI-1260/unblock-pre-commit-by-bounding-intelligence-packet-reads
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-intelligence-packet-selects.md`

## Objective

Replace both unbounded wildcard reads of `project_intelligence_packet_items` with the explicit column contract required by the repository guard.

## Scope

- `backend/src/services/intelligence/product_intelligence_packets.py`
- Focused packet-item unit coverage and this task's handoff.
- Excludes schema changes and packet behavior changes.

## Source of Truth

- Table definition: `supabase/migrations/20260721130000_project_intelligence_packet_items.sql`.
- Read contract: only fields consumed by `merge_item` and the existing list caller contract.

Verification contract: Required

## Acceptance Criteria

- [x] Existing-item merge receives every prior field it consumes.
- [x] List queries return the full table row contract without `select("*")`.
- [x] The intelligence no-wildcard guard and focused tests pass.
- [ ] The original sidebar commit can pass pre-commit without this blocker.

## Failure-Loudly Contract

- Cause surfaced as: the pre-commit no-wildcard check identifies exact file and line.
- Detection path: `scripts/audits/check-no-select-star-intelligence.mjs`.
- Recovery path: add any newly consumed column to the named projection constant and focused test before use.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Localization | Pre-commit output | Confirmed | Two wildcard reads at lines 88 and 99 block unrelated commits. |
| Focused tests | `python -m pytest backend/tests/test_product_intelligence_packets.py -q` | Pass | 4 tests passed. |
| Guardrail | `node scripts/audits/check-no-select-star-intelligence.mjs` | Pass | No wildcard read remains in the intelligence package. |

## Remaining Risk

- The explicit projection must be maintained if `merge_item` starts reading another persisted field.
