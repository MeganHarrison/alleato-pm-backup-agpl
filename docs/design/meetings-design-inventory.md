# Meetings Tool — Design & UI Inventory (for the Figma design agent)

**Date:** 2026-07-02
**Scope:** every surface the Meetings tool has or needs — shipped surfaces that need real design attention, plus the AI-phase surfaces that are speced but unbuilt. Each item lists the elements that must be present and the reason each earns its place.

**Global design constraints (bind every item below):**
- Alleato design system only: semantic tokens (no hex, no gray-*/blue-*), no card borders around sections (spacing + tonal backgrounds), shadows ≤ shadow-sm, `StatusBadge` for statuses, icon-links for email/phone/URL (never buttons), empty fields render nothing (never "—"), search is an expanding icon (never a persistent input), secondary add actions are bare plus icons.
- Every page: loading, empty, error, and mobile states are part of the design, not afterthoughts.
- The noise-gate burden of proof: an element gets on the page only if it makes the primary task faster, clearer, or safer. When in doubt, remove.

---

## A. Core pages (shipped — need design elevation)

### A1. Meetings list page — `/[projectId]/meetings`
**User/job:** PM scanning "what meetings exist on this project, what happened, what's next" and jumping into one.
**Primary decision:** which meeting to open.
**Elements:**
1. Series-grouped table rows (series name, meeting count, last-meeting date) with expand → nested meeting rows (#number, date, location, StatusBadge Draft/Awaiting Minutes/Minutes, agenda item count, template name). *Why:* recurring meetings (Weekly OAC etc.) are the real unit of thought; a flat list of 1,346 meetings is unusable.
2. "Create Meeting" primary action (header) + inside EmptyState when list is empty. *Why:* single entry point to the planning flow.
3. Expanding search (matches meeting or series name), status filter, All/Recycle Bin tabs, restore action on binned rows. *Why:* recovery and narrowing without leaving the page.
4. Row click → meeting detail. Per-meeting ⋯ menu (delete). *Why:* navigation is the page's whole job; destructive actions stay one level down.
**Design attention needed:** the series row vs nested row hierarchy currently reads flat; the expanded table needs clearer containment (tonal, not bordered). Dates like "Date TBD" repeated down a column is noise — design the empty-date treatment.

### A2. Meeting detail — transcript view — `/[projectId]/meetings/[id]` (THE default for any meeting with a transcript)
**User/job:** PM/exec consuming what happened in a past meeting.
**Status:** this is the page Megan explicitly wants preserved — treat the existing layout as the approved reference, design only refinements.
**Elements (existing, keep):** title + date/time + project chip + Fireflies link header; Meeting Overview paragraph; Tasks section (with inline add); Summary/digest (AI); Notes; Discussion Topics (collapsible, counted); Full Transcript (speaker-formatted); right sidebar: Attendees (avatar cluster) + Action Snapshot (risks/decisions). *Why:* consumption page — the hierarchy overview → extractions → raw transcript matches how people actually read meetings.
**One addition to design:** a quiet path to the meeting's agenda page when one exists (planning ↔ record link) — must NOT compete with the content; think breadcrumb-level, not button.

### A3. Meeting detail — agenda/planning view — `/[projectId]/meetings/[id]/agenda`
**User/job:** PM building and running a meeting that hasn't happened (or is happening) — the Procore-style surface. **This is the page Megan called "complete shit" — it needs a genuine redesign, not decoration.**
**Design problem to solve:** as shipped it reads as an empty shell of labels for a new meeting. The redesign should make the agenda the hero and make an empty meeting feel like a starting point (what do I add first?) rather than a form graveyard.
**Elements:**
1. Header: series + #number eyebrow, meeting name, StatusBadge, **Convert to Minutes** primary CTA (flips to "Revert to Agenda"), Export (PDF), ⋯ (Create Follow-Up, Delete). *Why:* convert is the lifecycle moment; everything else is secondary.
2. Meeting info block: date, time range, timezone, location, meeting link, private/draft flags, overview — inline-editable, horizontal label/value, empty fields render nothing. *Why:* reference info, not the point of the page — must be visually quiet.
3. Attendees (sidebar): person rows w/ add (bare plus) + remove; in minutes mode an attendance checkbox per person. *Why:* who's in the room; attendance is a minutes-mode artifact.
4. Attachments (sidebar): linked docs list + picker. *Why:* pre-reads live with the meeting.
5. **Agenda section (the hero):** categories as numbered section headings (1., 2., …) with inline rename, drag handles, add-item; items as rows: agenda number (1.1), title, assignee, due date, status, priority, expandable description; per-item: tasks subsection (+ Create Task, linked task list), Previous Minutes collapsible (history across the series), attachments, official-minutes text area (minutes mode only). Quick-add title row per category; Expand/Collapse all; status filter. *Why:* every element maps to a Procore workflow the PM already knows.
6. Minutes mode = same page, visibly different state (recording posture): official-minutes fields visible, attendance markable. *Why:* the agenda→minutes flip is the tool's core loop; the state change must be felt, not hunted for.
7. Transcript tab appears only when a transcript is linked. *Why:* planning meetings gain their record after the fact.

### A4. Create Meeting page — `/[projectId]/meetings/new`
**User/job:** PM starting a meeting — often from a template — in under a minute.
**Elements:** Template select ("No Template" default; selecting one previews what it seeds — design that preview); Meeting Name*; Series (defaults to name; pick existing or new — this needs a real combobox design, currently a bare datalist); Date; Timezone; Start/End time (free-text, accepts "9:00 AM"; inline validation incl. "end after start"); Location; Meeting Link; Private + Draft toggles with one-line consequences; Overview; Attendees multi-select (search people; selected as removable chips; **options must handle contacts with no name — email fallback**); Create + Cancel. *Why each:* exact Procore field set; the two toggles and template preview are the only spots users hesitate, so they get microcopy.
**Design attention:** field grouping/rhythm (when/where/who), and the template-selection moment — this page later hosts AI agenda pre-population (see C2), so leave a designed slot for "suggested agenda" below the fields.

### A5. Admin template builder — `/meeting-templates` (list) + `/meeting-templates/[id]` (editor)
**User/job:** admin defining reusable company meeting structures (OAC, weekly progress).
**Elements — list:** table (Name, Categories, Items, Updated), create, delete, EmptyState with create. **Editor:** template name/overview/private; categories with items (title, description, priority ONLY — templates never carry project data); add/rename/delete/reorder mirroring the agenda grammar of A3.5; explicit Save/Cancel bar (full-replace save — unsaved-changes warning required). *Why:* the editor must look like a blank agenda so admins understand what they're authoring; explicit save because child rows are replaced wholesale.

---

## B. Overlays, dialogs, documents (shipped)

### B1. Delete meeting confirm (AlertDialog)
Title, one-line consequence ("moves to Recycle Bin — restorable"), Delete/Cancel. *Why:* soft-delete means the copy should de-dramatize; recovery path stated inline.

### B2. Category delete / last-category block
Confirm that states where its items go ("items move to <first category>"); blocked state when it's the only category. *Why:* items are never orphaned — say so, don't just do it.

### B3. Create Follow-Up Meeting (currently instant from ⋯)
Small confirm: date picker + "carry open items" toggle showing the count ("Carries 4 open items with their history"). *Why:* carryover is the feature; users should see what's coming with them.

### B4. Meeting PDF (print document — design this like a document, not a screen)
Header (name, series #, date, time, location, attendees w/ attendance marks in minutes mode), categories with numbered items (description, assignee, due, status, priority), official minutes per item; page numbers, generated date. *Why:* this is what gets emailed to owners/subs — it's the tool's external face. (Gap to include: series name in the header.)

### B5. Unsaved-changes guard (template editor, official-minutes fields)
Standard leave-warning treatment. *Why:* full-replace saves and long minutes text = real loss risk.

---

## C. AI-phase surfaces (Phases 2–3 — speced, unbuilt; design now so build lands right)

### C1. Action-item extraction confirm panel (on the meeting detail once a transcript arrives)
**Job:** "The AI read the transcript — here's what it found; approve into real tasks."
**Elements:** banner-level entry ("Transcript received — 3 action items found"); list of proposals, each: quoted commitment from the transcript (with speaker), proposed task title, proposed assignee (matched from attendees — editable), due date (editable), the agenda item it correlates to (or "new"); accept/edit/dismiss per row; "Create N tasks" batch action; nothing auto-applies. *Why:* human-confirmed writes are the app-wide AI contract; showing the transcript quote is what earns trust.

### C2. Agenda suggestions panel (on create page + empty agenda)
**Job:** "What should we talk about?" — pre-populate from live project data.
**Elements:** suggestion rows grouped by source (Open RFIs, Pending change events, Overdue tasks, Schedule), each with a one-line reason ("RFI #14 — open 23 days, no architect response") and a proposed category; one-click add per row + add-all; dismiss. *Why:* each suggestion is a data join PMs currently do in their head; the reason line is the value, not the link.

### C3. Pre-meeting intelligence brief (tab or panel on the agenda page)
**Job:** the one-pager a smart PM would write the night before.
**Elements:** ranked sections (🔴 critical / 🟠 financial / 🟡 decisions-needed pattern), each item citing its source (agenda item age, RFI, CO) with a link; per-attendee filter (the "your items" packet view); regenerate control. *Why:* ranked and cited or it's noise — this is prose with receipts, not a dashboard.

### C4. Stale/carryover indicators (agenda item rows)
Quiet badge on items open ≥3 meetings ("Open 6 meetings") + the existing Previous Minutes history as its evidence. *Why:* repetition makes items invisible; the counter makes age legible without a new page.

### C5. Post-meeting summary + send flow
Draft view of the distribution email (see D1) with edit-in-place and explicit Send; recipient list = attendees, editable. *Why:* one-click distribution is the payoff of minutes mode; must be reviewable before send.

---

## D. Email templates (react-email, matching existing RFI email patterns)

### D1. Meeting minutes distribution email
To attendees post-convert. Elements: meeting name/series #/date; decisions list; action items grouped by assignee (task, due date); link to the meeting page + PDF attachment reference; next meeting date if a follow-up exists. *Why:* the artifact most stakeholders actually read; assignee-grouped actions is what makes it useful.

### D2. Action-item assignment notification
To a person when a task is created from an agenda item (incl. via C1 batch). Elements: the commitment (quote if from transcript), task, due date, meeting source link. *Why:* accountability delivered to the person, not buried in the meeting dump.

### D3. Meeting invitation / pre-read (Phase 3)
To attendees pre-meeting: when/where/link, agenda outline, personal items ("you own 2 open items"), attached pre-read brief. *Why:* the per-attendee packet, delivered where people live.

---

## E. Cross-cutting states to design once, reuse everywhere
- Empty agenda (new meeting): first-run guidance inside the agenda area (add category / add item / suggest with AI) — not a modal, not a banner.
- Empty list (no meetings on project): EmptyState with create action inside.
- Loading: skeletons for series table rows and the agenda section.
- Error: ErrorState treatment for detail-load and save failures (saves fail loudly — toast + field-level where applicable).
- Mobile: list collapses to cards; agenda item rows stack; sidebar (attendees/attachments) moves below content; create form single-column.

## F. Explicitly out of scope (don't design yet)
Related Items / Emails / Change History tabs (deferred pending audit-log design); minutes approval workflow; rich-text (Lexical) editing in descriptions; Procore two-way sync UI.
