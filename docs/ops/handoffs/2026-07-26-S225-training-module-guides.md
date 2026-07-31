# Handoff: 2026-07-26 - ALL-20 Training Module Guides (MDX)

## Intake Block

1) Session ID: S225
2) Task ID: ALL-20
3) Linear issue: ALL-20 - T6 Resource cards + guide viewer; migrate written guides
4) Linear URL: https://linear.app/alleato-group/issue/ALL-20
5) Current status: Done — committed and published to `origin/main`.
6) Files changed: `frontend/src/content/training-guides/{frontmatter.ts,pm-handbook.mdx,superintendent-handbook.mdx,alleato-pm-software-guide.mdx,README.md,__tests__/{frontmatter,guides}.test.ts}`, task + this handoff.
7) Commands/outcomes: `npx jest src/content/training-guides` -> 11 passed (4 frontmatter-parser tests + 7 content-guardrail tests, all written test-first). Typecheck/lint delegated to a sub-agent: zero errors/warnings in the new files (192 pre-existing unrelated typecheck errors elsewhere, untouched).
8) Evidence artifacts: test output above; no screenshots — no route renders these guides yet (that's route-wiring, outside this ticket's scope, same as ResourceCard/GuideViewer's original design).
9) Top findings:
   - Resource cards (`ResourceCard.tsx`, `TrainingLibraryView.tsx`) already existed from S221/S222 — "Resource cards" in T6's title was already done; this ticket's remaining scope was just the guide MDX conversion.
   - Deliberately did NOT add `gray-matter`/`next-mdx-remote` as a new dependency — wrote a small dependency-free `parseGuideFrontmatter` YAML-lite parser instead, since this is a content ticket, not the MDX-compilation route-wiring ticket. Documented clearly in the content README so the future route-wiring session knows this parser exists but isn't mandatory to use.
   - Frontmatter role assignments were inferred from each handbook's own "How to use it" text (e.g. PM Handbook explicitly names PEs/APMs/PMs), not invented — cross-checked against the 6 real seeded role slugs from T3's `resources.json`.
10) Next action: T8 (ALL-22, Resource Finder backend) is next. Scoped via research: reuse the existing Tavily `httpx` call pattern in `backend/src/services/agents/content_builder/tools.py`, follow `backend/src/services/url_resource_ingestion.py`'s fetch→vet→dedupe→write shape, call `create_training_review_candidate(...)` via `client.rpc(...)` per `backend/src/services/project_intelligence/projections/operating_record.py`'s RPC pattern, and mirror `backend/scripts/run_source_sync_health_recompute.py` for the cron entrypoint script (T9 territory, but the two are closely linked).
11) Handoff path: `docs/ops/handoffs/2026-07-26-S225-training-module-guides.md`
12) Migration ledger evidence: N/A — no migrations in this ticket's scope.

## Verification Contract

- Delivery lane: Standard (content + a validation guardrail; no schema/auth/money/deployment).
- TDD: `parseGuideFrontmatter` and the content-guardrail test were both written test-first (red confirmed: module/file not found before implementation).
- No live/browser proof: this ticket doesn't wire a route; `GuideViewer` (already built, outside this session) will consume these files once a future ticket compiles them into React.
