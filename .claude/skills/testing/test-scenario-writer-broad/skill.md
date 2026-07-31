---
name: test-scenario-writer-broad
description: >
  DEPRECATED — use /test-scenario-audit instead.
argument-hint: <tool-name>
---

> **DEPRECATED — use `/test-scenario-audit` instead.**
>
> This skill is superseded by `/test-scenario-audit`, which produces BOTH a
> smoke suite (5–15 critical-path cases) AND a feature suite (20–40
> consolidated CRUD + workflow cases) per tool, seeded into Supabase against the
> new `test_suites.suite_type` schema and emitted as markdown under
> `docs/testing/scenarios/`.
>
> The new skill replaces the broad/exhaustive split with a smoke/feature split
> that maps cleanly to the updated `test_suites` unique constraint
> `(tool_name, suite_type)`. Do not invoke this skill.
>
> Run `/test-scenario-audit <tool>` instead.
> Definition: `.claude/skills/testing/test-scenario-audit/SKILL.md`.

---

# Test Scenario Writer

Generate **broad, easy-to-run, plain-English scenarios** for a given Alleato tool.
This skill is for human testers (including non-technical assistants) to quickly
surface major breakage, UX confusion, and workflow blockers.

This is intentionally **not exhaustive**. Focus on realistic user journeys and
high-signal checks.

**Invocation:** `/test-scenario-writer <tool-name>`

**Example:** `/test-scenario-writer change-events`

**Naming convention:** `<tool-name>` and `<tool-slug>` are identical throughout this skill — always use the URL kebab-case slug (e.g. `change-events`, `direct-costs`, `prime-contracts`). Use this exact string in SQL, file paths, and `start_url`.

**Output:**
- Scenarios seeded into Supabase `test_cases` table (`test_type='scenario'`)
- Immediately available at `http://localhost:3000/testing`

---

## Scope and Target

Default target per tool: **12–24 scenarios**.

Coverage goal:
- Validate primary workflows end to end
- Catch major failures quickly (save fails, broken actions, invalid state transitions)
- Keep scenarios short and clear for non-experts

Do not attempt per-field or 100% feature parity in this skill.

Depth tagging rule:
- `scenario_depth='broad'` for concise human workflows (default for this skill)
- `scenario_depth='detailed'` only when explicitly asked for deep coverage

---

## Scenario Design Rules

Each scenario should:
- Cover one workflow slice (not one tiny field)
- Use 3–5 steps (hard max: 6)
- Use exact values and exact button labels
- Include expected outcome in plain language
- Be executable without Procore knowledge

Avoid:
- Very long checklists
- Domain jargon
- Deep edge-case combinatorics
- Duplicate scenarios with tiny variations

---

## Step 1: Gather Workflow Context

Use lightweight discovery from docs + code to identify the main user flows.

Primary sources — **check all four before building scenarios**:
1. `frontend/src/app/(main)/[projectId]/<tool-slug>/`
2. `frontend/src/app/api/projects/[projectId]/<tool-slug>/`
3. `.claude/procore-manifests/<tool-slug>/manifest.json` (if present — skip if missing)
4. `docs/PRPs/<tool-slug>/` (if present — skip if missing)

Each source may reveal workflows the others miss. Do not stop after the first source has enough to proceed.

Optional supporting query from Supabase docs:
```sql
SELECT sa.title, sa.url, sac.heading, sac.chunk_text
FROM support_articles sa
JOIN support_article_chunks sac ON sac.article_id = sa.id
WHERE lower(sa.title) LIKE lower('%<tool-name>%')
ORDER BY sa.title, sac.chunk_index
LIMIT 40;
```

---

## Step 2: Build a Broad Coverage Set

Create scenarios across these categories (as applicable):

1. Navigation & Page Load
2. Create Record (happy path)
3. Edit Record (happy path)
4. Delete/Archive behavior
5. Required Validation (one strong negative test)
6. Status/Workflow transitions
7. Search/Filter/List usability
8. Linked data or integration behavior
9. Permissions/read-only behavior
10. Empty/error handling (one practical failure case)

Prioritize by risk:
- `HIGH`: create, edit, delete, status, data persistence
- `MEDIUM`: filters, integrations, permissions
- `LOW`: polish and secondary behaviors

