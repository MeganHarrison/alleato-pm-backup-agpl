---
name: procore-docs-rag
description: >
  Query the Procore support article embeddings stored in Supabase before planning
  or implementing any feature, fix, or behavior tied to Procore functionality.
  Use when: building a feature that mirrors Procore, fixing behavior where the
  correct Procore behavior is unclear, verifying statuses/workflows/field names,
  or any time you would otherwise guess how Procore works.
argument-hint: "<your question about Procore>"
---

# Procore Docs RAG — Ground Truth Lookup (Three-Tier)

**Purpose:** Find authoritative Procore behavior before writing a single line of code.
This skill now has three escalating tiers so you never hit a dead end.

| Tier | Source | Best for |
|------|--------|----------|
| 1 | Supabase RAG (560 embedded articles) | Workflows, statuses, business rules |
| 2 | Deep Crawl Manifests (live DOM captures) | Exact field names, columns, tabs, options |
| 3 | Procore Support Site (WebFetch) | Full article text when embeddings give partial chunks |

Run all three tiers for complex features. They answer different questions.

---

## WHEN TO USE THIS SKILL

Use this **before** any of the following:

- Building a page/form/workflow that mirrors a Procore tool
- Fixing a bug where the expected behavior is ambiguous
- Planning statuses, transitions, field names, or validation rules
- Deciding whether a field is required, optional, or conditionally required
- Implementing a financial calculation (markup %, tax %, budget impact)
- Deciding what columns belong in a list view or what tabs belong on a detail view
- Any time you're about to guess how Procore does something

**Do not skip this step and rely on training data.** Procore has specific, non-obvious
behaviors (e.g., how PCOs relate to CCOs, what triggers a budget impact, which fields
are read-only after approval) that training data regularly gets wrong.

---

## TIER 1 — Supabase RAG

Run from the **project root**:

```bash
node scripts/procore-docs-query.js "your question here"
node scripts/procore-docs-query.js "invoicing workflow" 12   # optional topK (default 8)
```

### Score thresholds

| Score | Action |
|-------|--------|
| ≥ 80% | **Authoritative.** Use directly. |
| 60–79% | Good. Use with the article title as context. |
| 40–59% | Partial. Supplement with Tier 2 or 3. |
| < 40% | Low signal. Rephrase query, then escalate. |

### When RAG results are weak

1. **Rephrase** — use Procore's own terminology (e.g., "PCO" not "change request")
2. **Broaden** — remove specifics ("budget" instead of "budget forecast to complete column")
3. **Use category terms** — "prime contract", "commitment", "direct cost", "change event"
4. After two attempts with no strong results → proceed to Tier 2 and/or Tier 3

### Example queries

```bash
node scripts/procore-docs-query.js "what statuses does a change order go through"
node scripts/procore-docs-query.js "how does forecast to complete work in the budget"
node scripts/procore-docs-query.js "what fields are required when creating a commitment"
node scripts/procore-docs-query.js "how do potential change orders relate to change events"
node scripts/procore-docs-query.js "what happens to budget when a prime contract change order is approved"
node scripts/procore-docs-query.js "what is the difference between direct costs and commitments"
```

### What to do with results

1. **Read the content chunks**, not just the titles
2. **Note exact field names, status names, and workflow steps** — use Procore's exact
   wording in forms, labels, and status badges
3. **Note which fields are required** — match Procore's validation rules
4. **Note workflow transitions** — statuses have specific allowed transitions in Procore
5. **Save the source URLs** — you'll use them in Tier 3 if you need the full article

---

## TIER 2 — Deep Crawl Manifests (Live DOM Captures)

These files were captured by a Playwright script that literally scraped the live Procore
UI and saved the raw DOM + structured field extraction. They are authoritative for
**structural questions**: what columns, fields, tabs, and options does Procore actually
show?

### Manifest location

```
.claude/procore-manifests/{tool-slug}/
  manifest.json          ← structured field/column/tab extraction
  dom/list.html          ← raw HTML of the list view (100% trustworthy)
  dom/create-form.html   ← raw HTML of the create form
  dom/detail-*.html      ← raw HTML of detail states
  screenshots/           ← PNG screenshots (visual reference only)
```

