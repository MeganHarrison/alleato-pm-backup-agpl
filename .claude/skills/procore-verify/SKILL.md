---
name: procore-verify
description: >
  Full verification pipeline for a Procore tool. Researches codebase + Procore docs,
  crawls live Procore with screenshots, generates implementation specs, cross-compares
  against our code, and produces a verified task list. Use when: "verify [tool]",
  "procore verify", "full audit [tool]", "what's left for [tool]", or any request
  to comprehensively check a tool's implementation status against Procore.
argument-hint: <tool-name>
---

# Procore Tool Verification Pipeline

Comprehensive 6-phase verification of a Procore tool against the Alleato PM implementation.
Produces screenshots, specs, a verified gap analysis, and an actionable task list.

**Invocation:** `/procore-verify <tool-name>`

**Example:** `/procore-verify commitments`

---

## Reliability Contract (Mandatory)

Use the same non-negotiable reliability model as `procore-complete`:

1. **Fail fast preflight before research**
   - validate `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and one of `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY`
   - run: `node scripts/procore-docs-query.js "procore <tool-name> statuses"`
   - if preflight fails, stop and mark verification blocked/failed (do not continue on assumptions)
2. **RAG-first behavior definition**
   - query `procore-docs-rag` Tier 1 before making parity judgments
   - escalate to support article fetch when score is weak (<60%) or behavior is ambiguous
3. **Evidence gate**
   - no finding may be marked `confirmed` without authoritative evidence URL/path
   - ambiguous findings must be `needs-verification` or `blocked`
4. **Recurrence-prevention gate for fixes**
   - for every fix recommendation, include: root cause, detection gap, prevention step, fail-loudly rule, recurrence barrier

---

## CRITICAL: Authentication & Credentials

**All credentials live in the `.env` file at the project root. NEVER ask the user to log in manually.**

### Procore (live site — login.procore.com)

| Env Var | Purpose |
|---------|---------|
| `PROCORE_USER` | Email for Procore login |
| `PROCORE_PASSWORD` | Password for Procore login |

**Procore login flow with agent-browser:**

```bash
agent-browser open "https://login.procore.com/login"
agent-browser wait --load networkidle
agent-browser snapshot -i

# Fill email and submit
agent-browser fill @<email-field> "$PROCORE_USER"
agent-browser click @<submit-btn>
agent-browser wait --load networkidle
agent-browser snapshot -i

