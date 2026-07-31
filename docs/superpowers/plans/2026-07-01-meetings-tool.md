# Meetings Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Procore-style Meetings tool — meeting CRUD with series/numbering, agenda categories + auto-numbered items, company-level templates, agenda→minutes conversion, carryover/previous-minutes history, task creation from items, attachments, PDF export — layered ON TOP of the existing Fireflies transcript pipeline, then (phases 2–5) the AI layers.

**Architecture:** New relational tables (`meetings`, `meeting_series`, `meeting_attendees`, `meeting_categories`, `meeting_items`, `meeting_templates` + children) in the PM APP Supabase project, linked to the existing transcript world via `meetings.transcript_document_id → document_metadata.id`. The Fireflies pipeline is NOT touched — it keeps writing `document_metadata`/`meeting_segments`; the new tool links to its output. UI is assembled entirely from existing components: `UnifiedTablePage` (list), `PageShell` + `PageTabs` + detail-page components (detail), dnd-kit `Sortable` (reorder), Pattern C junctions + `DocumentPicker` (attachments), `@react-pdf/renderer` (export).

**Tech Stack:** Next.js 15 App Router, Supabase (PM APP `lgveqfnpkxvzbnnwuled`), React Query hooks, RHF + Zod, `withApiGuardrails` API routes, dnd-kit, @react-pdf/renderer, Jest + Playwright.

## Research inputs (read these before executing)

- Procore ground truth: `docs/reports/procore-meetings-workflow.md` (created 2026-07-01 from RAG + support-site fetch)
- Existing infra + patterns: summarized in "Locked architecture decisions" below — verified against the live codebase 2026-07-01.
- External UI donor repo: `Zackriya-Solutions/meetily` (MIT) — use as a reference/port source for transcript and AI-summary interaction patterns, not as the app architecture or API contract source of truth.

## Global Constraints

- `projects.id` is **INTEGER**, `people.id` is **UUID**, `document_metadata.id` is **TEXT**. Never mix these up.
- `tasks.assignee_person_id` → `people.id` (UUID). Agenda-item assignees use `people.id` too.
- All new API routes: `withApiGuardrails` + `getApiRouteUser()` + Zod validation + `assertNonNilUuid` for UUID path params (NOT for integer `projectId`). Never return generic errors.
- All UI from existing components — invoke `Skill("alleato-table-page")` before the list page and `Skill("alleato-detail-page")` before the detail page. No raw grids, no hardcoded colors, no card borders, `<ExpandingSearch>` for search, `<SectionAction>` in headings, `EmptyState` for empties. Empty field renders nothing (no "—").
- Dynamic route params: `[meetingId]`, `[categoryId]`, `[itemId]`, `[templateId]` — never `[id]`. Run `npm run check:routes` after creating routes.
- Run `npm run db:types` after the migration and before writing any query code.
- New tables MUST be added to `docs/architecture/tables.yaml` + `npm run db:inventory` in the same commit as the migration (pre-commit gate).
- Heavy verification (typecheck/build/full suites) delegated to a background Haiku sub-agent; main thread runs only targeted checks.
- Git: branch `feat/meetings-tool` off fresh `main`; never commit to `main`. Commit at the end of each task.
- Procore status semantics: `is_draft=true` → **Draft**; `mode='agenda'` → **Awaiting Minutes**; `mode='minutes'` → **Minutes**. Convert-to-minutes is reversible (Procore has "Revert to Agenda Mode").
- Every new meeting auto-gets one category named **"Uncategorized Items"** (Procore behavior).
- Item numbering (`1.1`, `2.3`) is **computed at read time** from category position + item position — never stored.

---

## Locked architecture decisions (do not re-litigate during execution)

| Decision | Choice | Why |
|---|---|---|
| New `meetings` table vs extend `document_metadata` | **New table** | `document_metadata` is a flat document catalog owned by the Fireflies/Graph pipeline. Agenda structure is relational (categories/items/attendees). Link via nullable `transcript_document_id`. |
| Series modeling | `meeting_series` table (id, project_id, name), `meetings.series_id` FK | Grouping by name-string breaks on rename; carryover intelligence needs a stable series key. "Create follow-up meeting" = same series, number+1. |
| Existing `/api/projects/[projectId]/meetings` routes | **Rewritten** to serve the new `meetings` table; a backfill migration creates one `meetings` row per existing `document_metadata` `type='meeting'` row (title, date, transcript link, participants → attendee names snapshot) | One meetings surface. Old transcript-viewer pages become the "Transcript" tab of the new detail page. Fireflies keeps writing `document_metadata`; a lightweight sync (Task 4) auto-creates/links a `meetings` row for new transcripts. |
| Previous minutes / carryover | `meeting_items.carried_from_item_id` chain + `origin_meeting_id` | Walking the chain reconstructs an item's full history across the series — no denormalized history table. |
| Item→Task link | `tasks.meeting_item_id` nullable UUID column | Complements existing `tasks.segment_id`/`metadata_id`; simplest queryable link. |
| Attachments | Pattern C junctions `meeting_documents` + `meeting_item_documents`, wired into `user_can_access_entity()` and `frontend/src/lib/documents/pattern-c-attachments.ts` registry | House standard; `DocumentPicker`/`LinkedDocumentsList` work for free. |
| Templates scope | Company-level (`meeting_templates` has NO project_id), admin-write, all-read | Matches Procore Admin-tool templates; "no project-specific info in templates". |
| Item status values | `open` \| `closed` (+ `in_progress` accepted for our tasks-style workflow) | Procore items are Open/Closed; spec asked for in_progress — cheap to allow. |
| Related Items / Emails / Change History tabs | **Deferred to a follow-up slice** (not Phase 1 tasks) | Noise gate: don't ship empty tabs. Change-history needs an audit-log design of its own. |
| Rich text for overview/description/minutes | Plain textarea in Phase 1 (markdown-tolerant), Lexical upgrade as a later slice | Lexical exists (training-docs) but wiring it into agenda items is polish, not core workflow. |

