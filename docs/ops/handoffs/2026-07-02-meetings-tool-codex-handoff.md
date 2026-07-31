# Handoff: Meetings Tool → Codex (2026-07-02)

**Audience:** the Codex session taking over meetings work from Claude Code.
**State:** Phase 1 (foundation) is MERGED to production ([PR #641](https://github.com/MeganHarrison/alleato-pm/pull/641), merge `0e6f4831d`). Two post-merge hotfixes exist on branch `fix/meetings-detail-transcript-first` (see §3). **No AI features were built** — Phases 2–5 are design-only (see §4).

---

## 1. What this was supposed to be

A Procore-style Meetings tool (create meetings, agenda categories + auto-numbered items, company templates, convert-to-minutes, carryover across recurring meetings, item→task creation, attachments, PDF export), layered on top of the existing Fireflies transcript pipeline, followed by AI layers (transcript→action-item extraction, agenda pre-population, pre-meeting briefs, meeting memory, risk detection).

- Full plan (requirements + locked architecture + AI phase outlines): `docs/superpowers/plans/2026-07-01-meetings-tool.md`
- Procore ground-truth research: `docs/reports/procore-meetings-workflow.md`
- Execution ledger (every task, commit, review verdict, failure, and Megan's feedback): `/Users/meganharrison/Documents/alleato-pm/.superpowers/sdd/progress.md` (+ per-task reports `task-N-report.md` beside it)

## 2. What actually shipped (merged, live)

**Schema (PM APP `lgveqfnpkxvzbnnwuled`)** — migration `supabase/migrations/20260701090000_create_meetings_tool.sql` (+ trigger exemption `20260701230517`):
- `meeting_series` (project_id INT, name; unique per project) — stable series key for recurring meetings
- `meetings` (UUID; series_id, number unique-per-series, meeting_date, timezone, start/end_time, is_private, is_draft, `mode` agenda|minutes, overview, template_id, `transcript_document_id` TEXT → document_metadata.id, deleted_at)
- `meeting_attendees` (person_id → **people.id UUID**, attended BOOL for minutes-mode attendance)
- `meeting_categories` / `meeting_items` (position-ordered; items carry status open|in_progress|closed, priority, assignee_person_id → people.id, `origin_meeting_id`, `carried_from_item_id` — the carryover chain IS the "previous minutes" history)
- `meeting_templates` + `meeting_template_categories/items` (company-level, NO project_id, admin-write)
- Pattern C junctions `meeting_documents` / `meeting_item_documents`; `tasks.meeting_item_id`
- RLS: `current_is_app_admin() OR current_is_project_member(project_id::bigint)` pattern throughout
- **Backfill ran live:** 652 series / 1,346 meetings created from existing `document_metadata type='meeting'` rows, each linked via `transcript_document_id`.

**API** (~20 route files under `frontend/src/app/api/projects/[projectId]/meetings/**` + `api/admin/meeting-templates/**` + `api/meeting-templates`):
list-grouped-by-series/create (series upsert, number=max+1 w/ 23505 retry, template copy, default "Uncategorized Items" category), detail GET/PATCH/soft-DELETE, restore, convert (mode flip, reversible), link-transcript, categories/items CRUD + reorder (full-ordered-ids contract), items/[itemId]/tasks (creates `tasks` rows w/ meeting_item_id; needs a deterministic `document_metadata` stub `meeting-item-task-<itemId>` because tasks.metadata_id is NOT NULL — stub type `meeting_agenda_task` is pipeline-trigger-exempt and Files-UI-excluded), items/[itemId]/history (carryover chain walk), follow-up (new meeting in series carrying open items), attendees PATCH (attendance), pdf (GET, @react-pdf/renderer). **Every write is gated by a project-scoped meeting pre-fetch** (`assertMeetingInProject` in `frontend/src/lib/meetings/guards.ts`) — do not add a write route without it.

**Shared layer:** `frontend/src/lib/meetings/` — `domain.ts` (numbering "2.3" computed at read time, status derivation draft→awaiting_minutes→minutes, carryover selection), `schemas.ts` (Zod, dates YYYY-MM-DD, times HH:MM), `server.ts` (`loadMeetingDetail` → the `MeetingDetail` contract everything consumes; `loadPreviousMinutes`; `resolveMeetingDocumentId` — lets prep/digest routes accept both id shapes), `route-params.ts`, `guards.ts`. Hooks: `frontend/src/hooks/use-meetings.ts` + `use-meeting-templates.ts` (React Query; meetingKeys are (projectId, meetingId)-scoped; reorders are optimistic w/ rollback).

**UI:** series-grouped list at `/[projectId]/meetings` (UnifiedTablePage, recycle-bin tab w/ restore, server-param search/status), agenda detail experience (PageShell detail, inline-editable fields, attendees + attendance checkboxes, DocumentPicker attachments, agenda section w/ dnd-kit reorder + inline item editing + per-item tasks/previous-minutes/attachments, transcript + AI-summary panes ported behaviorally from Meetily [MIT, clone at `~/Documents/reference/meetily`]), admin template builder at `/meeting-templates`.

**Pipeline:** `backend/src/services/ingestion/fireflies_pipeline.py` — `_upsert_structured_meeting` auto-creates/links a meetings row per new transcript (idempotent by transcript_document_id, series by normalized title, number retry, failure-contained).

**Tests:** ~166 meetings unit/route tests; e2e `frontend/tests/e2e/meetings.spec.ts` (9/9: create→agenda→convert→minutes→follow-up→delete/restore); smoke entries in `scripts/api-smoke-contracts.mjs`; production build verified.

## 3. Post-merge hotfixes (branch `fix/meetings-detail-transcript-first` — CHECK ITS PR STATE before working on meetings)

Megan's production feedback drove two reversals:

1. **Transcript-first detail restored** (commit `d57965880`, browser-verified). The Phase 1 rewrite had made `/[projectId]/meetings/[meetingId]` the agenda layout for ALL meetings — wrong for the 1,346 past meetings whose whole value is the transcript. Now: that route renders the ORIGINAL transcript page (accepts both meetings-UUID and legacy document_metadata TEXT ids); the agenda layout lives at `/[meetingId]/agenda` and transcript-less planning meetings redirect there. **Do not resurface the agenda layout as the default for transcribed meetings.**
2. **Create form: modal → full page** (Task 19). The dialog had three defects Megan hit immediately: start/end time entry effectively unusable, attendee multi-select dead (combobox popover vs Radix dialog focus trap), and a modal is the wrong container for a flow meant to grow agenda/AI steps. Replacement: `/[projectId]/meetings/new` full form page; dialog deleted. See `task-19-report.md` for final state + root cause.

## 4. What was NOT built — the AI layers (the part Megan actually wanted)

Phases 2–5 in the plan are architecture-locked but **zero AI features shipped**. The AI content visible on transcript pages (segments, decisions/risks/tasks extraction, digest, prep) is the PRE-EXISTING pipeline, untouched. If you build next:

- **Phase 2 (highest value, cheapest):** `meeting_segments.tasks/decisions` already hold AI-extracted items per transcript. Missing: an endpoint correlating them to agenda items + a confirm panel that batch-creates `tasks` via the existing items/[itemId]/tasks route (attendee-aware assignee resolution → people.id). Also: transcript→pre-scheduled-meeting attach (series + date match) instead of always creating a new row.
- **Phase 3:** agenda suggestions from open RFIs/CEs/overdue tasks (reuse `backend/src/services/agents/deep_project_intelligence.py` probes); extend the existing `meeting_preps` `/prep/generate` with structured-agenda context. Add `meeting_items.source_type/source_id` columns when you do this.
- **Phase 4/5:** stale-item detection (recursive CTE over `carried_from_item_id`), "what did we decide" RAG tool scoped to a series' transcript doc ids, minutes-distribution email, risks → existing `insight_cards` spine.

## 5. Known debt / follow-ups (all pre-triaged; details in PR #641 body + ledger)

- Partial UNIQUE index on `meetings.transcript_document_id` (dup-guard is currently pre-select only)
- `prep/generate` runs on the service client with no project-membership check (**pre-existing** hole, not introduced) + prep/digest lack assertNonNilUuid
- Agenda reorder/reparent + template full-replace PATCH are Promise.all, not transactional → wants an RPC
- `meeting_templates.is_private` unenforced; hardcoded 8-zone US timezone list in the create form; PDF header omits series name; template-editor visual parity pass
- Backfill created one series per distinct transcript title → noisy Fireflies titles = many single-meeting series (a series-merge admin action would fix)
- Repo-wide, unrelated but will bite you: full jest has ~16 pre-existing failing suites and 38 typecheck errors in non-meetings files; `backend/tests/test_deep_project_intelligence.py` has a pre-existing collection error; the "Vercel – alleato-pm" PR check is a dead check that fails on every PR (ignore it; `alleato-hub` is the real one).

## 6. Gotchas that cost time (don't relearn these)

- `projects.id` INT, `people.id` UUID, `document_metadata.id` TEXT. `tasks.assignee_person_id` = people.id. `tasks.metadata_id` NOT NULL → the stub design in §2.
- The `changed-quality` required CI check greps ADDED lines for: empty catch blocks, `as unknown as`, and even the literal phrase "best-effort" in test titles. It scans COMMITTED diff vs origin/main — working-tree fixes don't clear it until committed.
- `docs/` is gitignored except an allowlist (architecture/design/patterns/ops/reference) — `git add -f` for new allowlisted docs.
- Frontend is pnpm-only at root; never commit a `frontend/package-lock.json`.
- RAG-DOCS-GATE: touching `fireflies_pipeline.py`/pipeline paths requires an AI-RAG-ARCHITECTURE.md or tables.yaml update in the same commit.
- Dev servers: one Next server per checkout; stale `.next` under a running server serves corrupted chunks (Uncaught SyntaxError in layout.js) — kill + `rm -rf .next` + restart.
- Playwright config: `frontend/config/playwright/playwright.config.ts`, honors `PLAYWRIGHT_BASE_URL`; auth via `tests/.auth/user.json` (refresh with `npx playwright test tests/auth.setup.ts`). TEST_USER_1 lacks project-67 access; use 47/876.

## 7. Open security item (unrelated to meetings, urgent)

Pushed commit `78ab97384` on origin/main contains `agents/project-intelligence-maintainer/.env.vercel.production` with LIVE Linear credentials (`LINEAR_API_KEY`, `LINEAR_AGENT_ACCESS_TOKEN`, `LINEAR_WEBHOOK_SECRET`). Rotate + remove + gitignore. A task chip exists (task_20e19b26).

## 8. Late addendum (2026-07-02, after §3): list page also reverted
Megan had the series-grouped list at `/[projectId]/meetings` reverted to the ORIGINAL transcript table (PR #661, commit 39239b3d8). Consequences for you: (a) structured planning meetings have NO list UI — they're reachable only via `/meetings/new` → `/[id]/agenda`; (b) the recycle-bin UI is gone (soft-delete/restore APIs remain, e2e covers them at the API level); (c) the deleted series-list code is in git history at commit 724b8e6ea if you want to salvage config from it. Megan's explicit direction: if series grouping is ever wanted, add it to the EXISTING table (it already has grouping/sort) — do not build a separate list page.
