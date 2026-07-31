# Task: Source FM Global Figures from Staged ASRS FMDS Corpus

Status: In Progress
Owner: Codex S198
Created: 2026-07-20
Task ID: AAI-1202
Linear Issue: [AAI-1202](https://linear.app/megankharrison/issue/AAI-1202/source-fm-global-figures-from-staged-asrs-fmds-corpus)
Related Handoff: `docs/ops/handoffs/2026-07-20-S198-fmds-figures-page-source.md`

## Objective

Make the `/fm-global` Figures tab render the April 2026 FMDS figure corpus from the dedicated ASRS project while visibly preserving its current review status.

## Scope

- Read-only ASRS figures adapter, type/config contract, dashboard integration, focused tests, and authenticated route evidence.
- Explicit exclusion: activation, deterministic retrieval, review-state mutation, corpus ingestion, and ASRS schema migration.

## Source of Truth

- Canonical runtime/data owner: ASRS Supabase project `vqnnvpnoitqhijkztyhq`, `public.fmds_figures` joined to `public.fmds_corpus_revisions`.
- Existing shared primitives/services: `frontend/src/lib/fmds/fmds-tables.*`, `frontend/src/app/(main)/fm-global/page.tsx`, and `fm-global-dashboard-client.tsx`.
- Deprecated or parallel paths: PM APP `fm_global_figures` for this dashboard tab only.

Verification contract: Required

## Acceptance Criteria

- [ ] Figures tab reads only revision-scoped ASRS FMDS figures; it never falls back to PM APP figures.
- [ ] Revision and review state are visible, including `pending review`/`staging` when applicable.
- [ ] Configuration/query/empty-corpus failures are specific and actionable.
- [ ] Authenticated desktop and mobile evidence proves the user-visible result.

## Implementation Checklist

- [x] Inspect live `fmds_figures` schema, selected revision, and corpus counts.
- [x] Add a shared server-only figures adapter and tests that prohibit PM APP fallback.
- [x] Replace the dashboard tab's legacy query/config with the shared adapter result.
- [x] Preserve existing shared dashboard/table primitives and add no approval controls.
- [ ] Record focused checks and authenticated desktop/mobile artifacts.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] ASRS live readback proves revision-scoped figures exist.
- [ ] Authenticated canonical-route proof is recorded.
- [ ] Evidence artifacts are recorded.
- [ ] Task-owned files are published to `origin/feat/asrs-intelligence` and branch head is verified.

## Failure-Loudly Contract

- Cause surfaced as: named ASRS configuration, corpus-revision, query, or empty-corpus error.
- Detection path: adapter tests, dashboard error state, and service-role readback.
- Recovery path: configure the server credential or import the revision; never substitute legacy PM APP figures.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: revision-scoped adapter and explicit staging/review presentation.
- Guardrail evidence: focused source-contract test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file, AAI-1202, and S198 handoff | Pass | Scope and human-authority boundary captured before implementation. |
| ASRS schema/readback | Service-role REST readback | Pass | `FMDS0834` / `2026-04` is staging and has 61 figure rows with captions, evidence paths, confidence, and review metadata. |
| Focused tests | `pnpm --dir frontend exec jest src/lib/fmds/__tests__/fmds-tables.test.ts src/lib/fmds/__tests__/fmds-figures.test.ts --runInBand` | Pass | 4/4 tests. |
| Targeted lint | `pnpm --dir frontend exec eslint` on dashboard and figures adapter/tests | Pass | No findings. |
| Preview deployment | `project-management-agent-io4e05mqo-the-alleato-group.vercel.app` | In progress | Built from `feat/asrs-intelligence` after commit `2fca60f6a`; browser proof waits for Ready status. |

## Remaining Risk

- Figures remain candidate evidence until human review. The UI may display their status but cannot treat them as approved deterministic requirements.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