Reference implementations to copy from (verified paths):
- List page: `frontend/src/app/(main)/[projectId]/commitments/page.tsx` + `frontend/src/features/commitments/commitments-table-config.tsx`
- Detail page: `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx`
- API CRUD: `frontend/src/app/api/commitments/[commitmentId]/route.ts` (guardrails + Zod + soft delete/restore/permanent-delete)
- Reorder: `frontend/src/components/ui/sortable.tsx` (dnd-kit wrapper: `Sortable`/`SortableContent`/`SortableItem`/`SortableItemHandle`)
- PDF: `frontend/src/app/api/projects/[projectId]/prime-contract-change-orders/[primeCoId]/pdf/route.ts` + `frontend/src/lib/prime-co-pdf.ts`
- AI write tool: `frontend/src/lib/ai/tool-registry.ts` + `tool-descriptors.ts` + `tools/action-tools.ts` (`confirmedWriteDescriptorDefaults`)
- Existing meetings surfaces being subsumed: `frontend/src/app/(main)/[projectId]/meetings/**`, `frontend/src/hooks/use-meetings.ts`, `frontend/src/app/api/projects/[projectId]/meetings/**` (keep `/prep`, `/digest` endpoints working — they key off the transcript document id, which remains reachable via `meetings.transcript_document_id`).
- Meetily donor surfaces worth reviewing before detail-page work:
  - `frontend/src/components/MeetingDetails/TranscriptPanel.tsx`
  - `frontend/src/components/MeetingDetails/SummaryPanel.tsx`
  - `frontend/src/components/VirtualizedTranscriptView.tsx`
  - `frontend/src/components/EditableTitle.tsx`
  - `frontend/src/components/AISummary/BlockNoteSummaryView.tsx`
  - `frontend/src/hooks/meeting-details/useMeetingData.ts`
  - `frontend/src/hooks/meeting-details/useTemplates.ts`

---

## Meetily adoption strategy

Meetily is a useful donor for the **detail experience layer**. It is not a good source for our routing, storage, API contracts, permissions, or page shells.

### Borrow directly as patterns or partial ports

- **Transcript pane composition**: fixed side pane + virtualized transcript list + copy actions from Meetily's `TranscriptPanel` / `VirtualizedTranscriptView`.
- **Editable title ergonomics**: click-to-edit title flow from `EditableTitle`, but rebuilt on Alleato buttons/inputs/tokens and routed through our inline-save field pattern.
- **Summary work area structure**: split between summary toolbar, editable summary body, and transcript context from `SummaryPanel`.
- **Format-tolerant summary persistence idea**: Meetily's `BlockNoteSummaryView` is a strong reference for handling markdown + structured JSON without data loss.
- **Template-selection UX**: the lightweight "selected template + generate" interaction in `useTemplates` / `SummaryGeneratorButtonGroup` is a good model for our admin-defined meeting templates and future AI-summary actions.

### Rebuild on Alleato primitives instead of copying markup

- Any header, tabs, page shell, list page, or detail layout.
- Any dialog, button group, input, popover, or menu styling.
- Any summary editor shell that would introduce raw Tailwind colors, nested cards, or Meetily-specific component structure.
- Any transcript row styles; keep the behavior, not the visual language.

### Do not import from Meetily

- Tauri calls (`invoke`, folder-open, local model settings, retranscription, local file assumptions).
- Sidebar/global meeting state patterns tied to their desktop app.
- Their model-provider configuration, analytics, and local-language preference storage.
- Their data model assumptions (`meeting.transcripts`, local folders, built-in AI providers) where Alleato already has Supabase/Fireflies contracts.

### Implementation rules for reuse

- If code is copied or heavily ported from Meetily, keep the required MIT attribution notice in the copied file header or in a nearby attribution note per the license.
- Port behavior into shared Alleato seams first (`components/ui`, `components/domain/meetings`, shared hooks) instead of pasting page-local one-offs.
- Preserve Alleato's API contracts and route ownership. Meetily may inform the view model, but it does not define the payload shape.
- Favor "behavioral ports" over literal copies: virtualized transcript loading, summary editor state handling, and title-edit UX should be adapted to our tokens and guardrails.

### Task-order impact

- Treat Meetily review as a prerequisite for Tasks 9-13.
- Prioritize transcript/detail/summary UI slices before polishing list-page visuals.
- When a Meetily-derived pattern spans more than one page, extract the Alleato primitive first and then consume it in meetings.

## Execution ownership and session split

Use this section to assign work across the main Codex session, a dedicated UI port session, and verification/backend subagents.

### Owner roles

- **Main session**: owns contracts, integration seams, architectural decisions, orchestration, and final browser acceptance.
- **Dedicated UI session**: owns the Meetily-derived frontend port work end-to-end.
- **Backend/API worker**: owns bounded non-UI backend and API slices that do not overlap heavily with the UI files.
- **Verification worker**: owns long-running checks and compact failure reporting only.

### Recommended assignment by task

| Task | Scope | Recommended owner | Notes |
|---|---|---|---|
| Task 1 | Migration + types + table inventory | Main session or backend/API worker | Keep in main if migration sequencing is still changing. |
| Task 2 | Pure domain logic | Backend/API worker | Safe isolated slice. |
| Task 3 | Zod schemas + server loaders | Main session | Defines the detail-page contract the UI session depends on. |
| Task 4 | Meetings collection API | Main session | Locks the list/create payloads consumed by hooks and UI. |
| Task 5 | Meeting detail API | Main session | Must be stable before the UI port gets deep into detail work. |
| Task 6 | Agenda APIs | Backend/API worker with main-session review | Strongly related to UI, but the contract should land before full agenda UI. |
| Task 7 | Meeting templates API | Backend/API worker | Good isolated slice. |
| Task 8 | Fireflies transcript auto-link | Backend/API worker | Already a good worker candidate; keep separate from UI. |
| Task 9 | React Query hooks | Main session | This is the integration seam between APIs and the UI worker. |
| Task 10 | Meetings list page | Main session or small frontend worker | Keep separate from Meetily port; this page should stay Alleato-native. |
| Task 11 | Create meeting flow | Main session | Template chooser UX may borrow from Meetily, but the form contract stays here. |
| Task 12 | Meeting detail page shell + tabs + header | Dedicated UI session | Primary Meetily-derived port target. |
| Task 13 | Agenda section | Split: main session owns contract wiring, UI session may assist on editing ergonomics | Do not let this block Task 12/13A. |
| Task 13A | Transcript + AI summary experience port | Dedicated UI session | Primary Meetily-derived port target. |
| Task 14 | PDF export | Backend/API worker or main session | Independent of the Meetily UI port. |
| Task 15 | Admin template builder UI | Separate frontend pass later | Do not mix with the first Meetily port loop unless explicitly prioritized. |
| Task 16 | Regression rails + full verification | Verification worker | Long-running only; compact report back to main session. |

### Explicit handoff for the dedicated UI session

The dedicated UI session should own these files/surfaces first:

- `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx`
- `frontend/src/components/domain/meetings/meeting-detail-header.tsx` if extracted
- `frontend/src/components/domain/meetings/meeting-transcript-pane.tsx`
- `frontend/src/components/domain/meetings/meeting-summary-pane.tsx`
- any shared helper extracted for transcript virtualization or summary editing

The dedicated UI session should treat these Meetily files as donor sources:

