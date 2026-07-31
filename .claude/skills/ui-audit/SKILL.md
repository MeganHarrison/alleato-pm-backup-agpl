---
name: ui-audit
description: >
  Sweep the app's real pages in a browser and report recurring UI-quality issues in ONE
  ranked report — instead of finding them by hand, one page at a time. Catches: tables whose
  totals/footers don't line up with their columns, cramped or "everything on one line" layouts,
  dropdowns/selects/status badges that render read-only where the data is editable, detail fields
  that should be inline-editable but aren't, stacked (instead of horizontal) detail fields, and
  design-system noise (section borders, card wrappers, decorative icons, labeled secondary "add"
  buttons, "—" dashes, ghost buttons in headings, duplicate CTAs, persistent search inputs).
  Also runs a whole-repo CONSISTENCY scan (npm run audit:consistency) that finds every place a
  pattern is hand-rolled instead of using the one shared component — so "fix it once, fixed
  everywhere" instead of broken everywhere.
  Use when the user says "audit the UI", "audit the whole site", "find all the pages that look like
  crap", "which tables are misaligned", "which dropdowns should be editable", "why isn't this using
  the same component everywhere", "it's broken everywhere", "ui-audit", "sweep the pages", "check
  every detail page", or is frustrated about finding these issues manually one by one.
metadata:
  bashPatterns:
    - "ui-audit"
priority: 92
---

# UI Audit — automated visual sweep of real pages

> **Why this exists:** These issues were being found one page at a time, by eyeballing — misaligned
> table totals, cramped rows, dropdowns that should be editable, fields stacked wrong, leftover
> visual noise. That does not scale. This skill renders the *actual* pages, checks each against a
> fixed rubric of the things that repeatedly go wrong here, and returns ONE ranked report with a
> screenshot and a `file:line` fix location per finding — so the reviewer approves fixes, not hunts
> for problems.

Quality here has two halves; a full audit runs **both**:

1. **Consistency (static, whole-site, deterministic)** — the same pattern hand-rolled in many places
   instead of one shared component, so a fix never propagates. Run this FIRST, always — it is fast
   and needs no browser:
   ```bash
   cd frontend && npm run audit:consistency          # whole repo
   cd frontend && node scripts/audit/ui-consistency-audit.mjs src/app/(main)/[projectId]/commitments
   ```
   It writes `docs/reports/ui-consistency-<date>.md`: every `design-system` violation across all of
   `src`, ranked by how many times each pattern diverges, mapped to the one component to use, plus the
   worst-offender files. This is the "goes through the entire site" backbone. On changed files these
   rules already hard-fail via lint-staged; this surfaces the pre-existing backlog they never sweep.

2. **Visual/judgment (browser, per-page)** — what only rendering can catch: cramped layouts,
   "looks like crap", a status badge that should be clickable, totals that visually don't line up.
   This is Phases 0–4 below.

The most reliable structural guard is the `InlineTable` dev-time column-integrity check (see
`src/components/ds/inline-table.tsx`) — it errors the instant any table's totals row drifts from its
header, app-wide.

---

## Inputs

| Parameter | Required | Example | Meaning |
|-----------|----------|---------|---------|
| Target | No | `commitments` · `/754/commitments/<id>` · `all` | A section slug, a concrete route, or `all`. Omitted ⇒ ask which section, or default to the section the user is currently looking at. |

Never audit "all" silently in one thread — it is dozens of pages. For `all`, use Phase 4 fan-out.

---

## The rubric — what to flag (and the binding rule for each)

Score every audited page against these. Each row = a concrete, observable defect, not a vibe.
Authoritative sources in the repo: `docs/design/noise-gate-log.md` (case law — read it first),
`.claude/rules/DETAIL-PAGE-GATE.md`, `DESIGN-SYSTEM-GATE.md`, `PAGE-LAYOUT-GATE.md`,
`TABLE-PAGE-GATE.md`, and `DESIGN.md`.

### A. Table integrity
- **A1 Totals/footer not aligned with columns** — a `Total`/summary row whose numbers sit under the
  wrong header (the classic footer-`colSpan` drift). Verify by comparing each footer cell's right
  edge to its header column's right edge.
- **A2 Header wrapping / cramped columns** — a column header wrapped to two lines, or numeric
  columns crushed together. Headers must be `whitespace-nowrap`; shorten the label, don't widen.
- **A3 Raw table primitives** — a list/grid built from raw `<table>`/`<TableRow>` instead of
  `UnifiedTablePage` (table pages) or `InlineTable` (inline SOV-style tables).

### B. Editability (the "I should be able to edit this" class)
- **B1 Read-only control over editable data** — a status badge, select, or dropdown rendered as
  static text when the underlying field is user-editable (e.g. a status pill that can't be clicked
  to change status; a budget-code shown as text instead of a `BudgetCodeSelector`).
- **B2 Detail field not inline-editable** — a detail-page field that has a create/edit-form
  equivalent but is static here. Editable detail fields use `EditableDetailField`/`InlineEditField`
  in place — never a redirect to a separate `/edit` page.
- **B3 Field parity gap** — a field on the create/edit form that is missing entirely from the
  detail page.

### C. Detail-field layout
- **C1 Stacked fields on a detail page** — label-above-input. Detail pages are **horizontal**
  (label left, value/input right) via `DetailField`/`EditableDetailField`. Stacked layout belongs
  only on `PageShell variant="form"` create/edit pages.
- **C2 Hand-rolled grid** — a detail/page-level `grid-cols-*` instead of `DetailLayout` /
  `PageScaffold layout=...`.