### Available tool slugs

```
budget          change-events   change-orders   commitments
daily-log       direct-costs    directory       documents
drawings        invoicing       photos          prime-contracts
punch-list      rfis            specifications  submittals
```

### How to read a manifest

```bash
# Read the structured manifest
Read .claude/procore-manifests/{tool-slug}/manifest.json

# Read raw DOM for a specific state (list, create-form, detail)
Read .claude/procore-manifests/{tool-slug}/dom/list.html
```

### Mandatory checks when reading a manifest

For every tool you read, explicitly verify these fields are populated (non-empty arrays):

| Field | What it tells you | Empty = problem |
|-------|-------------------|-----------------|
| `states.list.columns` | List view column headers | ✅ Must recrawl |
| `states.list.rowActions` | Per-row action buttons (Edit, Delete, etc.) | ✅ Must recrawl |
| `states.list.toolbarActions` | **Create button options, Export, Import, Print** | ✅ Must recrawl |
| `states.list.tabs` | View tabs (Items, Packages, Ball In Court, etc.) | ✅ Must recrawl |
| `states.list.filters` | Filter options in the toolbar | ✅ Must recrawl |
| `states.create-form.formSections` | Create form fields | ✅ Must recrawl |

**If any of these are empty arrays `[]`, the crawler captured an incomplete render.**
Procore is a JavaScript SPA — the crawler sometimes captures the HTML shell before the UI renders.
**Do not proceed with an incomplete manifest. Recrawl first.**

### If manifest data is missing or empty → RECRAWL

Run from the `scripts/playwright-crawl/` directory:

```bash
cd /Users/meganharrison/Documents/alleato-pm/scripts/playwright-crawl
node procore-deep-crawl.js {tool-slug}
```

Then re-read the manifest and confirm the fields above are populated before continuing.

The recrawl opens a real browser, logs into Procore, navigates to the tool, and captures the fully-rendered DOM. It overwrites the manifest and dom/ files in `.claude/procore-manifests/{tool-slug}/`.

### Mandatory Tier 1 queries for every tool

In addition to your topic-specific queries, **always** run these four for the tool you are researching:

```bash
node scripts/procore-docs-query.js "{tool} toolbar actions create button options"
node scripts/procore-docs-query.js "{tool} export pdf csv print"
node scripts/procore-docs-query.js "{tool} list view tabs navigation"
node scripts/procore-docs-query.js "{tool} row actions menu options"
```

These catch toolbar Create dropdowns, export functionality, view tabs, and per-row actions — features that are easy to miss if you only query for fields and workflows.

### What to trust in manifest.json

**TRUSTWORTHY — extracted directly from DOM elements:**
- `states[].columns[].label` — exact column headers in the list view
- `states[].formSections[].fields[].label` — exact field labels
- `states[].formSections[].fields[].type` — field type (text, select, date, etc.)
- `states[].formSections[].fields[].required` — required flag
- `states[].formSections[].fields[].options[]` — dropdown option values
- `states[].formSections[].fields[].placeholder` — placeholder text
- `states[].tabs[]` — tab names on detail views
- `states[].filters[]` — filter options
- `states[].rowActions[]` — row-level action buttons
- `states[].toolbarActions[]` — toolbar buttons including Create dropdown and Export
- `states[].headerFields[]` — header/summary fields

**USE WITH CAUTION — may contain summarized or inferred content:**
- `states[].description` — written by the crawl script, not Procore
- `states[]._capture_note` — may be AI-generated annotation
- Any field that reads like a prose sentence rather than a UI label

**If in doubt, cross-reference with the raw DOM HTML** — the HTML files contain only
what was literally rendered on the page. There is zero hallucination risk in raw HTML.

### Example: checking what columns the Change Orders list shows

```bash
# Read the manifest and look at states.list.columns
Read .claude/procore-manifests/change-orders/manifest.json
```

### Example: checking what fields are on the Commitment create form