- `frontend/src/components/MeetingDetails/TranscriptPanel.tsx`
- `frontend/src/components/MeetingDetails/SummaryPanel.tsx`
- `frontend/src/components/VirtualizedTranscriptView.tsx`
- `frontend/src/components/EditableTitle.tsx`
- `frontend/src/components/AISummary/BlockNoteSummaryView.tsx`
- `frontend/src/hooks/meeting-details/useMeetingData.ts`

The dedicated UI session should not own:

- Supabase schema changes
- API payload redesign
- route handler logic
- Fireflies pipeline work
- full-project verification

### Sequencing rules between sessions

- Do not send the dedicated UI session deep into implementation until Tasks 5 and 9 are stable enough to define the detail payload and hook shape.
- The UI session may build against mocked or temporary local view models first, but main session owns the final contract reconciliation.
- The backend/API worker should finish Task 6 before agenda UI is declared complete.
- The verification worker runs only after the main session says a slice is ready for expensive checks.

### Controller amendments (2026-07-01, after Tasks 1–6 landed)

Reality check + concrete mechanics, decided by the orchestrating session:

1. **Tasks 1–6 are DONE** in the main session's worktree (`/Users/meganharrison/Documents/alleato-pm-wt/meetings-tool`, branch `feat/meetings-tool`) via per-task subagents with review gates (Task 5 shipped with a Critical cross-project-write fix; Task 6 implemented, review in flight). The ownership table's rows for 1–6 are historical.
2. **One worktree = one writer at a time.** Sequential task subagents within the main session's worktree (current model) stay the default for Tasks 7, 8, 9, 10, 11, 13, 14, 15. Two agents committing to the same checkout race on the git index — parallelism requires a separate worktree, not just disjoint files.
3. **The dedicated UI worker (Tasks 12 + 13A) gets its own worktree**: branch `feat/meetings-detail-ui` cut from `feat/meetings-tool` AFTER Task 9 merges (plan's own sequencing rule: detail payload + hook shape stable first). It merges back into `feat/meetings-tool` (not main) when browser-verified. It is spawned as a long-running isolated agent with the handoff doc below; if Megan prefers to drive it as a literal separate Claude Code session instead, the same handoff doc + worktree work unchanged.
4. **Handoff doc location:** `docs/ops/handoffs/2026-07-01-meetings-detail-ui-handoff.md` — written by the main session at spawn time; must contain the MeetingDetail type + hook signatures verbatim, file ownership lists from this section, the Meetily adoption rules, the Meetily clone path, and the handoff-requirements checklist below.
5. **Meetily clone prerequisite:** clone `https://github.com/Zackriya-Solutions/meetily` (MIT) to `/Users/meganharrison/Documents/reference/meetily` (read-only donor; never a dependency). The donor paths listed in this plan are relative to that clone's `frontend/`.
6. **Task 13 seam contract:** main session builds `agenda-section.tsx` + `agenda-item-row.tsx` as self-contained components whose only inputs are `MeetingDetail` + the Task 9 hooks (no page-level assumptions); the UI worker composes them into the detail page. Whoever integrates second resolves conflicts in `[meetingId]/page.tsx` — expected to be the UI worker, since Task 13 lands first as components without rewriting the page.
7. **Task ordering from here:** 6-review → 7 → 8 → 9 → spawn UI worker (12+13A) → in parallel in the main worktree: 10 → 11 → 13 → 14 → 15 → merge UI branch → 16 (verification worker + verify-feature + PR).

### Handoff requirements for the dedicated UI session

Each UI-session handoff should include:

- changed files
- which Meetily files were ported or referenced
- what was copied directly vs behaviorally rewritten
- any required attribution note added for copied code
- unresolved integration assumptions about hooks or payloads
- browser evidence or the exact blocker preventing browser verification

---

# PHASE 1 — Core meeting + agenda management (this plan's tasks)

### Task 1: Database migration — all meetings tables

**Files:**
- Create: `supabase/migrations/20260701090000_create_meetings_tool.sql`
- Modify: `docs/architecture/tables.yaml` (add 8 entries)
- Regenerate: `frontend/src/types/database.types.ts` (`npm run db:types`), `docs/architecture/TABLE-LIST.md` (`npm run db:inventory`)

**Interfaces:**
- Produces: tables `meeting_series`, `meetings`, `meeting_attendees`, `meeting_categories`, `meeting_items`, `meeting_templates`, `meeting_template_categories`, `meeting_template_items`; junctions `meeting_documents`, `meeting_item_documents`; column `tasks.meeting_item_id`; extended `user_can_access_entity()` for `meeting` + `meeting_item`; backfilled rows from `document_metadata`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 20260701090000_create_meetings_tool.sql
-- Procore-style Meetings tool. Transcripts stay in document_metadata (Fireflies pipeline untouched).

create table public.meeting_series (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  series_id uuid not null references public.meeting_series(id) on delete restrict,
  number integer not null default 1,
  name text not null,
  meeting_link text,
  location text,
  meeting_date date,
  timezone text not null default 'America/Indiana/Indianapolis',
  start_time time,
  end_time time,
  is_private boolean not null default false,
  is_draft boolean not null default false,
  mode text not null default 'agenda' check (mode in ('agenda','minutes')),
  overview text,
  template_id uuid, -- FK added below after meeting_templates exists
  transcript_document_id text references public.document_metadata(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (series_id, number)
);
create index meetings_project_idx on public.meetings (project_id) where deleted_at is null;
create index meetings_transcript_idx on public.meetings (transcript_document_id);

create table public.meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  is_required boolean not null default true,
  attended boolean, -- null until minutes mode marks attendance
  created_at timestamptz not null default now(),
  unique (meeting_id, person_id)
);

create table public.meeting_categories (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index meeting_categories_meeting_idx on public.meeting_categories (meeting_id, position);

create table public.meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  category_id uuid not null references public.meeting_categories(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  description text,
  official_minutes text,
  assignee_person_id uuid references public.people(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  priority text check (priority in ('low','medium','high')),
  origin_meeting_id uuid references public.meetings(id) on delete set null,
  carried_from_item_id uuid references public.meeting_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meeting_items_meeting_idx on public.meeting_items (meeting_id, category_id, position);
create index meeting_items_carried_idx on public.meeting_items (carried_from_item_id);

-- Company-level templates: NO project_id by design (Procore rule).
create table public.meeting_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  overview text,
  is_private boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.meeting_template_categories (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.meeting_templates(id) on delete cascade,
  name text not null,
  position integer not null default 0
);

create table public.meeting_template_items (
  id uuid primary key default gen_random_uuid(),
  template_category_id uuid not null references public.meeting_template_categories(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  description text,
  priority text check (priority in ('low','medium','high'))
);

alter table public.meetings
  add constraint meetings_template_fk foreign key (template_id)
  references public.meeting_templates(id) on delete set null;

-- Item -> task link (tasks.assignee_person_id already targets people.id)
alter table public.tasks add column meeting_item_id uuid references public.meeting_items(id) on delete set null;
create index tasks_meeting_item_idx on public.tasks (meeting_item_id);

-- Pattern C attachment junctions (document_metadata.id is TEXT)
create table public.meeting_documents (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  document_metadata_id text not null references public.document_metadata(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (meeting_id, document_metadata_id)
);

create table public.meeting_item_documents (
  id uuid primary key default gen_random_uuid(),
  meeting_item_id uuid not null references public.meeting_items(id) on delete cascade,
  document_metadata_id text not null references public.document_metadata(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (meeting_item_id, document_metadata_id)
);

-- RLS: same pattern as every other project entity
alter table public.meeting_series enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.meeting_categories enable row level security;
alter table public.meeting_items enable row level security;
alter table public.meeting_templates enable row level security;
alter table public.meeting_template_categories enable row level security;
alter table public.meeting_template_items enable row level security;
alter table public.meeting_documents enable row level security;
alter table public.meeting_item_documents enable row level security;

create policy meeting_series_member on public.meeting_series for all
  using (current_is_app_admin() or current_is_project_member(project_id::bigint))
  with check (current_is_app_admin() or current_is_project_member(project_id::bigint));

create policy meetings_member on public.meetings for all
  using (current_is_app_admin() or current_is_project_member(project_id::bigint))
  with check (current_is_app_admin() or current_is_project_member(project_id::bigint));

-- Child tables inherit access through the parent meeting
create policy meeting_children_attendees on public.meeting_attendees for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));
create policy meeting_children_categories on public.meeting_categories for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));
create policy meeting_children_items on public.meeting_items for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));
create policy meeting_docs_member on public.meeting_documents for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));
create policy meeting_item_docs_member on public.meeting_item_documents for all
  using (exists (select 1 from public.meeting_items i join public.meetings m on m.id = i.meeting_id
    where i.id = meeting_item_id
    and (current_is_app_admin() or current_is_project_member(m.project_id::bigint))));

