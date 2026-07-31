---
name: procore-audit
description: >
  Audit a Procore tool against the Alleato PM implementation for feature parity.
  Use this skill whenever the user wants to: audit a Procore tool, check feature parity
  between Procore and Alleato, crawl a Procore tool's pages/forms/schemas, find missing
  functionality, generate a gap analysis, or verify that forms/fields/columns match Procore.
  Also use when the user mentions "procore audit", "feature parity", "crawl procore",
  "compare with procore", "what's missing from procore", or any variation of checking
  whether the Alleato app matches Procore's functionality for a specific tool.
---

# Procore Tool Audit

Audit a specific Procore tool by crawling its live pages, extracting structured data
(forms, fields, tables, workflows, statuses), then cross-referencing against the Alleato PM
implementation to produce a gap analysis report and actionable task list.

## When to use

- User says "audit [tool name]" or "crawl [tool name] on procore"
- User asks "what's missing from our [tool] implementation?"
- User wants to verify forms/fields match Procore exactly
- User asks for a gap analysis or feature parity check
- User wants to ensure a tool is fully implemented before release

## Prerequisites

- Procore credentials in `.env` (`PROCORE_USER`, `PROCORE_PASSWORD`)
- Node.js with Playwright installed (`npx playwright install chromium`)
- The Alleato PM frontend codebase at `frontend/`

## Overview

The audit runs in two sequential phases:

**Phase 1 — Crawl & Extract:** Crawl the live Procore tool, capture every page's DOM/screenshots/metadata, then run structured analysis to extract forms, fields, tables, validations, workflows, and statuses.

**Phase 2 — Compare & Report:** Cross-reference the extracted Procore data against the Alleato PM codebase (pages, components, hooks, API routes, database schema) to produce a gap analysis report with prioritized task list.

This two-phase approach ensures the crawl captures a complete picture before comparison begins — partial crawls lead to false negatives in the gap report.

---

## Phase 1: Crawl the Procore Tool

### Step 1.1 — Identify the tool and find/generate a crawler

Check if an existing crawler covers the target tool:

```bash
ls scripts/playwright-crawl/scripts/crawlers/
```

There are 21 existing comprehensive crawlers covering: budget, change-orders, commitments,
daily-logs, direct-costs, documents, drawings, emails, invoicing, meetings, photos,
prime-contracts, punch-list, rfis, schedule, scheduling, specifications, submittals,
support, transmittals.

**If a crawler exists:** Use it directly (e.g., `crawl-budget-comprehensive.js`).

**If no crawler exists:** Generate one:

```bash
cd scripts/playwright-crawl/scripts/generate
node generate-crawler.js <feature-name> <start-url> [project-id]
```

- Default project ID: `562949954728542`
- Start URL: the Procore URL for the tool's main page
- The generator creates a crawler from the standard template with automatic authentication

### Step 1.2 — Run the crawler

```bash
cd scripts/playwright-crawl
node scripts/crawlers/crawl-<tool>-comprehensive.js
```

The crawler automatically:
1. Loads credentials from `.env` (`PROCORE_USER`, `PROCORE_PASSWORD`)
2. Logs into Procore (handles login redirect)
3. Performs BFS traversal of all pages within the tool
4. For each page captures: `screenshot.png`, `dom.html`, `metadata.json`
5. Generates reports: `sitemap.json`, `detailed-report.json`, `link-graph.json`

**Output location:** Check the crawler's `OUTPUT_DIR` constant — typically under
`./documentation/*project-mgmt/in-progress/<tool>/crawl-<tool>/`

### Step 1.3 — Run structured analysis

After the crawl completes, run the feature analyzer on the captured DOM files:

```bash
cd scripts/playwright-crawl/scripts/analyze
node analyze-procore-features.js
```

This uses JSDOM to parse every captured `dom.html` and extracts:

| Category | What it extracts |
|----------|-----------------|
| **Forms** | Form ID, action, method, all input fields with name/type/required/placeholder/label |
| **Fields** | Field name, type, validation rules (pattern, min/max, minLength/maxLength), select options |
| **Tables** | Table headers, column names, sortable/filterable indicators |
| **Actions** | Button text, dropdown menu items, CRUD operation labels |
| **Validations** | Error messages, required field indicators |
| **Workflows** | Status badges, workflow actions (Approve/Reject/Submit/Review/Send/Lock/Unlock) |

