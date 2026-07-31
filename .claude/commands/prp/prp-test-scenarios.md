---
description: "Generate frontend test scenarios + success-criteria.md from a PRP. Produces Given/When/Then test cases with DB validation SQL and field classification — ready for prp-validate to consume without a manual step. Run after prp-audit, before prp-execute."
argument-hint: "<feature-name>"
---

# PRP Test Scenarios — Frontend User Testing

## Feature: $ARGUMENTS

## Mission

Generate two files that together give complete acceptance criteria for the feature:

1. **`PRPs/$ARGUMENTS/TEST-SCENARIOS.md`** — Human-readable Given/When/Then scenarios
   organized by functional group, with implementation status (ready vs blocked).

2. **`verify-output/$ARGUMENTS/success-criteria.md`** — The machine-readable validation
   gate file that `prp-validate` requires before opening the browser. Includes DB
   validation SQL and field classification for every persistence scenario.

These are **not** Playwright scripts. They are structured acceptance criteria that
describe user behavior and expected outcomes.

**Input:** `PRPs/$ARGUMENTS/prp-$ARGUMENTS.md` (must exist)
**Input:** `PRPs/$ARGUMENTS/AUDIT.md` (if exists — to know what's implemented)
**Output 1:** `PRPs/$ARGUMENTS/TEST-SCENARIOS.md`
**Output 2:** `verify-output/$ARGUMENTS/success-criteria.md`

---

## Generation Process

### Step 1: Read the PRP

```bash
Read PRPs/$ARGUMENTS/prp-$ARGUMENTS.md
```

Extract and note explicitly:
- Every workflow step and status transition (with exact status values)
- Every form field, its type, required flag, and what DB column it writes to
- Every list view column — mark which are **input** vs **derived** (server-calculated)
- Every toolbar and row action
- Every business rule, financial calculation, or non-obvious invariant
- Every integration point with other tools
- The primary DB table and relevant columns (from the PRP's schema section)

### Step 2: Read the Audit (if available)

```bash
Read PRPs/$ARGUMENTS/AUDIT.md 2>/dev/null
```

Note which items are ✅ implemented vs 🔴 missing. Only generate "Ready to test"
status for implemented items.

### Step 3: Classify Every Field

For every field the feature writes to the database, classify it:

| Classification | Meaning | How to test |
|---------------|---------|-------------|
| `input` | User types/selects a value → it must persist as-is | Submit value X, query DB, verify column = X |
| `derived` | Server calculates from other fields | Verify the formula inputs are correct, NOT the output value |
| `server-generated` | Set by server on create/transition (id, number, timestamps, status) | Verify it is non-null and correct format |
| `read-only` | Displayed but never written by this form | No write test needed |

**The derived field rule:** Never test a derived field by typing a value and
checking it matches — that tests nothing. Instead verify the formula inputs.

### Step 4: Extract Business-Critical Invariants

Before writing scenarios, explicitly list invariants that are non-obvious or
were previously broken. These get their own scenarios and their own entries in
success-criteria.md.

Examples of invariants to look for:
- Fields that could be silently dropped during save (enum/select values, optional FKs)
- Status transitions that have preconditions (can only void after approve)
- UI elements that must be disabled under certain conditions (button disabled until input)
- Calculations that must update immediately vs after save
- Fields that must NOT be editable after a certain status
- Required-field validation that must show inline errors (not just a toast)

Write these down explicitly before generating scenarios — they become the
highest-priority test cases.

### Step 5: Generate TEST-SCENARIOS.md

Organize scenarios into groups. Write each scenario in this format:

```
### Scenario: {descriptive name}
**Status:** Ready to test | Blocked (requires: {missing item})
**Priority:** Critical | High | Medium | Low

**Given** {initial state / preconditions}
**When** {user action — be specific, name the exact button/field}
**Then** {expected result — be specific, name the observable outcome}

**Field classification:**
- {field}: input | derived | server-generated | read-only
(list only fields relevant to this scenario)

**DB validation SQL:**
```sql
-- Run after this scenario to verify persistence
SELECT {columns} FROM {table} WHERE {condition} ORDER BY created_at DESC LIMIT 1;
```

**Pass criteria:** {single sentence: what separates pass from fail}

**Edge cases:**
- {edge case}: {expected behavior}
```

Omit "Field classification" and "DB validation SQL" sections for read-only or
navigation scenarios where nothing is written to the DB.

---

## Scenario Groups to Cover

Generate at least one scenario per applicable group. Add more for complex workflows.

### Group 1: Navigation & Access
- Page loads with correct title, layout, and columns
- Correct empty state when no records exist
- Correct tabs visible

**Priority:** Medium — these are smoke tests, not data correctness.

### Group 2: Create — Happy Path
For the primary create flow:
- Fill all required fields → submit → record appears in list
- Every input field: verify it persists in DB with exact value submitted
- Every server-generated field: verify it is set (non-null, correct format)
- Every derived field: verify the formula inputs, not the output

**Priority:** Critical — silent data drops are invisible bugs.

### Group 3: Create — Validation
- Submit with missing required fields → inline field-level errors shown (not just toast)
- Submit with invalid enum values → rejected
- Submit with boundary values (zero amounts, empty strings)

**Priority:** High

### Group 4: Edit — Pre-fill Verification
- Open existing record for edit → ALL dropdowns/selects show saved value (not "Select...")
- Any blank dropdown on edit = FK mismatch bug

**Priority:** Critical — FK mismatches are invisible on create but break every edit.

### Group 5: Edit — Save
- Change a field → save → verify DB column updated
- Derived fields recalculate after save
- Status-locked fields cannot be edited after certain statuses

**Priority:** High

### Group 6: Status Workflows
For each status transition in the PRP:
- Transition fires when allowed
- Transition blocked when not allowed (button hidden or disabled)
- Status badge shows correct new status after transition
- Downstream effects: budget impact, rollup recalculation, notifications
- Exact status string values (draft/pending/approved/void — never Draft/Pending)

**Priority:** Critical for status machines.

### Group 7: Business-Critical Invariants
One scenario per invariant extracted in Step 4.
These often don't fit neatly into other groups but are the most likely failure points.

**Priority:** Critical

### Group 8: List View Features
- Column data matches DB (not truncated, correct format)
- Sort, filter, search work correctly
- Each tab scopes records correctly
- Bulk select + bulk action (if present)
- Export generates correct output (if present)

**Priority:** Medium

### Group 9: Row Actions
For each row action:
- Action visible on correct rows
- Action hidden/disabled when not applicable
- Action executes and produces correct result

**Priority:** High

### Group 10: Integrations
For each integration point:
- Data flows correctly to/from related tool
- Financial totals roll up correctly
- Related records appear in correct places

**Priority:** High for financial integrations

### Group 11: Error States
- Network error during load → appropriate error message shown
- Server error during save → error shown, data not lost, no silent failure

**Priority:** Medium

---

## Step 6: Generate success-criteria.md

Write `verify-output/$ARGUMENTS/success-criteria.md`.

This file is the hard gate that `prp-validate` checks for before opening the browser.
It must contain an entry for every scenario marked "Ready to test" that involves
user interaction or data persistence.

```bash
mkdir -p verify-output/$ARGUMENTS
```

Format for each entry:

```markdown
### Scenario: {name from TEST-SCENARIOS.md}

**Action:** {exact user action — specific enough to reproduce}
**Expected outcome:** {specific observable result — not "it works", not "success toast"}
**DB validation SQL:**
```sql
SELECT {exact columns to verify} FROM {table}
WHERE {condition, e.g. project_id = 67}
ORDER BY created_at DESC LIMIT 1;
```
**Field classification:**
- {field_name}: input → must equal "{submitted value}"
- {field_name}: server-generated → must be non-null
- {field_name}: derived → computed from {formula}, verify inputs not output
**Pass criteria:** {one sentence stating the specific measurable pass condition}
```

**Rules for success-criteria.md:**
- Every input field must have an explicit expected value
- Every server-generated field must have a non-null check
- Derived fields must state their formula and what inputs to check
- Pass criteria must be falsifiable (not "it works" or "looks correct")
- DB validation SQL must be runnable with real project/record IDs (use project_id = 67)
- Omit scenarios that are pure navigation (no DB writes, no assertions)

---

## Output Files

### File 1: PRPs/$ARGUMENTS/TEST-SCENARIOS.md

```markdown
# $ARGUMENTS — Frontend Test Scenarios

**Generated from:** PRPs/$ARGUMENTS/prp-$ARGUMENTS.md
**Date:** {today}
**Total scenarios:** {N}
**Ready to test:** {X} | **Blocked:** {Y}

---

## Business-Critical Invariants

{explicit list of non-obvious rules extracted in Step 4 — these are the
highest-risk failure points and each has its own scenario below}

---

## Quick Reference

| Group | Scenarios | Priority | Status |
|-------|-----------|----------|--------|
| Navigation & Access | N | Medium | ✅/🔴 |
| Create — Happy Path | N | Critical | ✅/🔴 |
| Create — Validation | N | High | ✅/🔴 |
| Edit — Pre-fill | N | Critical | ✅/🔴 |
| Edit — Save | N | High | ✅/🔴 |
| Status Workflows | N | Critical | ✅/🔴 |
| Business-Critical Invariants | N | Critical | ✅/🔴 |
| List View Features | N | Medium | ✅/🔴 |
| Row Actions | N | High | ✅/🔴 |
| Integrations | N | High | ✅/🔴 |
| Error States | N | Medium | ✅/🔴 |

---

## Scenarios

{all scenarios, Critical priority first within each group}
```

### File 2: verify-output/$ARGUMENTS/success-criteria.md

```markdown
# $ARGUMENTS — Success Criteria

**Date:** {today}
**Project ID for testing:** 67

---

{one entry per Ready-to-test scenario that has DB writes or observable UI assertions}
```

---

## Quality Gates

Before marking complete:

- [ ] Every PRP workflow has at least one scenario
- [ ] Every form field classified (input/derived/server-generated/read-only)
- [ ] Every input field has DB validation SQL in success-criteria.md
- [ ] Every derived field is explicitly marked — no output-value tests
- [ ] Every status transition has a scenario with exact status string values
- [ ] Business-critical invariants section populated (minimum 1 entry)
- [ ] Edit pre-fill scenario explicitly checks ALL dropdown fields
- [ ] Happy path AND unhappy path covered for create/edit
- [ ] Scenarios marked with implementation status and priority
- [ ] `TEST-SCENARIOS.md` written to `PRPs/$ARGUMENTS/TEST-SCENARIOS.md`
- [ ] `success-criteria.md` written to `verify-output/$ARGUMENTS/success-criteria.md`
- [ ] Total scenario count reported to user
- [ ] Confirm: prp-validate can now run immediately without manual success-criteria step