### D. Layout density & alignment
- **D1 "Everything on one line" / cramped** — controls jammed together with no breathing room, or
  values not aligned to their labels/columns.
- **D2 Eyebrow / header style off** — preheading/eyebrow that doesn't match the site (should be the
  brand-color number, not a tiny uppercase label; no redundant type word like "Subcontract #").
- **D3 Double header** — `PageContainer` + a manual `<h1>` inside a page that already has a shell
  header.

### E. Design-system noise (burden of proof is on the element existing)
- **E1 Section chrome** — borders, card wrappers, or background fills around sections. Separate with
  spacing only.
- **E2 Decorative icons** — an icon that isn't the sole affordance for its action.
- **E3 Labeled/bordered secondary "add"** — a secondary add action rendered as a labeled or bordered
  button instead of a bare `+`.
- **E4 "—" dash for empty** — an empty field rendering a dash instead of nothing.
- **E5 Ghost button in a section heading** — heading actions must use `SectionAction` (outline/sm),
  never a ghost `<Button>` that reads as heading text.
- **E6 Duplicate CTA / helper filler** — two buttons doing the same thing; unsolicited helper panels,
  finder widgets, banners, or summary strips with no proven job.
- **E7 Persistent search box** — a raw always-open `<Input placeholder="Search…">` instead of
  `ExpandingSearch`.
- **E8 Contact value as a button** — an email/phone/URL rendered as a full `<Button>` instead of an
  icon-link.

> **Do NOT flag** intentional states or things outside the rubric. If a control is legitimately
> read-only (locked/approved record), that is not B1. When in doubt, note it as `info`, not a defect.
> New complaints Megan makes during an audit → append a dated row to `docs/design/noise-gate-log.md`
> in the same turn (that is a hard rule from CLAUDE.md), then encode it here as a new rubric item.

---

## Procedure

### Phase 0 — Set up the browser session (once)
Use the `agent-browser` skill (more stable than ad-hoc preview). Log in with the app creds from
`.env` (`TEST_USER_1` / `TEST_PASSWORD_1`) — never ask the user to log in, never guess creds. If the
session drops mid-run, re-login and continue; do not abandon the sweep.

### Phase 1 — Enumerate the target pages
Build the page list from the surface inventory, not from memory:
```bash
# Every UI route + which are detail vs table pages:
sed -n '/UI Routes/,/API Endpoints/p' docs/architecture/PROJECT-MAP.md
# Or scan directly:
find frontend/src/app/\(main\) frontend/src/app/\(admin\) -name page.tsx | sort
```
Classify each as **table page** (list/grid), **detail page** (`[*Id]/page.tsx`), or **form**.
For a detail page, reach a *real record with data* by opening the section's table page and clicking
the first row — never audit an empty/placeholder detail page.

### Phase 2 — Audit each page against the rubric
For each page:
1. Navigate, wait for data (not the skeleton), take a full screenshot.
2. Walk the rubric A→E. For every hit, capture a **tight** screenshot of just the offending element
   (per the Visual Proof Gate — legible, not a distant full-page shot).
3. For structural hits (A, B1, C, E), find the `file:line` in code so the finding is directly
   fixable. Read the component; confirm the defect is real in the source, not a render artifact.
4. Record: severity, page URL, `file:line`, rubric id, one-line defect, screenshot path.

Severity: **high** = wrong/misleading data or a broken interaction (A1, B1 on a primary field,
double-submit). **medium** = clearly-wrong layout/editability the user will hit (C1, B2, A2).
**low** = noise/polish (most of E).

### Phase 3 — Rank & write ONE report
Write `docs/reports/ui-audit-<YYYY-MM-DD>.md` (root files are forbidden — see FILE-ORGANIZATION-GATE)
with:
- A summary line: N pages audited, M findings (X high / Y medium / Z low).
- A single ranked table, most-severe first:

  | # | Sev | Page | Issue | Rubric | Fix location | Proof |
  |---|-----|------|-------|--------|--------------|-------|
  | 1 | high | /754/commitments/… | Totals row shifted one column right | A1 | `ScheduleOfValuesTab.tsx:684` | ![](./ui-audit-<date>/f1.png) |

- Save all screenshots under `docs/reports/ui-audit-<date>/`.
- End with a "not flagged (intentional)" note listing anything deliberately excluded, so the reader
  trusts the sweep was complete rather than silently truncated.

Then present the ranked list in chat and offer to fix the top N (or all `high`) in a follow-up.

### Phase 4 — Fan-out for `all` (don't do it in one thread)
Enumerate sections, then dispatch one subagent **per section** (see the
`dispatching-parallel-agents` skill), each running Phases 0–2 for its pages and returning structured
findings `{sev, page, issue, rubric, file, line, screenshot}`. The main thread dedupes, ranks, and
writes the single Phase-3 report. Never silently cap coverage — if you audit a subset, say which
pages were and were not covered.

---

## Output contract
- Exactly one report file per run, plus a screenshot per finding.
- Every finding has a `file:line` (for structural) or a screenshot (always) — no bare assertions.
- Findings ranked by severity; the report is the deliverable, the chat message is the summary.
- The audit **finds and reports**; it does not fix in the same pass unless asked. Fixing is a
  separate, reviewable step.

## Relationship to existing tools
- Structural drift → ESLint gates + `InlineTable` column-integrity guard (automatic, every commit).
- Single-page deep check → `verify-feature`. Noise-only pass on one surface → `impeccable`.
- FK/dropdown ID mismatches → `fk-audit`. Create-form ↔ detail parity → `parity-audit`.
- **This skill** is the only one that sweeps *many* pages for *these* recurring visual defects and
  returns one ranked, screenshot-backed report.