**Analysis outputs** (saved to `outputs/analysis/`):
- `module-summary.json` — pages, forms, tables, fields, actions per module
- `field-inventory.json` — every field with occurrences, modules, types, required status
- `crud-operations.json` — create/read/update/delete actions per module
- `feature-analysis.md` — human-readable markdown report

### Step 1.4 — Review crawl completeness

Before proceeding to Phase 2, verify the crawl captured all expected pages:

1. Read `sitemap.json` — confirm all tool pages were visited
2. Read `module-summary.json` — confirm forms and tables were extracted
3. Read `feature-analysis.md` — scan for any empty modules or zero-field forms
4. If pages are missing, re-run the crawler with adjusted navigation patterns

**Do not proceed to Phase 2 until confident the crawl is complete.** Incomplete crawls
produce false gaps in the comparison report.

---

## Phase 2: Cross-Reference with Alleato PM

### Step 2.1 — Map Alleato implementation

For the target tool, locate and catalog all Alleato PM implementation artifacts:

**Frontend pages:**
```
frontend/src/app/(main)/[projectId]/<tool>/
```

**Components:**
```
frontend/src/components/domain/<tool>/
```

**React Query hooks:**
```
frontend/src/hooks/use-<tool>*.ts
```

**Services:**
```
frontend/src/services/<tool>Service.ts
```

**API routes:**
```
frontend/src/app/api/projects/[projectId]/<tool>/
```

**Database schema:**
```bash
# Generate fresh types first
npm run db:types
# Then read the relevant tables
grep -A 50 '<tool_table_name>' frontend/src/types/database.types.ts
```

**Zod schemas:**
```
frontend/src/lib/schemas/<tool>*.ts
```

For each artifact found, document:
- What pages exist and their routes
- What form fields are implemented (name, type, required, validation)
- What table columns are displayed
- What statuses/workflows are supported
- What CRUD operations are available
- What database columns exist

### Step 2.2 — Generate the gap analysis report

Compare the Procore extraction (Phase 1) against the Alleato implementation (Step 2.1)
using this exact format:

```markdown
# <Tool Name> — Procore vs. Alleato Gap Analysis

**Generated:** <date>
**Procore crawl:** <crawl output directory>
**Alleato path:** frontend/src/app/(main)/[projectId]/<tool>/

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| **Pages** | ✅/⚠️/❌ | X/Y pages implemented (Z%) |
| **List Table Columns** | ✅/⚠️/❌ | X/Y columns implemented (Z%) |
| **Form Fields** | ✅/⚠️/❌ | X/Y fields implemented (Z%) |
| **Status Workflow** | ✅/⚠️/❌ | X/Y statuses implemented |
| **CRUD Operations** | ✅/⚠️/❌ | Which operations exist |
| **Database Schema** | ✅/⚠️/❌ | Missing columns/relationships |
| **Validations** | ✅/⚠️/❌ | Required fields, patterns |

**Overall Verdict:** <COMPLETE / NEEDS MINOR WORK / NEEDS SIGNIFICANT WORK / NOT STARTED>
— approximately X% complete

## Page-by-Page Comparison

For each Procore page, list whether Alleato has an equivalent:

| Procore Page | Alleato Route | Status | Notes |
|-------------|---------------|--------|-------|
| List view | /[projectId]/<tool> | ✅ | — |
| Detail view | /[projectId]/<tool>/[id] | ⚠️ | Missing tabs |
| Create form | — | ❌ | Not implemented |

## Form Field Comparison

For each form found in Procore, compare field-by-field:

| Procore Field | Type | Required | Alleato Field | Status | Impact |
|--------------|------|----------|--------------|--------|--------|
| title | text | Yes | title | ✅ | — |
| amount | number | Yes | — | ❌ | HIGH |
| due_date | date | No | due_date | ✅ | — |

## Table Column Comparison

| Procore Column | Alleato Column | Status | Impact |
|---------------|---------------|--------|--------|
| # | number | ✅ | — |
| Title | title | ✅ | — |
| Amount | — | ❌ | HIGH |

## Missing Functionality

List everything Procore has that Alleato lacks, prioritized by impact:

### HIGH Impact (blocks core workflows)
- [ ] <description>

### MEDIUM Impact (reduces functionality)
- [ ] <description>

### LOW Impact (nice to have)
- [ ] <description>

## Status/Workflow Comparison

| Procore Status | Alleato Status | Implemented |
|---------------|---------------|-------------|
| Draft | Draft | ✅ |
| Pending | Pending | ✅ |
| Approved | — | ❌ |

## Database Schema Gaps

| Required Column | Type | Exists | Notes |
|----------------|------|--------|-------|
| amount | decimal | ❌ | Need migration |
| approved_date | timestamp | ❌ | Need migration |
```

