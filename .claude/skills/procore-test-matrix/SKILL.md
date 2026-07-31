---
name: procore-test-matrix
description: >
  Generate a comprehensive testing checklist for any Procore tool by querying the
  indexed Procore documentation in Supabase. Use when: "create testing document for [tool]",
  "generate test matrix for [tool]", "what needs to be tested in [tool]", or any request
  to produce a feature test checklist for a specific Procore tool.
argument-hint: <tool-name>
---

# Procore Test Matrix Generator

Generate a comprehensive, itemized testing checklist for a Procore tool by pulling
feature documentation from the indexed Procore docs in Supabase, then synthesizing
it into a structured test matrix document.

**Invocation:** `/procore-test-matrix <tool-name>`

**Example:** `/procore-test-matrix photos`

**Output:** `docs/testing/<tool-name>-test-matrix.md`

---

## What This Skill Does

1. Queries Supabase for all indexed Procore documentation about the tool
2. Extracts every feature, workflow, field, status, and action mentioned
3. Synthesizes a structured test matrix grouped by feature category
4. Saves the document to `docs/testing/<tool-name>-test-matrix.md`
5. **Seeds all test cases into Supabase** (`test_suites` + `test_cases` tables)
6. Test cases are immediately trackable in the Test Runner at `/test-matrix`

The Procore RAG database (`document_chunks` + `search_support_articles`) is the
source of truth — not your memory, not the codebase. You are generating tests
for Procore's features, which are the target the Alleato implementation must match.

---

## Step 1: Query Supabase for Tool Documentation

The Procore docs are stored in two tables:
- `support_articles` — article metadata (title, url, category, subcategory, breadcrumb, markdown_content)
- `support_article_chunks` — chunked text content with embeddings (joins to support_articles via article_id)

Use the Supabase MCP to run these queries. Execute all in parallel.

### Query A — Article titles matching the tool

```sql
-- Find all Procore support articles about this tool
SELECT id, title, url, category, subcategory, breadcrumb, markdown_content
FROM support_articles
WHERE
  lower(title) LIKE lower('%<tool-name>%')
  OR lower(category) LIKE lower('%<tool-name>%')
  OR lower(subcategory) LIKE lower('%<tool-name>%')
ORDER BY
  CASE WHEN lower(title) LIKE lower('%<tool-name>%') THEN 0 ELSE 1 END,
  title
LIMIT 40;
```

### Query B — Tutorial and how-to articles (highest signal)

```sql
-- Tutorial pages have the most testable step-by-step content
SELECT sa.title, sa.url, sa.category, sa.subcategory, sac.chunk_text, sac.heading
FROM support_articles sa
JOIN support_article_chunks sac ON sac.article_id = sa.id
WHERE
  lower(sa.title) LIKE lower('%<tool-name>%')
  AND (
    lower(sa.url) LIKE '%tutorial%'
    OR lower(sa.title) LIKE '%create%'
    OR lower(sa.title) LIKE '%upload%'
    OR lower(sa.title) LIKE '%manage%'
    OR lower(sa.title) LIKE '%configure%'
    OR lower(sa.title) LIKE '%edit%'
    OR lower(sa.title) LIKE '%delete%'
    OR lower(sa.title) LIKE '%add%'
  )
ORDER BY sa.title, sac.chunk_index
LIMIT 40;
```

### Query C — Permission and workflow chunks

```sql
-- Permission tables and workflow docs contain status/role/approval info
SELECT sa.title, sa.url, sa.category, sac.chunk_text, sac.heading
FROM support_articles sa
JOIN support_article_chunks sac ON sac.article_id = sa.id
WHERE
  lower(sa.title) LIKE lower('%<tool-name>%')
  AND (
    lower(sac.chunk_text) LIKE '%permission%'
    OR lower(sac.chunk_text) LIKE '%workflow%'
    OR lower(sac.chunk_text) LIKE '%status%'
    OR lower(sac.chunk_text) LIKE '%approve%'
    OR lower(sac.chunk_text) LIKE '%role%'
    OR lower(sac.chunk_text) LIKE '%notification%'
  )
ORDER BY sa.title, sac.chunk_index
LIMIT 30;
```

**If the tool name doesn't match titles well**, also search chunk text:

```sql
SELECT sa.title, sa.url, sa.category, sac.chunk_text, sac.heading
FROM support_articles sa
JOIN support_article_chunks sac ON sac.article_id = sa.id
WHERE lower(sac.chunk_text) LIKE lower('%<tool-name>%')
ORDER BY sa.title, sac.chunk_index
LIMIT 30;
```

---

## Step 2: Extract All Features

From the query results, read every chunk and extract every distinct feature, action,
field, status, configuration option, and workflow mentioned. Organize into these categories:

| Category | What to look for |
|----------|-----------------|
| **Core Actions** | Create, Edit, Delete, Upload, Download, Export, Import, Publish |
| **Views & Navigation** | List view, Detail view, Tabs, Filters, Search, Sort |
| **Fields & Data** | Form fields, Column headers, Required vs optional, Field types |
| **Statuses & Workflows** | Status values, Transition rules, Approval flows |
| **Collaboration** | Mentions, Comments, @mentions, Email notifications, Subscriptions |
| **Mobile** | Mobile-specific features, Offline access, App-specific behavior |
| **Permissions** | Who can do what, Admin-only features, Role-based access |
| **Integrations** | Links to other tools (RFIs, Change Orders, etc.), Cross-tool actions |
| **Settings & Config** | Tool-level settings, Project-level settings, Default values |
| **Reporting & Export** | Reports, PDF export, CSV export, Print, Log views |
| **Advanced / Edge Cases** | Bulk actions, QR codes, OCR, Versioning, History |

Do NOT invent features. Only include things explicitly mentioned in the source docs.
If a feature category is not mentioned in the docs, omit it.

---

## Step 3: Generate the Test Matrix Document

Using the extracted features, produce the test matrix in this exact format:

```markdown
# <Tool Name> — Procore Feature Test Matrix

**Generated:** <date>
**Source:** Procore documentation (Supabase RAG — <N> docs retrieved)
**Tool:** <tool-name>
**Purpose:** Comprehensive testing checklist to verify all Procore features are
             implemented and working in Alleato PM.

---

## Summary

| Category | # Tests | Priority |
|----------|---------|---------|
| Core Actions | X | HIGH |
| Views & Navigation | X | HIGH |
| Fields & Data | X | HIGH |
| Statuses & Workflows | X | HIGH |
| Collaboration | X | MEDIUM |
| Mobile | X | MEDIUM |
| Permissions | X | MEDIUM |
| Integrations | X | MEDIUM |
| Settings & Config | X | LOW |
| Reporting & Export | X | MEDIUM |
| Advanced Features | X | LOW |
| **TOTAL** | **X** | |

---

## 1. Core Actions

> Source: Procore [Tool Name] documentation

### 1.1 Create

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
| 1.1.1 | Create a new [item] | 1. Click "Create" / "New" button<br>2. Fill required fields<br>3. Submit | [Item] appears in list with correct data | HIGH | 🔲 | |
| 1.1.2 | Create with all optional fields | Fill every available field | All fields saved correctly | MEDIUM | 🔲 | |
| 1.1.3 | Create with missing required fields | Leave required field blank | Validation error shown, form not submitted | HIGH | 🔲 | |
| ... | ... | ... | ... | ... | 🔲 | |

### 1.2 Edit

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
| 1.2.1 | Edit an existing [item] | 1. Open [item]<br>2. Click "Edit"<br>3. Change a field<br>4. Save | Changes persist after refresh | HIGH | 🔲 | |
| ... | ... | ... | ... | ... | 🔲 | |

### 1.3 Delete

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
| 1.3.1 | Delete a [item] | 1. Select [item]<br>2. Click Delete / action menu<br>3. Confirm deletion | [Item] removed from list | HIGH | 🔲 | |
| ... | ... | ... | ... | ... | 🔲 | |

[Continue for each core action found: Upload, Download, Export, Import, Publish, etc.]

---

## 2. Views & Navigation

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
| 2.1 | List view loads | Navigate to /<tool-name> | Table renders with columns: [list columns from docs] | HIGH | 🔲 | |
| 2.2 | Detail view loads | Click on any row | Detail page renders without errors | HIGH | 🔲 | |
| 2.3 | Search | Type in search box | Results filter to matching items | HIGH | 🔲 | |
| 2.4 | Filter by [field] | Apply filter | Only matching items shown | MEDIUM | 🔲 | |
| 2.5 | Sort by column | Click column header | Rows reorder correctly | MEDIUM | 🔲 | |
[Add specific tabs, views, and navigation features from docs]

---

## 3. Fields & Data

> These fields were documented in Procore for [Tool Name]

### 3.1 Create / Edit Form Fields

| # | Field | Type | Required | Test: Accepts Valid Input | Test: Rejects Invalid | Priority | Result |
|---|-------|------|---------|--------------------------|----------------------|---------|--------|
[List every form field mentioned in docs with type and required status]

### 3.2 List Table Columns

| # | Column | Sortable | Test: Renders | Test: Data Accurate | Priority | Result |
|---|--------|---------|--------------|-------------------|---------|--------|
[List every table column mentioned in docs]

---

## 4. Statuses & Workflows

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
[For each status found in docs:]
| 4.1 | Set status to [Status] | Create/edit → set status dropdown | Status badge shows correct color and label | HIGH | 🔲 | |
| 4.2 | Transition from [A] to [B] | Open [item] in status A → perform action | Status changes to B | HIGH | 🔲 | |
[For each workflow action: Approve, Submit, Reject, Reopen, etc.]

---

## 5. Collaboration Features

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
[Only include sections mentioned in docs — comments, @mentions, notifications, etc.]

---

## 6. Mobile

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
[Only include if mobile is mentioned in docs]

---

## 7. Permissions

| # | Test | Role | Action | Expected | Priority | Result | Notes |
|---|------|------|--------|---------|---------|--------|-------|
[For each permission level mentioned in docs]

---

## 8. Integrations & Cross-Tool Links

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
[For each cross-tool integration mentioned in docs: e.g., link to RFI, Change Order, etc.]

---

## 9. Settings & Configuration

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
[Only include if settings are mentioned in docs]

---

## 10. Reporting & Export

| # | Test | Steps | Expected | Priority | Result | Notes |
|---|------|-------|----------|---------|--------|-------|
[For each export/report type mentioned in docs]

---

## 11. Advanced Features

| # | Feature | Test | Steps | Expected | Priority | Result | Notes |
|---|---------|------|-------|----------|---------|--------|-------|
[OCR, QR codes, bulk actions, offline mode, versioning, history — only if in docs]

---

## Sources

The following Procore documentation pages were used to generate this test matrix:

| # | Title | URL | Category |
|---|-------|-----|---------|
[List each unique source doc]

---

## Testing Session Log

| Date | Tester | Environment | Pass | Fail | Skip | Notes |
|------|--------|-------------|------|------|------|-------|
| | | localhost:3000 | | | | |
```