---

## Step 3: Write Scenario Records

For each scenario, produce:

```text
test_number    : "1.1", "1.2", "2.1" (category.sequence)
category       : Navigation / Create / Edit / Delete / Status / Filter / Permission / Error
subcategory    : Short workflow label
test_name      : Short action-oriented title
context_note   : One sentence, plain English, why this matters
setup_steps    : Optional prerequisites (bullet list)
steps          : Numbered steps, 3-5 preferred, 6 max
start_url      : Relative path, e.g. "/67/change-events"
expected_result: 1-3 sentences, specific visible outcomes
priority       : HIGH | MEDIUM | LOW
scenario_depth : broad | detailed
```

Step-writing standard:
- Start with verbs: Click, Type, Select, Open, Refresh, Confirm
- Use exact test values (for example: `Test Item 1001`, `2500`)
- Include explicit save/submit action
- Include persistence check where relevant (refresh and confirm retained data)

Expected-result standard:
- State what should be visible
- State what should not happen (no crash, no red error, no silent failure)
- Keep language simple enough for first-time testers

---

## Step 4: Seed into Supabase

**Supabase project ID:** `lgveqfnpkxvzbnnwuled`

### 4a — Upsert suite

```sql
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('<tool-name>', '<Display Name>', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now()
RETURNING id;
```

**Verify the row exists before continuing.** If `RETURNING id` returns no result, stop and diagnose — do not proceed to 4b.

### 4b — Upsert test scenarios

```sql
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = '<tool-name>')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url, scenario_depth)
VALUES
  ((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
   'Open the tool and confirm baseline state',
   'Checks that the page is reachable and renders usable content without errors.',
   NULL,
   E'1. Open the project\n2. Open the <Tool> page\n3. Wait for loading to finish',
   'The page loads with either records or a clear empty state. No crash or blocking error appears.',
   'HIGH', 'scenario', '/67/<tool-slug>', 'broad')
ON CONFLICT (suite_id, test_number) DO UPDATE SET
  test_name       = EXCLUDED.test_name,
  context_note    = EXCLUDED.context_note,
  setup_steps     = EXCLUDED.setup_steps,
  steps           = EXCLUDED.steps,
  expected_result = EXCLUDED.expected_result,
  priority        = EXCLUDED.priority,
  test_type       = EXCLUDED.test_type,
  start_url       = EXCLUDED.start_url,
  scenario_depth  = EXCLUDED.scenario_depth,
  category        = EXCLUDED.category,
  subcategory     = EXCLUDED.subcategory,
  updated_at      = now();
```

### 4c — Update totals

```sql
UPDATE public.test_suites
SET total_cases = (
  SELECT count(*)
  FROM public.test_cases
  WHERE suite_id = test_suites.id
    AND test_type = 'scenario'
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

## Step 5: Save SQL Migration

Save to:

```text
supabase/migrations/<YYYYMMDDHHMMSS>_seed_<tool-name>_test_scenarios.sql
```

Use current timestamp in filename. The file must contain **all SQL from Steps 4a through 4c** in order — suite upsert, then all case upserts, then the total count update — so the migration is fully self-contained and re-runnable.

---

## Step 6: Report to User

After seeding, report:
1. Total scenarios created (target range: 12–24)
2. Categories covered
3. URL: `http://localhost:3000/testing`
4. Any blocked areas due to missing data/access
5. Suggested next tool to scenario-seed

---

## Reference

| What | Where |
|---|---|
| Test runner UI | `http://localhost:3000/testing` |
| Supabase project | `lgveqfnpkxvzbnnwuled` |
| Test project | Project ID 67 — "Vermillion Rise Warehouse" |
| Test user | `test1@mail.com` / `test12026!!!` |
| Scenarios table | `test_cases` where `test_type = 'scenario'` |
| Migration files | `supabase/migrations/` |
| Procore manifests | `.claude/procore-manifests/<tool>/` |
| PRPs | `docs/PRPs/<tool>/` |

---

## Positioning

This skill is for **human broad-pass testing**.

Use agent-run smoke/regression skills separately for rapid technical breakage checks.
Use deep/exhaustive workflows later when approaching release hardening.