# Fill password and submit
agent-browser fill @<password-field> "$PROCORE_PASSWORD"
agent-browser click @<submit-btn>
agent-browser wait --url "**/project/**"
```

**To load credentials in the shell:**

```bash
source .env 2>/dev/null || export $(grep -E '^(PROCORE_USER|PROCORE_PASSWORD)=' .env | xargs)
```

**Save auth state after login for reuse:**

```bash
agent-browser state save procore-auth.json
# Later sessions:
agent-browser state load procore-auth.json
```

### Alleato PM App (localhost:3000)

| Env Var | Purpose |
|---------|---------|
| `TEST_USER_1` | Email for Alleato app login |
| `TEST_PASSWORD_1` | Password for Alleato app login |

**For Playwright tests:** Auth state is pre-saved at `frontend/tests/.auth/user.json`. Tests load it automatically.

**For agent-browser against localhost:**

```bash
agent-browser open "http://localhost:3000/auth/login"
agent-browser snapshot -i
agent-browser fill @<email-field> "$TEST_USER_1"
agent-browser fill @<password-field> "$TEST_PASSWORD_1"
agent-browser click @<submit-btn>
agent-browser wait --url "**/projects**"
```

### Rules

- **NEVER** hardcode credentials in scripts or skill output
- **NEVER** ask the user to log in or enter credentials
- **NEVER** assume credentials are unavailable — they are ALWAYS in `.env`
- **ALWAYS** load from `.env` using `source .env` or `export $(grep ...)`
- **ALWAYS** save browser auth state after login to avoid re-authenticating

---

## CRITICAL: Resource Locations (DO NOT SEARCH — GO DIRECTLY)

**Stop wasting tokens searching for files. Everything is in these two directories:**

### Planning Artifacts (our specs, tasks, schemas, forms, UI docs)

```
_bmad-output/planning-artifacts/<tool-name>/
```

**What's inside each tool directory:**

| File Pattern | Content |
|-------------|---------|
| `tasks*.md` or `tasks*/index.mdx` | Task list for the tool |
| `schema*.md` or `schema*/index.mdx` | Database schema spec |
| `api*.md` or `api*/index.mdx` | API endpoint spec |
| `forms*.md` or `forms*/index.mdx` | Form field spec |
| `ui*.md` or `ui*/index.mdx` | UI/page spec |
| `plans*.md` or `plans*/index.mdx` | Implementation plan |
| `status*.md` | Current status/progress |
| `verification*.md` | Previous verification results |
| `spec*.md` | Combined specification |

**Master index:** `_bmad-output/planning-artifacts/INDEX.md` — lists every file for every tool.

### Procore Reference Documents

```
docs/procore-reference/
```

**What's inside:**

| File | Content |
|------|---------|
| `PROCORE-TOOLS.md` | Master list of all Procore tools and features |
| `PROCORE-TUTORIALS.md` | Procore tutorial/how-to references |
| `PROCORE-DOCS-RAG-GUIDE.md` | Guide for using Procore docs in RAG |
| `INDEX_FEATURES.md` | Feature index |
| `direct-costs-reference.md` | Example: tool-specific reference doc |
| `procore-workflow-images/` | Workflow screenshots from Procore docs |

### Codebase Locations (for the cross-comparison phase)

| What | Path |
|------|------|
| Frontend pages | `frontend/src/app/(main)/[projectId]/<tool>/` |
| Components | `frontend/src/components/domain/<tool>/` |
| Hooks | `frontend/src/hooks/use-<tool>*.ts` |
| Services | `frontend/src/services/<tool>Service.ts` |
| API routes | `frontend/src/app/api/projects/[projectId]/<tool>/` |
| Zod schemas | `frontend/src/lib/schemas/<tool>*.ts` |
| DB types | `frontend/src/types/database.types.ts` |
| Migrations | `supabase/migrations/*<tool>*.sql` |

### Procore Project for Crawling

- **Default project ID:** `562949954728542`
- **Base URL:** `https://app.procore.com/562949954728542/project/`
- **Existing crawlers:** `scripts/playwright-crawl/scripts/crawlers/`

---

## Phase 1: Research & Study (Our Codebase)

**Goal:** Build a complete inventory of what we have for this tool — without guessing.

**Agent strategy:** Use `codebase-analyzer` or `Explore` agent for parallel file discovery.

### Step 1.1 — Read existing planning artifacts

```
_bmad-output/planning-artifacts/<tool-name>/
```

Read every file in this directory. These are the specs, tasks, schemas, forms, and UI docs that have already been written. This is your baseline — do NOT regenerate what already exists.

### Step 1.2 — Read Procore reference docs

```
docs/procore-reference/
```

Read `PROCORE-TOOLS.md` and any tool-specific reference file (e.g., `direct-costs-reference.md`).

### Step 1.3 — Inventory the codebase

For the target tool, find and catalog every implementation file:

1. **Pages:** `ls frontend/src/app/(main)/[projectId]/<tool>/`
2. **Components:** `ls frontend/src/components/domain/<tool>/`
3. **Hooks:** `grep -r "use-<tool>" frontend/src/hooks/` or glob `use-<tool>*.ts`
4. **API routes:** `ls frontend/src/app/api/projects/[projectId]/<tool>/`
5. **Services:** `ls frontend/src/services/<tool>*`
6. **Schemas:** `ls frontend/src/lib/schemas/<tool>*`
7. **DB tables:** `grep -A 30 '<tool_table>' frontend/src/types/database.types.ts`
8. **Migrations:** `ls supabase/migrations/*<tool>*`

For each file found, note: file path, what it does (page/component/hook/route), key exports.

### Step 1.4 — Read existing investigation reports

Check if a prior investigation exists:

```
.claude/investigations/<tool>/investigation-report.md
```

### Output

Save to: `_bmad-output/planning-artifacts/<tool-name>/verification/01-codebase-inventory.md`

Format:

```markdown
# <Tool Name> — Codebase Inventory

**Generated:** <date>
**Tool:** <tool-name>

## Existing Planning Artifacts
- [list each file found in _bmad-output/planning-artifacts/<tool>/]

## Procore Reference Docs
- [list relevant reference docs found]

## Implementation Files

### Pages
| File | Route | Description |
|------|-------|-------------|

### Components
| File | Exports | Description |
|------|---------|-------------|

### Hooks
| File | Hook Name | Description |
|------|-----------|-------------|

### API Routes
| File | Method | Endpoint | Description |
|------|--------|----------|-------------|

### Database
| Table | Key Columns | Notes |
|-------|-------------|-------|

### Migrations
| File | Description |
|------|-------------|

## Prior Investigation Findings
- [summary if exists, "None" if not]
```

---

## Phase 2: Procore Documentation & Best Practices

**Goal:** Understand what Procore officially offers for this tool, plus industry best practices.

**Agent strategy:** Use `web-search-researcher` agent for web research. Run in parallel with Phase 1.

### Step 2.1 — Search Procore support docs

Search for: `site:support.procore.com "<tool-name>"` and `site:procore.com "<tool-name>" user guide`

Extract:
- Official feature list
- Field descriptions
- Workflow/status descriptions
- Permissions model
- Any tutorial or how-to pages

### Step 2.2 — Research best practices

Search for: `construction <tool-name> management best practices`

Capture:
- Industry-standard fields and workflows
- Common integrations
- Reporting requirements
- Compliance considerations

### Output

Save to: `_bmad-output/planning-artifacts/<tool-name>/verification/02-procore-reference.md`

Format:

```markdown
# <Tool Name> — Procore Reference & Best Practices

**Generated:** <date>

## Procore Official Features
- [feature list from support docs]

## Field Descriptions (from Procore docs)
| Field | Description | Required |
|-------|-------------|----------|

## Workflow / Statuses
| Status | Description | Transitions |
|--------|-------------|-------------|

## Permissions
| Role | Access Level |
|------|-------------|

## Industry Best Practices
- [key findings from web research]

## Sources
- [URLs referenced]
```

---

## Phase 3: Live Crawl & Screenshots

**Goal:** Capture every page and form of the tool in live Procore with screenshots.

**Agent strategy:** This phase runs sequentially using `agent-browser` directly. Cannot be parallelized.

### Step 3.0 — Authenticate

Load credentials and log into Procore:

```bash
# Load credentials
source .env 2>/dev/null || export $(grep -E '^(PROCORE_USER|PROCORE_PASSWORD)=' .env | xargs)

# Check for saved auth state first
agent-browser state load procore-auth.json 2>/dev/null

# If no saved state, log in fresh
agent-browser open "https://login.procore.com/login"
agent-browser wait --load networkidle
agent-browser snapshot -i
# Fill email → submit → fill password → submit (use refs from snapshot)
# Wait for redirect to project page

# Save auth state for future use
agent-browser state save procore-auth.json
```

### Step 3.1 — Create output directory

```bash
mkdir -p _bmad-output/planning-artifacts/<tool-name>/verification/screenshots
```

### Step 3.2 — Capture each page

For the target tool, navigate to each page and capture:

**Required screenshots (capture ALL that exist):**

| Page | URL Pattern | Screenshot Name |
|------|-------------|----------------|
| List/index view | `/562949954728542/project/<tool>` | `01-list-view.png` |
| Detail view | `/562949954728542/project/<tool>/<id>` | `02-detail-view.png` |
| Create form (empty) | Click "Create" or "New" | `03-create-form.png` |
| Edit form (populated) | Click "Edit" on an item | `04-edit-form.png` |
| Each tab on detail view | Click each tab | `05-tab-<name>.png` |
| Settings/config | If tool has settings | `06-settings.png` |
| Dropdown menus | Click action menus | `07-actions-menu.png` |
| Filter panel | Open filters | `08-filters.png` |
| Export/print options | Open export | `09-export.png` |

**For each page, also capture:**

```bash
# Screenshot
agent-browser screenshot _bmad-output/planning-artifacts/<tool-name>/verification/screenshots/<name>.png

# Interactive snapshot (for form field extraction)
agent-browser snapshot -i > /tmp/<tool>-<page>-snapshot.txt
```

### Step 3.3 — Extract form fields from snapshots

From each form snapshot, document every field:

```markdown
### Create Form Fields
| Ref | Label | Type | Required | Placeholder/Options |
|-----|-------|------|----------|-------------------|
| @e3 | Title | text input | Yes | "Enter title..." |
| @e4 | Status | select | Yes | Draft, Pending, Approved |
| @e5 | Amount | number input | No | "$0.00" |
```

### Step 3.4 — Extract table columns

From list view snapshots:

```markdown
### List View Columns
| # | Column Name | Sortable | Filterable |
|---|-------------|----------|------------|
| 1 | # | Yes | No |
| 2 | Title | Yes | Yes |
| 3 | Status | Yes | Yes |
```

### Output

Save to: `_bmad-output/planning-artifacts/<tool-name>/verification/03-procore-screenshots.md`

Format:

```markdown
# <Tool Name> — Procore Live Crawl

**Generated:** <date>
**Procore Project:** 562949954728542

## Screenshots Captured

| # | Page | Screenshot | Notes |
|---|------|-----------|-------|
| 1 | List view | [screenshots/01-list-view.png] | Main table with X items |
| 2 | Detail view | [screenshots/02-detail-view.png] | Tabs: General, Items, ... |

## Form Fields

### Create Form
| Label | Type | Required | Options/Placeholder |
|-------|------|----------|-------------------|

### Edit Form
| Label | Type | Required | Options/Placeholder |
|-------|------|----------|-------------------|

## Table Columns
| Column | Sortable | Filterable |
|--------|----------|------------|

## Status Options
- [list all statuses found in dropdowns/badges]

## Action Menus
- [list all action items found in menus]

## Tabs (Detail View)
- [list all tabs with their content summary]
```

---

## Phase 4: Specs Generation

**Goal:** From Phases 1-3, produce concrete implementation specifications.

**Agent strategy:** Use `Plan` agent to synthesize specs from research.

### Step 4.1 — Database schema spec

Compare Procore fields (Phase 3) against existing DB schema (Phase 1). Produce:

```markdown
### Required Tables
| Table | Exists | Columns Needed |
|-------|--------|---------------|

### Required Columns (per table)
| Column | Type | Nullable | FK | Exists | Notes |
|--------|------|----------|----|---------|----- |
```

### Step 4.2 — Form field spec

Map every Procore form field to what we need:

```markdown
### Create Form
| Field | DB Column | Type | Validation | Exists |
|-------|-----------|------|-----------|--------|
```

### Step 4.3 — Component spec

List every page/component needed:

```markdown
### Pages Required
| Page | Route | Exists | Status |
|------|-------|--------|--------|

### Components Required
| Component | Purpose | Exists | Status |
|-----------|---------|--------|--------|
```

### Step 4.4 — Workflow spec

```markdown
### Statuses
| Status | DB Enum | UI Badge | Transitions | Exists |
|--------|---------|----------|-------------|--------|

### Actions
| Action | Trigger | Permission | Exists |
|--------|---------|-----------|--------|
```

### Output

Save to: `_bmad-output/planning-artifacts/<tool-name>/verification/04-implementation-specs.md`

---

## Phase 5: Cross-Comparison & Verification

**Goal:** Compare specs (Phase 4) against actual code (Phase 1). Verify with evidence.

**Agent strategy:** Use `codebase-analyzer` agents in parallel — one for DB, one for UI, one for API.

### Step 5.1 — Verify database

- Read `database.types.ts` for the tool's tables
- Compare columns against Phase 4 schema spec
- Mark each: `COMPLETE`, `PARTIAL` (wrong type, missing constraint), `MISSING`

### Step 5.2 — Verify API routes

- Read each API route file
- Check: does it handle all CRUD operations from the spec?
- Check: does it validate all required fields?
- Test endpoints if dev server is running

### Step 5.3 — Verify UI

- Read page and component files
- Check: do forms include all fields from spec?
- Check: does the table show all columns from spec?
- Check: are all statuses/workflows implemented?
- If dev server is running, use agent-browser to visually verify pages at localhost:3000

### Step 5.4 — Verify with agent-browser (optional but recommended)

If the dev server is running:

```bash
# Load test credentials
source .env 2>/dev/null || export $(grep -E '^(TEST_USER_1|TEST_PASSWORD_1)=' .env | xargs)

# Navigate to the tool page
agent-browser open "http://localhost:3000/<projectId>/<tool>"
agent-browser wait --load networkidle
agent-browser snapshot -i

# Compare what renders vs what the spec says should render
```

### Output

Save to: `_bmad-output/planning-artifacts/<tool-name>/verification/05-verification-report.md`

Format:

```markdown
# <Tool Name> — Verification Report

**Generated:** <date>

## Summary

| Category | Complete | Partial | Missing | Total | Score |
|----------|----------|---------|---------|-------|-------|
| DB Schema | X | X | X | X | X% |
| API Routes | X | X | X | X | X% |
| Form Fields | X | X | X | X | X% |
| Table Columns | X | X | X | X | X% |
| Statuses | X | X | X | X | X% |
| Pages | X | X | X | X | X% |
| **Overall** | X | X | X | X | **X%** |

## Database Schema

| Column | Spec Type | Actual Type | Status | Notes |
|--------|----------|-------------|--------|-------|
| title | text | text | COMPLETE | — |
| amount | decimal | — | MISSING | Need migration |

## API Routes

| Endpoint | Method | Spec | Status | Notes |
|----------|--------|------|--------|-------|

## Form Fields

| Field | Spec | Actual | Status | Notes |
|-------|------|--------|--------|-------|

## Table Columns

| Column | Spec | Actual | Status | Notes |
|--------|------|--------|--------|-------|

## Statuses / Workflows

| Status | Spec | Actual | Status | Notes |
|--------|------|--------|--------|-------|

## Pages

| Page | Route | Status | Notes |
|------|-------|--------|-------|

## Evidence
- [screenshots taken during verification]
- [console output from test runs]
```

---

## Phase 6: Task List Creation

**Goal:** Convert every `PARTIAL` and `MISSING` item from Phase 5 into actionable tasks.

### Step 6.1 — Extract gaps

From the verification report, collect every item that is NOT `COMPLETE`.

### Step 6.2 — Group and prioritize

Group by implementation layer, then prioritize:

- **HIGH** — Blocks core workflows, data integrity, or user-facing CRUD
- **MEDIUM** — Reduces functionality, workaround exists
- **LOW** — Polish, cosmetic, rarely used features

### Step 6.3 — Estimate complexity

- **S** — Single file change, < 30 min (add a column, add a field)
- **M** — Multi-file change, ~1-2 hours (new API route + hook + form field)
- **L** — New feature/page, ~half day (new detail page, new workflow)
- **XL** — Major feature, ~1+ day (new tool from scratch)

### Output

Save to: `_bmad-output/planning-artifacts/<tool-name>/verification/06-task-list.md`

Format:

```markdown
# <Tool Name> — Verified Task List

**Generated:** <date>
**Based on:** Verification report from Phase 5
**Overall completion:** X%

## HIGH Priority

### Database Changes
- [ ] [S] Add `amount` column to `<table>` — `ALTER TABLE ... ADD COLUMN`
- [ ] [M] Add `status` enum type — migration + type regen

### API Routes
- [ ] [M] Create POST endpoint for `/<tool>` — route + validation + hook
- [ ] [S] Add `amount` to PATCH validation schema

### UI / Forms
- [ ] [M] Add `amount` field to create form — schema + component
- [ ] [L] Build detail page with tabs — page + components

### Workflows
- [ ] [M] Implement Approved status transition — DB + API + UI

## MEDIUM Priority

- [ ] [S] Add `due_date` column to list table
- [ ] [M] Implement bulk select + delete
- [ ] [S] Add sorting to Amount column

## LOW Priority

- [ ] [S] Match placeholder text from Procore
- [ ] [S] Add tooltip to status badge

---

## Execution Order (recommended)

1. Database migrations (all schema changes first)
2. Run `npm run db:types` to regenerate types
3. API routes (CRUD endpoints)
4. Hooks (React Query wrappers)
5. Forms (create/edit with validation)
6. Pages (list view, detail view)
7. Workflow (status transitions, actions)
8. Polish (tooltips, placeholders, etc.)
```

---

## Execution Strategy

When running this skill, use this agent orchestration:

### Phases 1 + 2: Run in PARALLEL

```
Agent 1 (codebase-analyzer): Phase 1 — inventory codebase + read planning artifacts
Agent 2 (web-search-researcher): Phase 2 — Procore docs + best practices research
```

Both agents get explicit paths — no searching required.

### Phase 3: SEQUENTIAL (browser interaction)

Run directly in main context using `agent-browser`. Cannot be parallelized.

### Phase 4: SEQUENTIAL

Depends on Phases 1-3. Synthesize into specs.

### Phase 5: Run sub-checks in PARALLEL

```
Agent A: Verify database schema
Agent B: Verify API routes
Agent C: Verify UI components + forms
```

### Phase 6: SEQUENTIAL

Depends on Phase 5. Convert gaps to tasks.

---

## Quick Reference

| What | Where |
|------|-------|
| **Planning artifacts** | `_bmad-output/planning-artifacts/<tool>/` |
| **Planning index** | `_bmad-output/planning-artifacts/INDEX.md` |
| **Procore reference docs** | `docs/procore-reference/` |
| **Procore credentials** | `.env` → `PROCORE_USER`, `PROCORE_PASSWORD` |
| **App test credentials** | `.env` → `TEST_USER_1`, `TEST_PASSWORD_1` |
| **Procore project ID** | `562949954728542` |
| **Auth state (saved)** | `procore-auth.json` (via `agent-browser state save`) |
| **Playwright auth** | `frontend/tests/.auth/user.json` |
| **Existing crawlers** | `scripts/playwright-crawl/scripts/crawlers/` |
| **Frontend pages** | `frontend/src/app/(main)/[projectId]/<tool>/` |
| **Components** | `frontend/src/components/domain/<tool>/` |
| **Hooks** | `frontend/src/hooks/use-<tool>*.ts` |
| **API routes** | `frontend/src/app/api/projects/[projectId]/<tool>/` |
| **DB types** | `frontend/src/types/database.types.ts` |
| **Output directory** | `_bmad-output/planning-artifacts/<tool>/verification/` |
