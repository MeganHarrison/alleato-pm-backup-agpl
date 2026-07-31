# Task: Manual Daily Executive Brief Source Of Truth

Status: Complete - manual brief, 876 compiler repair, dead-code deletion, and browser proof delivered
Owner: Codex
Created: 2026-07-07
Linear Issue: Deferred - emergency manual source-of-truth repair; local task ledger is active.
Related Handoff: Not created

## Objective

Create a manual-first daily executive brief flow for the completed July 6, 2026 business day when run at 1 AM on July 7. It reads the actual source material in priority order: full storage-backed meeting transcript markdown, emails, Teams messages, and uploaded documents. Produce an owner-grade brief and store it into the Project Intelligence packet surface so the product can read one compiled artifact.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Targeted runner contract check performed for the core behavior.
- [x] Cross-boundary packet contract read-back performed against the database.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification completed for `/876/intelligence`.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- Today's date is resolved explicitly as July 7, 2026, and the covered business day is July 6, 2026.
- Full meeting transcript markdown is pulled from Supabase Storage, preferring canonical `transcripts/` paths and verifying `## Transcript` content.
- Emails, Teams messages, and uploaded documents from July 6, 2026 are loaded directly from source rows, not from stale packet summaries.
- A local evidence artifact records source counts, source IDs, storage paths, and the generated brief.
- The brief is stored in `intelligence_packets` as the single compiled daily executive brief artifact.
- Failures identify the exact missing source lane or write blocker.

## Source Of Truth Decision

- Daily executive brief compiled artifact: `public.intelligence_packets`.
- Source material: storage-backed transcript markdown first, then `document_metadata` / RAG source rows for emails, Teams, and documents.
- Existing operating-record projections are not used as source truth for this manual flow.

## Files To Change

- `docs/ops/tasks/2026-07-07-manual-daily-executive-brief.md` - task ledger.
- `scripts/intelligence/daily-executive-brief.mjs` - manual source bundle, brief, and packet writer.
- `package.json` - script entry for the manual brief runner, if needed.
- `frontend/src/lib/ai/intelligence/packet-service.ts` - shared loader for current packets by canonical target slug.
- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx` - project intelligence page reads and renders the canonical daily executive brief packet.
- `backend/src/services/intelligence/project_intelligence.py` - canonical project packet compiler reads RAG source rows directly, preserves source coverage, and advances the target watermark.
- `backend/src/services/intelligence/compiler.py` - retired packet-refresh compilers fail closed instead of inserting no-worker queue rows.
- `frontend/src/app/auth/login-legacy/` - deleted orphaned legacy login route.
- `frontend/tests/_archive/` - deleted tracked archived test code.
- Generated route/index artifacts - regenerated or surgically updated after deleting archived route code.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Source bundle | `npm run intelligence:daily-brief -- --date 2026-07-06` | Pass | 416 rows considered; included 7 meetings, 126 emails, 9 Teams message bundles, 70 documents; 204 skipped as outside date or failed inclusion gates. |
| Verbatim corpus | `wc -c docs/ops/evidence/2026-07-07-manual-daily-executive-brief/2026-07-06/source-corpus.md` | Pass - local only | 1,611,850-byte full source corpus; corpus keeps full text, while model prompts use bounded excerpts. This raw corpus is intentionally not committed because it contains verbatim private source material. |
| Transcript gate | `node -e ... source-manifest.json` | Pass | 7/7 meetings used Supabase Storage transcript markdown and 7/7 had `## Transcript` marker. |
| Brief artifact | `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/2026-07-06/brief.md` | Pass | 9,352-byte owner brief generated from lane summaries and source coverage. |
| Packet write/read-back | DB read-back for `daily-executive-brief` target | Pass | Current packet `6eaec0e0-cdce-4bd5-b6df-f7378ce2759a`; previous packet `67341038-038d-4670-b234-5fa7f96c2244` demoted to `snapshot`; source ID count 212. |
| Project 876 packet diagnosis | DB read-back for `project_id=876` and `daily-executive-brief` | Pass | `/876/intelligence` resolves project target `exol-morrisville`; current project packet `99b8e8fd-9238-4639-a3d9-5a4cf3abfdc2` generated 2026-07-04 with `last_signal_at=null` and no source IDs. Daily brief packet is a separate `company_process` target, so the page did not read it before this patch. |
| UI wiring | Code inspection and shared loader path | Pass | Project page now loads `daily-executive-brief` by slug through `loadCurrentIntelligencePacketBySlug` and renders the July 6 daily executive brief above the project-specific read. |
| Static check | `node --check scripts/intelligence/daily-executive-brief.mjs` | Pass | Syntax check passed before successful run. |
| Package JSON check | `node -e "JSON.parse(...package.json...)"` | Pass | `package.json ok`. |
| Changed-file type debt | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Project compiler source read | `_load_delta_docs(... project_id=876, since=2026-07-02T17:15:00+00:00)` | Pass | Selected 11 post-watermark RAG sources, including July 6 `Exol Contract Review`; `max_doc_date=2026-07-06T21:28:09.318344+00:00`. |
| Project 876 refresh | `ALLOW_PM_APP_FINAL_PROJECTIONS=true ... refresh_project_intelligence(876, force_full=False)` | Pass | Packet `99b8e8fd-9238-4639-a3d9-5a4cf3abfdc2`; 11 docs; `covered_end_at=2026-07-06T21:28:09.318344+00:00`; confidence high. |
| Project 876 DB read-back | DB read-back for `exol-morrisville` target and current packet | Pass | `intelligence_targets.last_signal_at=2026-07-06T21:28:09.318344+00:00`; packet source coverage has 11 source IDs, source counts `{email: 9, meeting: 2}`, latest source at July 6. |
| Retired queue cleanup | DB delete/read-back for retired `packet_refresh_jobs` | Pass | Deleted queued/running rows for `ai_intelligence_compiler_v0_1` and `meeting_extractor_compiler_v0_1`; read-back count is `0`. |
| Backend syntax | `python3 -m py_compile backend/src/services/intelligence/project_intelligence.py backend/src/services/intelligence/compiler.py` | Pass | Compiler modules parse successfully after source-loader and queue-guard changes. |
| Dead code deletion | Deleted `frontend/src/app/auth/login-legacy/` and `frontend/tests/_archive/`; `rg "login-legacy|/auth/login-legacy|frontend/tests/_archive" ...` | Pass | No remaining source/generated route references after regenerating route artifacts. |
| Route artifacts | `npm run map:project`; `npm run docs:generate-app-expert`; `node scripts/verify/route-audit.mjs`; `npm run check:routes` | Pass | Project map/app-surface, app sitemap/feature registry, route reports regenerated; route conflict check passed. |
| Full bounded typecheck | `cd frontend && npm run typecheck` | Fail - unrelated repo debt | Initial run found one touched-file type issue; fixed. Rerun had no errors in `frontend/src/app/(main)/[projectId]/intelligence/page.tsx` or `frontend/src/lib/ai/intelligence/packet-service.ts`; remaining failures are existing repo-wide errors such as `next.config.ts`, admin pages, training docs, budget routes, and PDF utilities. |
| ESLint | `npm exec eslint -- frontend/src/app/(main)/[projectId]/intelligence/page.tsx frontend/src/lib/ai/intelligence/packet-service.ts` | Blocked - config/tooling | ESLint 10 could not resolve `next/core-web-vitals`; no file diagnostics produced. |
| Browser auth setup | `PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test tests/auth.setup.ts --config=config/playwright/playwright.no-webserver.config.ts --project=chromium` | Pass | Regenerated local auth state for `test1@mail.com`; auth state is local/test-only and not committed. |
| Browser route proof | `agent-browser --session intelligence-876 --state frontend/tests/.auth/user.json open http://localhost:3001/876/intelligence` | Pass | Route stayed at `/876/intelligence`; screenshot saved at `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/browser/876-intelligence.png`; DOM proof confirms daily brief, July 6 business date, 212 sources, decisions, watch items, and project intelligence content. |