---

## Step 4: Save the Document

Save to:
```
docs/testing/<tool-name>-test-matrix.md
```

Create the `docs/testing/` directory if it doesn't exist.

---

## Step 5: Seed Test Cases into Supabase

After saving the markdown, upsert all test cases into the Supabase tracking tables
so they can be tracked, run, and managed from the Test Runner UI at `/test-matrix`.

**Supabase project:** `lgveqfnpkxvzbnnwuled`

### 5a — Upsert the suite

```sql
INSERT INTO public.test_suites (tool_name, display_name, source_doc_count, total_cases)
VALUES ('<tool-name>', '<Display Name>', <N docs>, <N cases>)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  source_doc_count = EXCLUDED.source_doc_count,
  total_cases = EXCLUDED.total_cases,
  last_generated_at = now()
RETURNING id;
```

### 5b — Bulk insert test cases (upsert on test_number)

Use a single INSERT with `ON CONFLICT (suite_id, test_number) DO UPDATE` so
re-running the skill refreshes test case text without duplicating rows.

```sql
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name, steps, expected_result, priority)
VALUES
  ('<suite_id>', '1.1.1', 'Core Actions', 'Create', 'Test name here', 'Step 1\nStep 2', 'Expected result', 'HIGH'),
  -- ... one row per test case
ON CONFLICT (suite_id, test_number) DO UPDATE SET
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  test_name = EXCLUDED.test_name,
  steps = EXCLUDED.steps,
  expected_result = EXCLUDED.expected_result,
  priority = EXCLUDED.priority,
  updated_at = now();
```

**Steps formatting:** Join numbered steps with `\n` (newline), not `<br>`.
**Priority values:** Must be exactly `HIGH`, `MEDIUM`, or `LOW`.

### 5c — Verify

```sql
SELECT ts.tool_name, ts.total_cases, COUNT(tc.id) as actual_cases
FROM test_suites ts
LEFT JOIN test_cases tc ON tc.suite_id = ts.id
WHERE ts.tool_name = '<tool-name>'
GROUP BY ts.tool_name, ts.total_cases;
```

---

## Step 6: Report to User

After saving, report:

1. **Total test count** — how many tests were generated
2. **Source count** — how many Procore docs were used
3. **Categories covered** — which of the 11 categories have tests
4. **File location** — where the document was saved
5. **Supabase seed** — confirm cases inserted and suite ID
6. **Test Runner URL** — `http://localhost:3000/test-matrix`
7. **Top 3 HIGH priority areas** — most critical things to test first

---

## Quality Rules

- **Never invent tests** for features not mentioned in the Procore docs
- **Never skip** features that ARE mentioned — be comprehensive
- **Always include steps** — vague "test X works" entries are useless
- **Always include expected result** — what does success look like?
- **Assign priority correctly:**
  - HIGH = Core CRUD, form submission, data persistence, status changes
  - MEDIUM = Filtering, sorting, notifications, mobile, permissions
  - LOW = Polish, edge cases, cosmetic details
- **Include negative tests** — what happens with invalid input, missing fields, etc.

---

## Quick Reference

| What | Where |
|------|-------|
| Procore article metadata | `support_articles` table (title, url, category, markdown_content) |
| Procore article text | `support_article_chunks` table (chunk_text, heading, embedding) |
| Vector search fn (needs embedding) | `search_support_articles` RPC |
| Full-text search fn | `fulltext_search_support_articles` RPC |
| Output directory | `docs/testing/` |
| All tool names | `docs/procore-reference/PROCORE-TOOLS.md` |