**Status indicators:**
- ✅ = Fully implemented, matches Procore
- ⚠️ = Partially implemented (missing fields, wrong type, incomplete)
- ❌ = Not implemented / missing entirely

**Impact ratings:**
- **HIGH** = Blocks core workflows, data integrity issue, or user-facing gap
- **MEDIUM** = Reduces functionality but workaround exists
- **LOW** = Cosmetic, nice-to-have, or rarely used

### Step 2.3 — Save the gap report

Save the report to:
```
docs/PRPs/<tool>/gap-analysis-report.md
```

Also save structured JSON for programmatic use:
```
docs/PRPs/<tool>/gap-analysis.json
```

---

## Phase 3: Create Task List

### Step 3.1 — Convert gaps to actionable tasks

From the gap report, create a prioritized task list. Each task should be specific and
implementable:

```markdown
# <Tool Name> — Implementation Task List

## HIGH Priority (implement first)

- [ ] Add `amount` column to `<table>` — migration + type regen
- [ ] Add `amount` field to create/edit form — schema + component + hook
- [ ] Implement Approved status in workflow — database enum + UI + API
- [ ] Add missing "Export" action to list page toolbar

## MEDIUM Priority

- [ ] Add `due_date` column to list table
- [ ] Implement bulk delete action
- [ ] Add sorting to Amount column

## LOW Priority

- [ ] Add tooltip to status badge
- [ ] Match exact placeholder text from Procore
```

### Step 3.2 — Save the task list

Save to:
```
docs/PRPs/<tool>/implementation-tasks.md
```

---

## Phase 4: Implement Missing Functionality

For each task in the list, implement using the project's standard patterns:

1. **Database changes:** Write Supabase migration in `supabase/migrations/`
2. **Type regeneration:** Run `npm run db:types` after any schema change
3. **API routes:** Follow pattern in `frontend/src/app/api/projects/[projectId]/`
4. **React Query hooks:** Follow pattern in `frontend/src/hooks/use-*.ts`
5. **Components:** Use design system components from `@/components/ds/` and `@/components/ui/`
6. **Forms:** React Hook Form + Zod validation, matching Procore field types exactly
7. **Page layout:** Use `ProjectPageHeader` + `PageContainer` from `@/components/layout`

Implement in priority order (HIGH → MEDIUM → LOW). After each implementation:
- Run `npm run quality` to check types and lint
- Verify the change visually in the browser

---

## Phase 5: Test Everything

### Step 5.1 — Visual verification

Start the dev server and verify each implemented feature:

```bash
cd frontend && npm run dev
```

Use Puppeteer or Playwright to:
1. Navigate to the tool's pages
2. Verify all form fields render correctly
3. Submit test data through forms
4. Verify table columns display
5. Check status workflows
6. Confirm CRUD operations work end-to-end

### Step 5.2 — Automated tests

Write or update Playwright E2E tests:

```
frontend/tests/e2e/<tool>.spec.ts
```

Cover:
- Page loads without errors
- Form submission with valid data succeeds
- Form validation rejects invalid data
- Table displays correct columns
- CRUD operations complete successfully
- Status transitions work

### Step 5.3 — Re-run gap analysis

After implementation is complete, re-run Phase 1 and Phase 2 to verify:
- All ❌ items are now ✅
- No regressions introduced
- Update the gap report with final status

---

## Quick Reference

| What | Where |
|------|-------|
| Existing crawlers | `scripts/playwright-crawl/scripts/crawlers/` |
| Crawler generator | `scripts/playwright-crawl/scripts/generate/generate-crawler.js` |
| DOM analyzer | `scripts/playwright-crawl/scripts/analyze/analyze-procore-features.js` |
| Gap report template | Follow format in Step 2.2 above |
| Procore credentials | `.env` → `PROCORE_USER`, `PROCORE_PASSWORD` |
| Frontend pages | `frontend/src/app/(main)/[projectId]/<tool>/` |
| Components | `frontend/src/components/domain/<tool>/` |
| Hooks | `frontend/src/hooks/use-<tool>*.ts` |
| API routes | `frontend/src/app/api/projects/[projectId]/<tool>/` |
| Database types | `frontend/src/types/database.types.ts` |
| Feature tracker | `/procore-tracker` UI + `procore_features` / `procore_modules` tables |
| Gap reports output | `docs/PRPs/<tool>/` |
