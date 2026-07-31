---
name: test-scenario-writer
description: >
  DEPRECATED — use /test-scenario-audit instead.
argument-hint: <tool-name>
---

> **DEPRECATED — use `/test-scenario-audit` instead.**
>
> This skill is superseded by `/test-scenario-audit`, which produces BOTH a
> smoke suite (5–15 critical-path cases) AND a feature suite (20–40
> consolidated CRUD + workflow cases) per tool, seeded into Supabase with the
> new `test_suites.suite_type` column and emitted as markdown files under
> `docs/testing/scenarios/`.
>
> This skill:
> - References `scenario_depth` (removed from the schema on 2026-04-20)
> - Produces 50–120 exhaustive cases (too many; no longer the target)
> - Has no smoke/feature split
>
> Do not invoke this skill. Run `/test-scenario-audit <tool>` instead.
> Definition: `.claude/skills/testing/test-scenario-audit/SKILL.md`.

---

# Test Scenario Writer

Generate **exhaustive, plain-English test scenarios covering EVERY feature** of a
given Alleato tool. The goal is 100% feature coverage — every field, every action,
every status, every edge case — written so that a non-technical tester (who knows
nothing about construction or project management) can follow the steps and document
the outcome without asking a single question.

**Invocation:** `/test-scenario-writer <tool-name>`

**Example:** `/test-scenario-writer change-events`

**Output:**
- All scenarios seeded into Supabase `test_cases` table (type=scenario)
- Immediately available at `http://localhost:3000/testing`

---

## Coverage requirement

**Every feature must have at least one scenario.** Do not skip anything because it
seems minor. A missing test is a feature that will never be verified.

Use the Procore docs (same source as `/procore-test-matrix`) AND the codebase to
identify every feature. For each feature found in the docs, write a scenario. The
total count should be similar to what `/procore-test-matrix` produces — typically
50–120 scenarios depending on the tool.

---

## What Makes a Good Scenario

| Good scenario | Bad scenario |
|---|---|
| Steps written for a first-time user | Steps assume domain knowledge |
| Specific test data values provided | Vague ("click a record") |
| Clear pass/fail criteria anyone can judge | Ambiguous ("verify it works") |
| 2–6 steps per scenario | 15 steps crammed into one scenario |
| Tests one feature or action | Bundles unrelated features together |
| Includes negative tests (what should be blocked) | Only tests happy paths |
| Includes what to look for (expected result) | Missing success criteria |

**Golden rule:** If a college intern with no construction knowledge can follow the
steps without asking a question, the scenario is good.

---

## Step 1: Gather All Features

Query Supabase for Procore docs on this tool (same queries as `/procore-test-matrix`):

**Supabase project:** `lgveqfnpkxvzbnnwuled`

Run these in parallel:

**Query A** — Article titles:
```sql
SELECT id, title, url, category, subcategory
FROM support_articles
WHERE lower(title) LIKE lower('%<tool-name>%')
   OR lower(category) LIKE lower('%<tool-name>%')
ORDER BY CASE WHEN lower(title) LIKE lower('%<tool-name>%') THEN 0 ELSE 1 END, title
LIMIT 40;
```

**Query B** — Tutorial chunks (most testable content):
```sql
SELECT sa.title, sa.url, sac.heading, sac.chunk_text
FROM support_articles sa
JOIN support_article_chunks sac ON sac.article_id = sa.id
WHERE lower(sa.title) LIKE lower('%<tool-name>%')
ORDER BY sa.title, sac.chunk_index
LIMIT 80;
```

**Query C** — Permission/workflow chunks:
```sql
SELECT sa.title, sac.heading, sac.chunk_text
FROM support_articles sa
JOIN support_article_chunks sac ON sac.article_id = sa.id
WHERE lower(sa.title) LIKE lower('%<tool-name>%')
  AND (lower(sac.chunk_text) LIKE '%permission%'
    OR lower(sac.chunk_text) LIKE '%status%'
    OR lower(sac.chunk_text) LIKE '%workflow%'
    OR lower(sac.chunk_text) LIKE '%notification%')
ORDER BY sa.title, sac.chunk_index
LIMIT 40;
```

Also read the implementation to understand what fields and actions actually exist:
1. `frontend/src/app/(main)/[projectId]/<tool-slug>/` — pages
2. `frontend/src/app/api/projects/[projectId]/<tool-slug>/` — API routes
3. `docs/PRPs/<tool-slug>/` — product requirements (if exists)
4. `.claude/procore-manifests/<tool-slug>/manifest.json` — field detail (if exists)

---

## Step 2: Extract Every Feature

From the docs and codebase, list every distinct feature, field, action, status,
workflow, and setting. Do not skip anything.

Organize by category:

| Category | What to extract |
|----------|----------------|
| **Navigation & Views** | Page load, list view, detail view, tabs, grid vs list toggle |
| **Create** | Every form field (required + optional), validation rules, save behavior |
| **Edit** | Every editable field, inline edit vs form, cancel behavior, persists after refresh |
| **Delete** | Single delete, bulk delete, confirm dialog, soft delete vs hard delete |
| **Status & Workflow** | Every status value, every valid transition, approval/rejection flows |
| **Calculations** | Every computed value, when it recalculates, rounding behavior |
| **Filters & Search** | Every filter option, search fields, clear filter |
| **Bulk Actions** | Select all, bulk edit, bulk delete, bulk status change |
| **Export & Reports** | Every export format (CSV, PDF, Excel), what columns appear |
| **Collaboration** | Comments, @mentions, email notifications, subscriptions |
| **Permissions** | Read-only blocks write actions, admin-only features, no-access hides tool |
| **Integrations** | Links to other tools, data flowing in from other tools |
| **Settings & Config** | Tool-level settings, project-level defaults |
| **Mobile** | Mobile-specific behaviors, offline access |
| **Edge Cases** | Empty state, max field length, invalid input, duplicate detection |

---

## Step 3: Write One Scenario Per Feature

For each feature identified in Step 2, write one scenario.

For each scenario:

```
test_number : "1.1", "1.2", "2.1", etc. (category.sequence)
category    : Navigation / Create / Edit / Delete / Status / etc.
subcategory : Specific feature (e.g. "Required field validation")
test_name   : Short imperative title ("Submitting without a required field shows an error")
context_note: One plain-English sentence. What does this test check and why does it matter?
              NO jargon. Imagine explaining to someone who has never used the app.
              Example: "Checks that the form won't save if the Description field is left blank,
              so that incomplete records can't be created by accident."
setup_steps : (optional) What must be true before the tester starts.
              Write as bullet points. Example:
              "You need to be on the Budget page. There must be at least one line item in the list."
steps       : Numbered plain-English steps. 2–6 steps per scenario.
              Rules:
              - Start with a verb: Click, Type, Select, Open, Press, Scroll
              - Use specific values: 'Type Test Item in the Description field'
              - Name buttons exactly as they appear in the UI
              - After save/submit: 'Wait for the page to stop loading'
              - For refresh tests: 'Press Ctrl+R (Cmd+R on Mac) to refresh the page'
              - No construction jargon: say 'the record' not 'the PCO'
start_url   : Relative path in app, e.g. '/67/change-events'
expected    : What the tester sees if the test passes. Be specific:
              - Name visible text or UI elements
              - Include numeric changes ('the total increases by $1,000')
              - State what should NOT appear ('No red error message is shown')
              - For persist tests: 'After refreshing, the value is still shown'
              Keep to 1–3 sentences.
priority    : HIGH (core CRUD, data accuracy, status changes)
              MEDIUM (filters, export, notifications, permissions)
              LOW (edge cases, cosmetic, mobile)
```

### Negative tests are mandatory

Every CREATE and EDIT section must include at least:
- One test for submitting with a missing required field
- One test for canceling/discarding changes

### Status tests are mandatory

For every status value that exists, write:
- A test that sets the record to that status
- A test for any transition rule (e.g. "can only approve when status is Pending")

---

---

## Step 3: Write Each Scenario

For each scenario, produce:

```
test_number : "1.1", "1.2", "2.1", etc. (category.sequence)
category    : Navigation / Create / Edit / Delete / Status / etc.
subcategory : More specific label (e.g. "Required field validation")
test_name   : Short imperative title ("Create a new change event")
context_note: One sentence, plain English, no jargon.
              What does this test check and why does it matter?
              Example: "Checks that users can create a new item and
              that it saves correctly to the database."
setup_steps : (optional) Prerequisites — what must be true before starting.
              Written as bullet points, not numbered.
              Example: "Make sure you are on the project page.
              You will need at least one existing record in the list."
steps       : Numbered, plain-English steps. 2–5 steps max per scenario.
              Use specific values: "enter 1000" not "enter a number".
              Use specific project data: project 67, "Vermillion Rise Warehouse".
              Each step = one atomic action.
start_url   : Relative path to open in the app, e.g. "/67/change-events"
expected    : What the tester should see if the test passes.
              Be specific — mention visible text, number changes, toasts.
priority    : HIGH (core CRUD, data accuracy) | MEDIUM (filters, export) | LOW (edge cases)
```

### Writing steps — rules

- Start each step with a verb: "Click", "Type", "Select", "Open", "Scroll"
- Avoid construction jargon: say "the record" not "the PCO"
- Provide exact values to enter: "Type **Test item** in the Description field"
- Say where to click: "Click the **Save** button (bottom right of the form)"
- After submit/save, always include: "Wait for the page to stop loading"
- For refresh tests: "Press **Ctrl+R** (or Cmd+R on Mac) to refresh the page"