```bash
# Read the manifest for form sections and fields
Read .claude/procore-manifests/commitments/manifest.json
# If manifest fields look incomplete, read the raw DOM
Read .claude/procore-manifests/commitments/dom/create-form.html
```

---

## TIER 3 — Procore Support Site (WebFetch)

Use WebFetch to get the full content of Procore support articles when:
- Tier 1 returned a URL but only a 500-char chunk (you need the full article)
- You need to verify a specific workflow step that the chunk cut off
- Tier 1 and Tier 2 together don't answer the question

### Option A: Fetch a full article from a RAG result URL

RAG results include a `URL` field pointing to the official Procore support article.
Fetch it directly:

```
WebFetch https://support.procore.com/faq/...     (URL from RAG result)
```

### Option B: Search the Procore documentation site

The Procore v2 support site is at `https://v2.support.procore.com/`. If you need to
discover articles the RAG doesn't surface, fetch the site and follow relevant links:

```
WebFetch https://v2.support.procore.com/
```

You can also construct likely article URLs based on the tool name, e.g.:
```
WebFetch https://v2.support.procore.com/hc/en-us/categories/change-orders
```

### What to trust from WebFetch

Everything fetched from `v2.support.procore.com` or `support.procore.com` is
**official Procore documentation** — treat it as authoritative. Read it the same
way you would the RAG chunks: note exact field names, statuses, and workflow steps.

---

## COMBINING ALL THREE TIERS

For complex features, run all tiers:

```bash
# Example: implementing the Invoicing feature

# Tier 1 — business rules and workflows
node scripts/procore-docs-query.js "invoice statuses and approval workflow"
node scripts/procore-docs-query.js "what fields are required on an invoice"
node scripts/procore-docs-query.js "how does invoicing relate to commitments"

# Tier 2 — exact UI structure from live Procore
Read .claude/procore-manifests/invoicing/manifest.json
Read .claude/procore-manifests/invoicing/dom/create-form.html   # if field detail needed

# Tier 3 — if a specific workflow step is still unclear
WebFetch https://support.procore.com/faq/...   # URL from Tier 1 results
```

---

## OUTPUT — Save Findings

**After completing research, always save findings to a report file.** Do not just output to the conversation.

### Naming convention

```
docs/reports/procore-<tool-slug>-<topic>.md
```

Examples:
- `docs/reports/procore-submittals-gap-analysis.md`
- `docs/reports/procore-invoicing-workflow.md`
- `docs/reports/procore-change-orders-statuses.md`

If no clear tool slug applies (e.g. a cross-tool question), use `procore-research-<topic>.md`.

### Report template

```markdown
# Procore Research: <Topic>

**Date:** <today's date>
**Question:** <the original question asked>
**Sources used:** Tier 1 (RAG) | Tier 2 (Manifest) | Tier 3 (WebFetch)

## Findings

<all findings — field names, statuses, workflows, gaps, etc.>

## Gap Summary (if a gap analysis)

<table or list comparing Procore vs our implementation>

## Sources

<list of Procore support article URLs consulted>
```

### Steps

1. Complete all relevant tiers
2. Write the report using the Write tool to `docs/reports/<filename>.md`
3. Tell the user: "Findings saved to `docs/reports/<filename>.md`"

---

## QUICK REFERENCE

| What | Detail |
|------|--------|
| RAG script | `scripts/procore-docs-query.js` (run from project root) |
| RAG data source | Supabase `search_support_articles` RPC |
| Embedding model | `text-embedding-3-large` (3072 dims) |
| Articles indexed | 560 Procore support pages |
| Manifest base path | `.claude/procore-manifests/` |
| Manifest tools | budget, change-events, change-orders, commitments, daily-log, direct-costs, directory, documents, drawings, invoicing, photos, prime-contracts, punch-list, rfis, specifications, submittals |
| Support site | `https://v2.support.procore.com/` |
| Env vars needed | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY` (all in `frontend/.env`) |
| Production API | `POST /api/procore-docs/ask` (requires session auth — use script for CLI) |
| Chat UI | `/procore-docs` page in the app |