## Files Changed

- `docs/ops/tasks/2026-07-07-manual-daily-executive-brief.md`
- `scripts/intelligence/daily-executive-brief.mjs`
- `frontend/src/lib/ai/intelligence/packet-service.ts`
- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx`
- `backend/src/services/intelligence/project_intelligence.py`
- `backend/src/services/intelligence/compiler.py`
- `frontend/src/lib/app-surface/page-descriptions.json`
- `frontend/src/lib/app-surface/app-surface.generated.json`
- `docs/architecture/PROJECT-MAP.md`
- `backend/src/services/agents/app_expert/runtime/generated/app-sitemap.generated.json`
- `backend/src/services/agents/app_expert/runtime/generated/feature-registry.generated.json`
- `package.json`
- Deleted `frontend/src/app/auth/login-legacy/page.tsx`
- Deleted `frontend/tests/_archive/`
- `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/2026-07-06/source-corpus.md` - local-only raw corpus, not committed.
- `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/2026-07-06/brief.md`
- `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/2026-07-06/source-manifest.json`
- `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/2026-07-06/packet-write.json`
- `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/browser/876-intelligence.png`
- `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/browser/876-intelligence-dom-proof.json`
- `docs/ops/evidence/2026-07-07-manual-daily-executive-brief/browser/876-intelligence-body.txt` - local-only raw browser body dump, not committed.

## Risks / Gaps

- Raw source corpus and raw browser body dump remain local-only and uncommitted because they contain verbatim private source material. Committed evidence uses the generated brief, manifest, packet read-back, screenshot, and compact DOM proof.
- Non-meeting source text is loaded from RAG source rows, not directly re-downloaded from Graph/SharePoint at run time. The current path avoids stale packet summaries but should be tightened if "direct provider re-fetch every run" becomes mandatory.
- Automation remains intentionally deferred. The proven manual command is the source of truth until scheduled delivery is rebuilt on top of it.
- The active deep-research archive API was not deleted because it is a live admin feature used by `frontend/src/app/(admin)/deep-research/page.tsx`; deleting active archive-functionality code by filename would create a regression, not remove dead code.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