### Writing expected results — rules

- Start with what is visible: "The new item appears in the list…"
- Include specific changes: "…and the total at the top increases by $1,000"
- Mention what should NOT appear: "No red error message is shown"
- For persists-after-refresh tests: "After refreshing, the same value is still shown"
- Keep it to 1–3 sentences

---

## Step 4: Seed into Supabase

**Supabase project ID:** `lgveqfnpkxvzbnnwuled`

### 4a — Upsert the suite

```sql
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('<tool-name>', '<Display Name>', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now()
RETURNING id;
```

### 4b — Insert all scenarios

```sql
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = '<tool-name>')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the <tool> page',
   'Checks that the page loads without errors and displays existing data.',
   NULL,
   E'1. Make sure you are logged in\n2. Click "<Tool>" in the left sidebar of project "Vermillion Rise Warehouse"',
   'The page loads fully. A list of items is visible (or an empty state message). No error messages appear.',
   'HIGH', 'scenario', '/67/<tool-slug>'),

  -- ... continue for every scenario
ON CONFLICT (suite_id, test_number) DO UPDATE SET
  test_name       = EXCLUDED.test_name,
  context_note    = EXCLUDED.context_note,
  setup_steps     = EXCLUDED.setup_steps,
  steps           = EXCLUDED.steps,
  expected_result = EXCLUDED.expected_result,
  priority        = EXCLUDED.priority,
  test_type       = EXCLUDED.test_type,
  start_url       = EXCLUDED.start_url,
  category        = EXCLUDED.category,
  subcategory     = EXCLUDED.subcategory,
  updated_at      = now();
```

### 4c — Update suite total_cases

```sql
UPDATE public.test_suites
   SET total_cases = (
     SELECT count(*) FROM public.test_cases
     WHERE suite_id = test_suites.id AND test_type = 'scenario'
   )
 WHERE tool_name = '<tool-name>';
```

### 4d — Verify

```sql
SELECT ts.tool_name, ts.total_cases,
       COUNT(tc.id) AS seeded,
       string_agg(tc.test_number, ', ' ORDER BY tc.test_number) AS numbers
FROM test_suites ts
JOIN test_cases tc ON tc.suite_id = ts.id AND tc.test_type = 'scenario'
WHERE ts.tool_name = '<tool-name>'
GROUP BY ts.tool_name, ts.total_cases;
```

---

## Step 5: Save the SQL as a migration file

Save the full INSERT SQL to:
```
supabase/migrations/20260407130000_seed_<tool-name>_test_scenarios.sql
```

(Use today's date in the filename.)

---

## Step 6: Report to User

After seeding, report:

1. **Scenario count** — how many scenarios were created
2. **Categories covered** — which workflow categories are included
3. **Test Runner URL** — `http://localhost:3000/testing` (tell them to select the tool)
4. **Any gaps** — workflows you couldn't write scenarios for due to missing data or unclear behavior
5. **Suggested next** — which other tools to write scenarios for

---

## Reference

| What | Where |
|------|-------|
| Test runner UI | `http://localhost:3000/testing` |
| Admin quick-mark UI | `http://localhost:3000/test-matrix` |
| Supabase project | `lgveqfnpkxvzbnnwuled` |
| Test project | Project ID 67 — "Vermillion Rise Warehouse" |
| Test user | `test1@mail.com` / `test12026!!!` |
| Scenarios table | `test_cases` where `test_type = 'scenario'` |
| Feature matrix table | `test_cases` where `test_type = 'feature'` |
| Migration files | `supabase/migrations/` |
| Procore manifests | `.claude/procore-manifests/<tool>/` |
| PRPs | `docs/PRPs/<tool>/` |

## Contrast with /procore-test-matrix

Both skills produce **exhaustive, 100% feature coverage** for a tool.
The difference is audience, writing style, and source.

| | `/procore-test-matrix` | `/test-scenario-writer` |
|---|---|---|
| **Coverage** | Every Procore feature | Every Alleato feature (same scope) |
| **Audience** | Developers, QA engineers | Non-technical testers, anyone |
| **Writing style** | Technical feature checklist | Plain English, step-by-step guided |
| **Source** | Procore documentation (RAG) | Procore docs + Alleato codebase |
| **Steps format** | Table row with brief description | Numbered steps with exact values |
| **Expected result** | One-line technical description | Plain English, specific what to look for |
| **UI** | Keyboard-shortcut quick-mark | Guided one-at-a-time with step checkboxes |
| **test_type** | `feature` | `scenario` |
| **Page** | `/test-matrix` | `/testing` |

**When to use which:**
- Run `/procore-test-matrix` first to get full Procore feature coverage quickly
- Run `/test-scenario-writer` to produce the same coverage in a format any team member can execute
- Both should exist for every tool — they're complementary, not alternatives