-- Templates: everyone authenticated reads, admins write
create policy meeting_templates_read on public.meeting_templates for select using (auth.role() = 'authenticated');
create policy meeting_templates_write on public.meeting_templates for all using (current_is_app_admin());
create policy meeting_template_cats_read on public.meeting_template_categories for select using (auth.role() = 'authenticated');
create policy meeting_template_cats_write on public.meeting_template_categories for all using (current_is_app_admin());
create policy meeting_template_items_read on public.meeting_template_items for select using (auth.role() = 'authenticated');
create policy meeting_template_items_write on public.meeting_template_items for all using (current_is_app_admin());

-- Extend the shared Pattern C access helper (copy existing function body, add two cases):
--   when 'meeting' then exists(select 1 from meetings m where m.id::text = entity_id and ...member check...)
--   when 'meeting_item' then exists(select 1 from meeting_items i join meetings m on m.id=i.meeting_id where i.id::text = entity_id and ...)
-- (Apply by CREATE OR REPLACE of user_can_access_entity with the two new branches.)

-- Backfill: one meetings row per existing transcript meeting.
insert into public.meeting_series (project_id, name)
select distinct dm.project_id, coalesce(nullif(trim(dm.title), ''), 'Meeting')
from public.document_metadata dm
where dm.type = 'meeting' and dm.project_id is not null and dm.deleted_at is null
on conflict (project_id, name) do nothing;

insert into public.meetings (project_id, series_id, number, name, meeting_date, meeting_link, transcript_document_id, mode, created_at)
select
  dm.project_id,
  ms.id,
  row_number() over (partition by ms.id order by dm.date asc nulls last, dm.created_at asc),
  coalesce(nullif(trim(dm.title), ''), 'Meeting'),
  nullif(dm.date, '')::date,
  coalesce(dm.meeting_link, dm.fireflies_link),
  dm.id,
  'minutes', -- transcript exists => it already happened
  dm.created_at
from public.document_metadata dm
join public.meeting_series ms
  on ms.project_id = dm.project_id and ms.name = coalesce(nullif(trim(dm.title), ''), 'Meeting')
