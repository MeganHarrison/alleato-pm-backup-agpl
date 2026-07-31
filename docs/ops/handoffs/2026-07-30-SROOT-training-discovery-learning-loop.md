# ALL-54 — Self-Improving Training Discovery Loop

Status: Complete
Session: SROOT-ALL54
Linear: https://linear.app/alleato-group/issue/ALL-54/build-self-improving-training-resource-discovery-loop
Task: `docs/ops/tasks/2026-07-30-training-discovery-learning-loop.md`

## Ownership

- `backend/src/services/training/{finder.py,contracts.py,learning.py}`
- Focused backend training finder/learning tests
- Existing training review route, data-access module, and focused tests
- `frontend/src/types/database.types.ts`
- New training discovery migration and SQL verification
- This task and handoff

Unrelated dirty files, including WebViewer assets, commitment permissions work, the training library page, and existing browser artifacts are explicitly excluded.

## Acceptance Contract

- Human review remains the only publication path.
- Finder runs and candidate outcomes are auditable.
- Structured reviewer decisions improve later query selection and ranking.
- Exact video identities and near-duplicate fingerprints are enforced.
- Policies are versioned, evaluated, explainable, and reversible.
- Final authenticated desktop and mobile evidence is captured from `/training/review`.

## Progress

- Repository state and existing finder/review feedback loop inspected.
- ALL-54 created and canonical-checkout lease acquired.
- Versioned discovery policies, run/candidate ledgers, fingerprints, structured feedback, metrics, and activation/reversal gates are live in Supabase.
- Finder now learns from reviewer outcomes, allocates bounded exploration across query strategies, explains scores, and rejects exact/near duplicates.
- Candidate creation, fingerprinting, and audit persistence are one database transaction.
- Concurrent discovery runs serialize by topic and repeat canonical/external/fingerprint checks inside the database transaction.
- Structured review locks the resource row, returns a specific stale-decision error, and atomically records feedback with the lifecycle change.
- Existing weekly Render cron remains the scheduled discovery owner and now records `weekly` trigger evidence.
- Review UI captures reason codes, three ratings, notes, score explanations, and learning performance while preserving entered values after validation/save failures.

## Evidence

- Backend: 37 focused pytest tests pass.
- Frontend: 35 focused Jest tests pass; changed frontend files pass ESLint.
- Backend learning/finder files and focused tests pass Ruff check/format.
- Generated `database.types.ts` matches the linked Supabase schema.
- Live linked SQL contracts pass for the learning loop and existing training library.
- Supabase ledger readback records migrations `20260730173000`, `20260730201000`, `20260730202000`, and `20260730203000`.
- Independent standards review passed after transaction, terminal-state, accessibility, stale-review, and concurrency findings were fixed.
- Independent spec review found no remaining implementation-level defect.
- Full frontend TypeScript check remains red on unrelated owner files across admin, CRM, AI, recruiting, and scheduling; its only ALL-54 error was corrected.
- Initial backend deployment `dep-d9lp2lflk1mc73ccpj4g` exposed a stale whole-file admin API overwrite. The file was reconciled to the current Vercel Workflow owner, 37 focused tests passed from a current `origin/main` worktree, and corrected revision `e3c5c7555772f7608f5939bbef651762b3de1058` is live as Render deploy `dep-d9lpaeht0dsc73e9rf30`.
- Backend `/health` is healthy and the live OpenAPI contract includes the policy version, run ID, and query evidence fields.
- Weekly discovery build `bld-d9lpaf9t0dsc73e9rgf0` succeeded from the corrected revision.
- Vercel deployment `dpl_GpAMQfsr3hLfQSLsmxpcE9NoX1DE` is READY and owns `https://projects.alleatogroup.com`.
- Authenticated production review found one discovery-learning panel and 28 structured publish/archive forms.
- Desktop and 390px mobile evidence are saved under `tests/agent-browser-runs/2026-07-30-training-discovery-learning-loop/`.

## Remaining Work

- None. Close ALL-54 after the final evidence-only publication.
