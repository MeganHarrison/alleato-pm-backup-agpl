# Handoff: 2026-07-23 — Alleato Brain routing foundation

## Intake Block

1) Session ID: SBRAINROUTE2
2) Task ID: ALL-11
3) Linear issue: ALL-11 — Alleato Brain Phase 3
4) Linear URL:
   [ALL-11](https://linear.app/alleato-group/issue/ALL-11/alleato-brain-phase-3-rewire-routing-permissions-and-ai-retrieval)
5) Current status: Independent review approved; verification contract passes;
   ready for exact-path publication.
6) Files changed (absolute paths):
   - `/home/friday/.codex/isolated-workspaces/sbrainroute2-all-11-a7a023/backend/src/services/ingestion/project_assignment.py`
   - `/home/friday/.codex/isolated-workspaces/sbrainroute2-all-11-a7a023/backend/src/services/integrations/microsoft_graph/project_inference.py`
   - `/home/friday/.codex/isolated-workspaces/sbrainroute2-all-11-a7a023/backend/tests/test_project_assignment.py`
   - `/home/friday/.codex/isolated-workspaces/sbrainroute2-all-11-a7a023/backend/tests/test_project_inference.py`
   - `/home/friday/.codex/isolated-workspaces/sbrainroute2-all-11-a7a023/docs/ops/tasks/2026-07-23-alleato-brain-archived-routing-guard.md`
   - `/home/friday/.codex/isolated-workspaces/sbrainroute2-all-11-a7a023/docs/ops/evidence/2026-07-23-alleato-brain-archived-routing-guard/`
   - `/home/friday/.codex/isolated-workspaces/sbrainroute2-all-11-a7a023/docs/ops/learning/recurring-failures.yaml`
   - this handoff
7) Commands run and outcome:
   - Live Supabase readback: pass; project 1015 archived with two active rules.
   - Pre-fix real-service fixture: reproduced assignment to project 1015 at
     confidence 0.985.
   - `pytest -q backend/tests/test_project_assignment.py`: 22 passed,
     including warmed-cache, cache bypass, existing-scope preservation, and
     typed-target invariant cases.
   - `pytest -q backend/tests/test_project_assignment.py backend/tests/test_project_inference.py backend/tests/test_communication_project_backfill.py backend/tests/test_outlook_intake.py`:
     49 passed.
   - Post-fix live fixture through corrected service: unassigned; two stale
     rules logged.
   - `python3 -m py_compile ...`: pass.
   - `git diff --check -- <task-owned files>`: pass.
   - `npm run codex:finish -- --session SBRAINROUTE --no-push ...`:
     blocked as designed because the required independent
     verification manifest/result pair was not provided; staging was reversed
     without changing the worktree.
   - Ruff: unavailable in the installed Python environment; repository backend
     requirements do not declare Ruff.
8) Evidence artifact:
   `docs/ops/evidence/2026-07-23-alleato-brain-archived-routing-guard/runtime-localization.md`
   Verification manifest/result:
   `docs/ops/evidence/2026-07-23-alleato-brain-archived-routing-guard/verification-manifest.json`;
   `docs/ops/evidence/2026-07-23-alleato-brain-archived-routing-guard/verification-result.json`
9) Top findings:
   - The first divergence is the production DB → `ProjectAssigner` boundary.
   - Filtering only project-name matching is insufficient; explicit rules and
     contact signals also require the canonical eligible-project set.
   - Production currently has at least one archived project with active rules,
     so the regression is observable, not theoretical.
   - `assign_scope()` now converts mapped container projects into one
     Business Area target while keeping real projects project-scoped.
   - The Microsoft Graph adapter exposes the typed target with confidence and
     error gating; caller persistence migration remains next.
10) Recommended next action: publish this verified dependency boundary, then
    migrate caller persistence to the typed target.
11) Handoff file path:
    `docs/ops/handoffs/2026-07-23-SBRAINROUTE-archived-routing-guard.md`
12) Migration ledger evidence: N/A — no database migration in this slice.
13) Task file: `docs/ops/tasks/2026-07-23-alleato-brain-archived-routing-guard.md`
14) Verification manifest: `docs/ops/evidence/2026-07-23-alleato-brain-archived-routing-guard/verification-manifest.json`
15) Verification result: `docs/ops/evidence/2026-07-23-alleato-brain-archived-routing-guard/verification-result.json`

## Linear Updates

- Implementation checkpoint comment: posted 2026-07-23.
- Issue status: In Progress.
- Completion comment: pending publication; ALL-11 remains open for later slices.

## Current Status

The canonical archived-project guard, typed-target foundation, and shared Graph
adapter are implemented. Independent review initially found two defects; both
were corrected, independently reproduced, and approved. The verification
contract now passes. Caller write migration, branch-target rules, and retrieval
scope remain separate slices under ALL-11.

## Exact Next Step

Run `codex:finish` with the approved manifest/result pair and exact task-owned
paths, then migrate the first Graph persistence caller.

## Known Pitfalls

- Do not deactivate or delete the two Varsity Brands rules as the bug fix; that
  would leave every other archived project vulnerable.
- Do not add Outlook/Teams/Fireflies-specific archive checks; the shared
  `ProjectAssigner` boundary is the canonical owner.
- Existing project IDs are historical data and are not rewritten by this guard.
- Do not update ingestion callers to write both target columns; migrated callers
  must consume the exact `AssignmentTarget` returned by `assign_scope()`.

## Resume Commands

```bash
cd /home/friday/.codex/isolated-workspaces/sbrainroute-all-11-archived-719fbe
pytest -q backend/tests/test_project_assignment.py \
  backend/tests/test_communication_project_backfill.py \
  backend/tests/test_outlook_intake.py
git diff --check

cd /home/friday/.codex/isolated-workspaces/sbrainroutedoc-all-11-archived-315fe8
node scripts/ops/learning-registry.mjs audit \
  --task ../sbrainroute-all-11-archived-719fbe/docs/ops/tasks/2026-07-23-alleato-brain-archived-routing-guard.md
```

## Evidence

- Runtime localization and before/after fixture:
  `docs/ops/evidence/2026-07-23-alleato-brain-archived-routing-guard/runtime-localization.md`
- Regression owner: `backend/tests/test_project_assignment.py`