where dm.type = 'meeting' and dm.project_id is not null and dm.deleted_at is null;
```

Note for the implementer: before finalizing, `grep -n "user_can_access_entity" supabase/migrations/*.sql` and copy the LATEST full function body into this migration's `CREATE OR REPLACE`, adding the `meeting`/`meeting_item` branches — do not hand-write it from memory. Also verify `document_metadata.date` column type (text vs date) in `database.types.ts` and adjust the `nullif(...)::date` cast accordingly.

- [ ] **Step 2: Apply the migration to the PM APP project** (Supabase MCP `apply_migration` against `lgveqfnpkxvzbnnwuled`, or `npx supabase db push` if ledger is clean). Verify: `select count(*) from meetings;` returns > 0 (backfill ran).
- [ ] **Step 3: Regenerate types** — `cd frontend && npm run db:types`; confirm `meetings`, `meeting_items` etc. appear in `frontend/src/types/database.types.ts`.
- [ ] **Step 4: Register tables** — add all 10 new tables to `docs/architecture/tables.yaml` (`db: MAIN`, `domain: meetings`, `status: live`, purpose one-liners), then `npm run db:inventory`.
- [ ] **Step 5: Commit** — `git add supabase/migrations/... docs/architecture/... frontend/src/types/database.types.ts && git commit -m "feat(meetings): schema for Procore-style meetings tool + backfill"`

### Task 2: Pure domain logic — numbering, status, carryover (TDD)

**Files:**
- Create: `frontend/src/lib/meetings/domain.ts`
- Test: `frontend/src/lib/meetings/__tests__/domain.test.ts`

**Interfaces:**
- Produces:
  - `deriveMeetingStatus(m: {is_draft: boolean; mode: "agenda"|"minutes"}): "draft"|"awaiting_minutes"|"minutes"`
  - `numberAgenda(categories: {id: string; position: number}[], items: {id: string; category_id: string; position: number}[]): Map<string, string>` → item id → `"2.3"`
  - `selectCarryoverItems(items: {id: string; status: string}[]): string[]` → ids of open/in_progress items to carry into a follow-up meeting

- [ ] **Step 1: Write failing tests** covering: draft beats mode; agenda→awaiting_minutes; minutes→minutes; numbering sorts categories by position then items by position (1-indexed both axes, e.g. 2nd category 3rd item = `"2.3"`); empty category produces no numbers; carryover selects `open` + `in_progress`, excludes `closed`.
- [ ] **Step 2: Run** `cd frontend && npx jest src/lib/meetings/__tests__/domain.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** the three pure functions in `domain.ts` (sort, index, format — no I/O).
- [ ] **Step 4: Run tests** — expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(meetings): agenda numbering, status derivation, carryover selection"`

### Task 3: Zod schemas + server data layer

**Files:**
- Create: `frontend/src/lib/meetings/schemas.ts` (all request Zod schemas: `createMeetingSchema` {name, series_name?, meeting_date?, timezone?, start_time?, end_time?, location?, meeting_link?, is_private?, is_draft?, overview?, attendee_person_ids?: string[], template_id?}, `updateMeetingSchema` (partial), `createCategorySchema` {name}, `reorderSchema` {ordered_ids: string[]}, `createItemSchema` {category_id, title, description?, assignee_person_id?, due_date?, status?, priority?}, `updateItemSchema` (partial + `.refine` ≥1 field), `createItemTaskSchema` {title?, description?, assignee_person_id?, due_date?})
- Create: `frontend/src/lib/meetings/server.ts` — `loadMeetingDetail(supabase, projectId, meetingId)` returning meeting + attendees(+people names) + categories + items (+ computed `agenda_number` via `numberAgenda`, computed `status` via `deriveMeetingStatus`, item task counts) and `loadPreviousMinutes(supabase, itemId)` walking the `carried_from_item_id` chain (max 20 hops) returning `{meeting_number, meeting_date, official_minutes, status}[]`
- Test: `frontend/src/lib/meetings/__tests__/server.test.ts` (mock supabase client pattern — copy mock style from `frontend/src/lib/training-docs/__tests__/server.test.ts`)

**Interfaces:**
- Consumes: Task 2 functions.
- Produces: `MeetingDetail` TS type consumed by API routes (Task 4-6) and the detail page (Task 10-12).

- [ ] **Step 1:** Write failing tests: `loadMeetingDetail` composes numbering + status; `loadPreviousMinutes` walks a 3-link chain in order (oldest first) and stops on null.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS. **Step 5:** Commit `feat(meetings): schemas + server loaders`.

### Task 4: Meetings collection API — list grouped by series, create (rewrite existing route)

**Files:**
- Modify: `frontend/src/app/api/projects/[projectId]/meetings/route.ts` (full rewrite: GET + POST against new tables)
- Test: `frontend/src/app/api/projects/[projectId]/meetings/__tests__/route.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/projects/:projectId/meetings?search=&status=&deleted=exclude|only` → `{ series: [{ series_id, name, meetings: [{id, number, name, meeting_date, location, status, agenda_item_count, template_id, transcript_document_id}] }] }` (series sorted by most recent meeting date desc; meetings by number desc)
  - `POST /api/projects/:projectId/meetings` with `createMeetingSchema` body →
    1. upsert `meeting_series` by `(project_id, series_name || name)`
    2. `number = max(number)+1` in series
    3. insert meeting; insert attendees; insert default category `"Uncategorized Items"` (position 0)
    4. if `template_id`: copy template categories/items (template items get `origin_meeting_id = new meeting id`)
    5. return the full `MeetingDetail`

- [ ] **Step 1:** Failing route tests (mock `createClient`/`getApiRouteUser` like `frontend/src/app/api/assignment-inbox/assign/__tests__/route.test.ts`): unauthenticated → 401 GuardrailError; POST creates series + default category; POST with template copies items; GET groups by series and computes status.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement with `withApiGuardrails("projects/[projectId]/meetings#GET" / "#POST", ...)`. **Step 4:** Run — PASS.
- [ ] **Step 5:** Verify nothing else broke: the schedule page (`(main)/[projectId]/meetings/schedule/page.tsx`) and `use-meetings.ts` POST body shape changes — update `use-meetings.ts` `CreateMeetingInput` to the new schema in the same commit (hooks fully rebuilt in Task 9; here just keep types compiling).
- [ ] **Step 6:** Commit `feat(meetings): list/create API on new meetings tables`.

### Task 5: Meeting detail API — get, edit, soft delete, restore, convert/revert, transcript-link sync

**Files:**
- Modify: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/route.ts` (rewrite: GET returns `loadMeetingDetail`; PATCH `updateMeetingSchema` incl. attendee replace; DELETE sets `deleted_at`)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/restore/route.ts` (POST → `deleted_at = null`)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/convert/route.ts` (POST body `{mode: "minutes"|"agenda"}` → update `meetings.mode`; converting to minutes also sets `is_draft=false`)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/link-transcript/route.ts` (POST `{document_metadata_id}` → validates the doc is `type='meeting'` in same project, sets `transcript_document_id`)
- Test: `__tests__/route.test.ts` beside each

**Interfaces:**
- Consumes: `loadMeetingDetail`, `updateMeetingSchema`.
- Produces: endpoints used by hooks (Task 9) and detail page (Task 10). Keep existing `/prep`, `/digest` subroutes working: change their meeting lookup to resolve `meetingId` → `meetings.transcript_document_id` when the id is a meetings-table UUID (both routes currently expect a `document_metadata` id).

- [ ] Steps: failing tests (convert flips mode + clears draft; revert works; PATCH replaces attendees atomically; DELETE is soft; restore clears) → implement → pass → `npm run check:routes` → commit `feat(meetings): detail/convert/restore APIs`.

### Task 6: Agenda APIs — categories + items CRUD, reorder, item tasks, previous minutes, follow-up meeting

**Files:**
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/categories/route.ts` (POST create; PATCH `{ordered_ids}` reorder — positions rewritten 0..n)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/categories/[categoryId]/route.ts` (PATCH rename; DELETE — items in the category move to the meeting's first remaining category, never orphaned; deleting the last category is a 400)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/items/route.ts` (POST create — sets `origin_meeting_id = meetingId` when not carried; PATCH `{category_id, ordered_ids}` reorder within/into a category)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/items/[itemId]/route.ts` (PATCH update any field incl. `official_minutes`; DELETE hard-deletes the item)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks/route.ts` (POST → insert into `tasks` with `meeting_item_id`, `project_id`, `assignee_person_id` defaulted from the item, `extraction_source='meeting_agenda'`; GET → tasks for item)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/items/[itemId]/history/route.ts` (GET → `loadPreviousMinutes`)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/follow-up/route.ts` (POST `{meeting_date?, carry_open_items: boolean}` → new meeting in same series, number+1, same attendees; when carrying: copy categories, and for each open/in_progress item (via `selectCarryoverItems`) create a new item with `carried_from_item_id = old id`, `origin_meeting_id = old origin_meeting_id`, description carried, `official_minutes` empty)
- Tests: `__tests__/route.test.ts` for items route, follow-up route (the two with real logic)

**Interfaces:**
- Produces: everything the agenda UI (Task 11) calls. Reorder contract: client sends the full ordered id list for the affected scope; server rewrites positions in one transaction.

- [ ] Steps: failing tests (reorder rewrites positions; category delete reparents items; follow-up carries only open items and chains `carried_from_item_id`; task create uses `people.id` shape) → implement → pass → `npm run check:routes` → add the new GET/POST endpoints to `scripts/api-smoke-contracts.mjs` → commit `feat(meetings): agenda category/item/task/follow-up APIs`.

### Task 7: Meeting templates API (company-level, admin)

**Files:**
- Create: `frontend/src/app/api/admin/meeting-templates/route.ts` (GET list — id, name, category/item counts; POST create with nested `{name, overview?, is_private?, categories: [{name, items: [{title, description?, priority?}]}]}`)
- Create: `frontend/src/app/api/admin/meeting-templates/[templateId]/route.ts` (GET full nested; PATCH full-replace nested structure; DELETE soft)
- Also: non-admin read endpoint `GET /api/meeting-templates` (name+id only) for the create-meeting dropdown
- Test: `__tests__/route.test.ts` (admin gate: non-admin POST → 403; nested create round-trips)

- [ ] Steps: failing tests → implement (admin check mirrors `frontend/src/app/api/admin/training-docs/route.ts`) → pass → commit `feat(meetings): company-level meeting templates API`.

### Task 8: Fireflies transcript auto-link

**Files:**
- Modify: `backend/src/services/ingestion/fireflies_pipeline.py` — after upserting the `document_metadata` meeting row, upsert a `meetings` row: match series by fuzzy title within project (exact `meeting_series.name` match first; else create), number = max+1, `mode='minutes'`, `transcript_document_id` set; if a meetings row already links this document id, skip.
- Test: extend the pipeline's existing test module (check `backend/tests/` for the fireflies pipeline test file; add a unit test for the new `_upsert_structured_meeting` helper with a fake supabase client).

**Interfaces:**
- Produces: every new Fireflies transcript automatically appears in the Meetings tool. (Phase 2 upgrades this to attach to a pre-scheduled agenda meeting instead of creating a bare one: matching by series + date.)

- [ ] Steps: write helper test → implement `_upsert_structured_meeting(sb, doc_meta)` called from the pipeline → run `pytest backend/tests -k structured_meeting` → commit `feat(meetings): fireflies pipeline links transcripts to meetings rows`.

### Task 9: React Query hooks

**Files:**
- Rewrite: `frontend/src/hooks/use-meetings.ts` — `meetingKeys` factory; `useMeetingSeriesList(projectId, {search, status, deleted})`; `useMeetingDetail(projectId, meetingId)`; mutations: `useCreateMeeting`, `useUpdateMeeting`, `useDeleteMeeting`, `useRestoreMeeting`, `useConvertMeeting`, `useCreateFollowUpMeeting`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`, `useReorderCategories`, `useCreateItem`, `useUpdateItem`, `useDeleteItem`, `useReorderItems`, `useCreateItemTask`, `useItemHistory(itemId)` — all via `apiFetch`, all invalidating `meetingKeys.detail(meetingId)` (reorders use optimistic updates: snapshot, reorder locally, rollback on error)
- Create: `frontend/src/hooks/use-meeting-templates.ts` — `useMeetingTemplateOptions()` (dropdown), admin CRUD hooks

- [ ] Steps: implement (no component changes yet; existing pages keep compiling — fix imports where old hook names were used: grep `useCreateMeeting|useMeetings\(` consumers). While shaping the hook return values, use Meetily's `useMeetingData` split as a reference for separating persisted meeting state, summary state, and transcript state, but keep network ownership in React Query → targeted typecheck on changed files → commit `feat(meetings): hooks for meetings/agenda/templates`.

### Task 10: Meetings list page — grouped by series

**Invoke `Skill("alleato-table-page")` first.**

**Files:**
- Rewrite: `frontend/src/app/(main)/[projectId]/meetings/page.tsx`
- Create: `frontend/src/features/meetings/meetings-table-config.tsx`

**Behavior:**
- `UnifiedTablePage` + `useUnifiedTableState({entityKey: "meetings-v2", ...})`. Rows are **series**; `renderExpandedRow` (same `TableExpandedRow` + `InlineTable` pattern as commitments change-orders rows, `frontend/src/app/(main)/[projectId]/commitments/page.tsx:95-212`) lists that series' meetings: Number, Date, Location, Status (`StatusBadge`: draft/awaiting_minutes/minutes), Agenda Items count, Template.
- Toolbar: `ExpandingSearch`, Status filter, column visibility; header action "Create Meeting"; tabs: `All` / `Recycle Bin` (`deleted=only`, row actions Restore / Delete Forever — endpoints from Task 5).
- Row click on a meeting → `/{projectId}/meetings/{meetingId}`. Selection + bulk delete + row actions (⋯ Edit/Delete) included per TABLE-PAGE-GATE.
- Empty state: `EmptyState` with "Create Meeting" action inside it.

- [ ] Steps: config file → page → verify in browser (`agent-browser` on port 3001, project 67: expand series, filter status, recycle bin). Keep this page native to Alleato; do NOT import Meetily list UI since their product does not model project-scoped series/grouped CRUD the way we do → commit `feat(meetings): series-grouped meetings list page`.

### Task 11: Create Meeting flow

**Files:**
- Create: `frontend/src/components/domain/meetings/create-meeting-dialog.tsx` (RHF + Zod, pattern: `frontend/src/components/domain/contracts/CreateSubcontractForm.tsx`)
- Modify: list page header action to open it; delete the old `meetings/schedule` page and route references (its job is replaced; keep prep generation reachable from the new detail page)

**Fields (exact Procore set):** Template select (default "No Template", options from `useMeetingTemplateOptions`), Meeting Name*, Series (defaults to name; editable select of existing series + free text), Date (`RHFDateField`), Timezone (IANA select, default project TZ), Start/End time, Location, Meeting Link, Private toggle, Draft toggle, Overview textarea, Attendees multi-picker (project directory people — reuse the people-select used by task/RFI assignee pickers; grep `assignee` selects; option label = person name + company).

- [ ] Steps: build dialog → submit via `useCreateMeeting` → on success `router.push` to new meeting detail → browser-verify (create from blank + from a template; template items appear). Meetily's template-selection affordances can inform the chooser UX, but the dialog shell and fields stay on Alleato form primitives → commit `feat(meetings): create meeting dialog with template selector`.

### Task 12: Meeting detail page — header, tabs, convert CTA

**Recommended owner:** Dedicated UI session

**Invoke `Skill("alleato-detail-page")` first.**

**Files:**
- Rewrite: `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx` (+ extract `frontend/src/components/domain/meetings/meeting-detail-header.tsx` if >400 lines)

**Behavior:**
- `PageShell variant="detail"`, eyebrow = series name + `#<number>`, title = meeting name, `onBack` → list.
- Header actions: **Convert to Minutes** (primary; when `mode='minutes'` becomes outline "Revert to Agenda") via `useConvertMeeting`; **Export** (Task 14); ⋯ menu: Create Follow-Up Meeting (`useCreateFollowUpMeeting`), Delete.
- `PageTabs`: **Meeting Details** (default), **Transcript** (only when `transcript_document_id` — renders the existing transcript viewer component `frontend/src/components/meetings/meeting-detail-content.tsx` fed by the linked document id; also surface "Generate Prep" linking to the existing prep flow). No empty Related Items/Emails/Change History tabs (deferred slice — noise gate).
- Details tab: `DetailLayout sidebar={...}`; main = `EditableDetailField`s (name, date, timezone, start/end, location, link, overview, private, draft) saving via `useUpdateMeeting` field-by-field (inline-save pattern from prime-contracts detail); sidebar = Attendees section (`SectionRuleHeading label="Attendees"` + `SectionAction` bare-plus to add; person rows with remove; in minutes mode an "attended" checkbox per person) + Attachments (`DocumentPicker`/`LinkedDocumentsList` with entity `meeting` — register `meeting`/`meeting_item` in `frontend/src/lib/documents/pattern-c-attachments.ts` in this task).
- Below the fields: the Agenda section (Task 13 component).
- Meetily adoption for this task:
  - Port the **overall transcript/detail split-view behavior** from `MeetingDetails/TranscriptPanel.tsx`, but rebuild it with Alleato shells/tokens.
  - Use Meetily's `EditableTitle` only as the interaction reference; implement the actual title editor on our inline field primitives.
  - If we add a summary area in this task or immediately after it, use the `SummaryPanel` composition model, not its raw visual treatment or Tauri controls.

- [ ] Steps: build → browser-verify (edit fields inline, convert→revert, follow-up creates n+1 meeting with carried items) → commit `feat(meetings): meeting detail page with convert/follow-up`.

### Task 13: Agenda section — categories, items, drag-reorder, inline editing, tasks, previous minutes

**Recommended owner:** Shared. Main session owns contract wiring and final integration; dedicated UI session may assist on editing ergonomics and component extraction.

**Files:**
- Create: `frontend/src/components/domain/meetings/agenda-section.tsx` (categories + items shell, expand/collapse all, status filter dropdown, add category)
- Create: `frontend/src/components/domain/meetings/agenda-item-row.tsx` (single item: number, title, inline assignee/due/status/priority controls, expand → description textarea, official minutes textarea (minutes mode only), attachments via `DocumentPicker` entity `meeting_item`, Tasks subsection with "+ Create Task" (`useCreateItemTask`) listing linked tasks, "Previous Minutes" collapsible fetching `useItemHistory` lazily on first open)

**Behavior details:**
- Reorder with `Sortable`/`SortableContent`/`SortableItem`/`SortableItemHandle` (`frontend/src/components/ui/sortable.tsx`), `orientation="vertical"`, grip handle `GripVertical` — one Sortable for categories, one per category for its items; `onValueChange` → optimistic `useReorderCategories`/`useReorderItems`. Numbers (`1.1`…) come from the server-computed `agenda_number` and re-render after reorder invalidation.
- Category header: `SectionRuleHeading label={`${index+1}. ${name}`}` with inline rename (click-to-edit text) and `SectionAction` "+ Add Item"; delete in ⋯ (blocked with toast if it's the last category).
- Status filter: `Select` (All / Open / In Progress / Closed) — client-side filter of items.
- New-item quick add: title input row at category bottom; everything else edited inline after creation. No pencil icons (⋯ menu for delete). Empty description renders nothing.
- Meetily adoption for this task:
  - Reuse only the editing cadence ideas from the summary editor work: low-friction inline editing, explicit dirty-state handling, and no data-loss saves.
  - Do not force BlockNote into agenda items in Phase 1. Plain text remains the right storage/UI contract here.

- [ ] Steps: build components → wire into detail page → browser-verify the full loop (add category → add items → reorder both axes → numbers update → assign/due/status/priority inline → create task from item and see it on the project Tasks page → convert to minutes → record official minutes → follow-up meeting → previous-minutes history shows the prior meeting's minutes) → commit `feat(meetings): full agenda management UI`.

### Task 13A: Transcript + AI summary experience port

**Recommended owner:** Dedicated UI session

**Purpose:** Land the high-value Meetily-derived detail experience without contaminating the meetings core data model.

**Files:**
- Create: `frontend/src/components/domain/meetings/meeting-transcript-pane.tsx`
- Create: `frontend/src/components/domain/meetings/meeting-summary-pane.tsx`
- Create or extend: shared transcript virtualization / summary editor helpers only if they are reusable beyond meetings

**Behavior:**
- Transcript pane should support a large linked transcript comfortably: virtualized scrolling, copy affordance, and clear empty/loading/error states.
- Summary pane should tolerate either markdown or structured summary payloads so later AI phases can write richer output without another rewrite.
- Any editor introduced here must save loudly, preserve unsaved state, and never silently discard formatting/content on mode changes.

- [ ] Steps: port the useful Meetily interaction model into Alleato components → wire transcript pane to `transcript_document_id`-backed data and summary pane to our existing prep/summary data sources → browser-verify on a meeting with a real transcript → commit `feat(meetings): transcript and AI summary detail panes`.

### Task 14: PDF export

**Files:**
- Create: `frontend/src/lib/meeting-pdf.ts` (`renderMeetingPdfBuffer(data: MeetingPdfData)` — @react-pdf/renderer doc: header block (name, #, date, time, location, attendees w/ attendance in minutes mode), then categories with numbered items, description, assignee, due, status, official minutes; pattern copied from `frontend/src/lib/prime-co-pdf.ts`)
- Create: `frontend/src/app/api/projects/[projectId]/meetings/[meetingId]/pdf/route.ts` (`runtime = "nodejs"`, GET → `loadMeetingDetail` → buffer → `Content-Disposition: attachment; filename="meeting-<number>.pdf"`)
- Modify: detail page Export button → opens the pdf route.

- [ ] Steps: implement → curl the route locally to confirm `%PDF` bytes + open the file → commit `feat(meetings): agenda/minutes PDF export`.

### Task 15: Admin template builder UI

**Files:**
- Create: `frontend/src/app/(admin)/meeting-templates/page.tsx` (admin list — simple `UnifiedTablePage`: Name, Categories, Items, Updated; create/delete)
- Create: `frontend/src/app/(admin)/meeting-templates/[templateId]/page.tsx` (editor: template fields + nested category/item editing reusing the same visual grammar as agenda-section, minus assignee/due/status/minutes — templates carry only Title/Description/Priority per Procore)
- Modify: admin nav registration (grep how `/training-docs` is registered in the admin nav and mirror it)

- [ ] Steps: build → browser-verify (create template with 2 categories/3 items → create meeting from it on a project → items copied) → commit `feat(meetings): admin meeting-template builder`.

### Task 16: Regression rails + final verification

**Files:**
- Modify: `scripts/api-smoke-contracts.mjs` — entries for meetings list/detail/categories/items/templates GETs
- Create: `tests/e2e/meetings.spec.ts` — Playwright: create meeting → add category/item → reorder → convert to minutes → follow-up carries item → recycle bin restore
- Modify: `docs/architecture/PROJECT-MAP.md` regenerates via `npm run map:project` (pre-commit gate)

- [ ] **Step 1:** Write + run the e2e spec headed once (`npx playwright test tests/e2e/meetings.spec.ts --headed`).
- [ ] **Step 2:** Delegate to a background Haiku sub-agent: `npm run quality`, `npm run build`, full Jest, `npm run check:routes`. Fix reported blockers.
- [ ] **Step 3:** Run `Skill("verify-feature")` on "Meetings tool" starting at `/{projectId}/meetings` — real-user flow + DB read-back (BATCHING-GATE deep-verify: confirm `tasks.assignee_person_id` written as `people.id`, agenda numbers correct after reorder, RLS lets a non-admin project member CRUD agenda items).
- [ ] **Step 4:** Push branch, open PR (`gh pr create --base main`), test on the Vercel preview deployment, then merge.

---

# PHASES 2–5 — AI layers (architecture locked; each becomes its own plan when started)

The Phase 1 data model was designed so every AI feature below is a read/write against real FKs — no new core schema needed except where noted.

### Phase 2 — Close the transcript loop (highest immediate value)
1. **Transcript → agenda attach:** upgrade Task 8's pipeline hook to match an incoming transcript to an existing `awaiting_minutes` meeting (same series + date ±1 day) instead of creating a new row; sets `mode='minutes'` is NOT automatic — surfaces a "Transcript received — convert to minutes?" state on the detail page.
2. **Action-item extraction → task batch:** `meeting_segments.tasks`/`decisions` already hold extracted items. New endpoint `POST /api/projects/:projectId/meetings/:meetingId/extract-actions` correlates segment tasks to agenda items (title-similarity against item titles), returns a proposal list; UI shows a confirm panel ("Found 3 action items — create tasks?") → batch-creates via the Task 6 tasks endpoint. Attendee-aware assignee resolution: match speaker names to `meeting_attendees` → `people.id`.
3. **Resolution detection:** same extraction pass proposes item status changes ("sounds resolved — close item 4.1?") + drafts `official_minutes` per item from the segments that discussed it. Human-confirmed, never auto-applied (matches the app's confirmed-write gate convention).
4. **AI chat tools:** register `createMeeting`, `addAgendaItem`, `convertMeetingToMinutes` in `tool-registry.ts`/`tool-descriptors.ts` with `confirmedWriteDescriptorDefaults`.

### Phase 3 — Pre-meeting intelligence
1. **Agenda suggestions endpoint:** `GET /api/projects/:projectId/meetings/:meetingId/suggestions` — deterministic cross-tool queries (open RFIs, overdue submittals, pending change events, overdue tasks, schedule slippage — reuse the 9-probe source list from `backend/src/services/agents/deep_project_intelligence.py`) + LLM ranking; each suggestion carries `{source_type, source_id, proposed_category, proposed_title}` → one-click "Add to agenda" creates a linked item.
2. **Pre-meeting brief:** the existing `meeting_preps` table + `/prep/generate` route is exactly this — extend its prompt to consume the structured agenda (items, ages via origin, carryover counts) instead of raw context only. Per-attendee packets = same generator with an attendee filter; store as `meeting_preps.version` variants keyed by person.
3. Add `meeting_items.source_type`/`source_id` columns (small migration) so suggested items link back to RFIs/CEs/etc. — this is also the future "Related Items" tab data.

### Phase 4 — Memory & continuity
1. **Stale-item intelligence:** velocity = chain length via `carried_from_item_id` (pure SQL, recursive CTE). Surface: badge on items open ≥3 meetings; series-level trend (open-item count over meetings).
2. **"What did we decide?" queries:** meeting content is already embedded (meetings are 1,675 embedded docs in the RAG DB); add an AI tool that filters RAG search to the series' transcript document ids + joins item `official_minutes`, answering with meeting # + item citation.
3. **Accountability:** per-person open carryover items + task completion via `tasks.meeting_item_id` — feeds Phase 3 attendee packets.

### Phase 5 — Risk surface + post-meeting distribution
1. **Minutes distribution email:** post-convert, generate summary email (decisions/action items/next meeting) to attendees — reuse the RFI email infrastructure (`frontend/src/emails/` + EMAIL_FROM lessons in memory) with a confirm-before-send draft.
2. **Risk detection:** run item descriptions + minutes through the existing insight pipeline (`insight_cards` with a `meeting_agenda` compiler version) so meeting-detected risks land in the same intelligence spine as everything else — do NOT build a parallel risk store.
3. **Smart templates:** suggest template updates from recurring ad-hoc categories across a company's meetings (candidate → human review, mirroring the `ai-learning-promotions` queue pattern).

### Deferred (explicitly out of scope until asked)
- Related Items / Emails / Change History tabs (needs audit-log design)
- Lexical rich text in overview/description/minutes
- Minutes approval workflow ("Minutes Approval Requested" in Procore)
- Procore REST API two-way sync (`/rest/v1.0/projects/{id}/meetings`) — we mirror the tool, we don't sync to Procore

---

## Self-review notes (spec coverage)

- Every backend checkbox in the source spec maps to Tasks 4–7 (meetings CRUD, categories, items, item tasks, convert, templates, `meeting_origin`, previous-minutes) — previous_minutes is the carryover chain, not a table.
- Every frontend checkbox maps to Tasks 10–15 (grouped list, create modal w/ template selector, detail w/ tabs, agenda section w/ drag/numbering/status-filter/inline-edit/tasks/previous-minutes, convert CTA, export PDF, recycle bin).
- All 13 acceptance criteria are covered; the 3 AI acceptance criteria land in Phases 2–3 and are architecturally unblocked by Phase 1 (source links, carryover chain, transcript link, segments reuse).
- Known risk: the backfill creates one series per distinct transcript title — noisy titles (Fireflies auto-names) may create many single-meeting series. Acceptable: series merge can be a small follow-up admin action; flag during Task 16 verification.
