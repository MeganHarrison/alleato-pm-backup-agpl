---
description: "Audit current implementation against the PRP. Compares what's been built vs what Procore requires. Produces AUDIT.md gap list and TASKS.md that drive prp-execute."
argument-hint: "<feature-name>"
---

# PRP Audit — Implementation Gap Analysis

## Feature: $ARGUMENTS

## Mission

Compare the **Procore feature spec** (from `prp-create`) against the **current implementation**
to produce an honest gap list: what's done, what's partial, and what's missing.

This is the phase where schema review and codebase analysis happen — NOT in `prp-create`.

**Input:** `PRPs/$ARGUMENTS/prp-$ARGUMENTS.md` (must exist — run `prp-create` first)
**Output:** `PRPs/$ARGUMENTS/AUDIT.md` + `PRPs/$ARGUMENTS/TASKS.md`

---

## Audit Process

> Spawn subagents in parallel for Steps 2–4.

### Step 1: Load the PRP

Read the feature spec as your source of truth:

```bash
Read PRPs/$ARGUMENTS/prp-$ARGUMENTS.md
```

Extract and note every requirement:
- Every list column
- Every form field (label, type, required flag)
- Every detail tab and its content
- Every workflow status and transition
- Every toolbar and row action
- All business rules and financial calculations
- All integrations with other tools

This becomes your audit checklist.

---

### Step 2: Review Database Schema

Query Supabase for tables relevant to this feature:

```sql
-- Column details for relevant tables
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    -- Add feature-relevant table names here
  )
ORDER BY table_name, ordinal_position;

-- Foreign key relationships
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (/* same tables */);
```

**Schema gap analysis:**
- [ ] Does a table exist for this feature?
- [ ] Are all required fields present as columns?
- [ ] Are status/enum columns present with correct values?
- [ ] Are FK relationships correct (INTEGER vs UUID)?
- [ ] Are any columns missing that the PRP requires?

**CRITICAL FK type check:**
- `projects.id` is INTEGER → `project_id` FKs must be INTEGER
- `users.id` is UUID → `user_id` FKs must be UUID
- `people.id` is UUID → `person_id` FKs must be UUID

---

### Step 3: Codebase Analysis

Spawn subagents to locate all existing implementation files:

```bash
# Pages
find frontend/src/app -path "*$ARGUMENTS*" -name "*.tsx" 2>/dev/null
find frontend/src/app -path "*$ARGUMENTS*" -name "*.ts" 2>/dev/null

# API routes
find frontend/src/app/api -path "*$ARGUMENTS*" -name "*.ts" 2>/dev/null

# Components
find frontend/src/components -path "*$ARGUMENTS*" -name "*.tsx" 2>/dev/null

# Hooks
find frontend/src/hooks -name "*$ARGUMENTS*" 2>/dev/null
```

For each file found, read it and note:
- What functionality it implements
- What fields/columns it includes
- What API endpoints it calls
- What's visibly incomplete or missing

---

### Step 4: Review Incident Log & Patterns

Check for known issues relevant to this feature domain:

```bash
Read docs/patterns/INCIDENT-LOG.md
```

Note any 🔴 CRITICAL or 🟡 WARNING incidents related to this feature — these become
guardrails in the TASKS.md implementation notes.

Also check relevant pattern files:

| If you found... | Read... |
|----------------|---------|
| Schema issues | `docs/patterns/database-issues.md` |
| API route gaps | `docs/patterns/api-routing-errors.md` |
| Type errors | `docs/patterns/typescript-errors.md` |
| UI gaps | `docs/patterns/ui-errors.md` |

---

### Step 5: Produce the Audit Report

Write `PRPs/$ARGUMENTS/AUDIT.md`:

```markdown
# $ARGUMENTS Audit Report

**Date:** {today}
**PRP:** PRPs/$ARGUMENTS/prp-$ARGUMENTS.md

## Summary

- ✅ Fully implemented: X items
- 🟡 Partially implemented: Y items
- 🔴 Not implemented: Z items
- ⚠️ Schema gaps: N items

## Database Schema

### Tables Found
| Table | Status | Notes |
|-------|--------|-------|

### Schema Gaps
| Missing | Type | Required By |
|---------|------|-------------|

## List View

| Requirement | Status | Notes |
|-------------|--------|-------|
| Column: {name} | ✅/🟡/🔴 | |
| Tab: {name} | ✅/🟡/🔴 | |
| Toolbar: {action} | ✅/🟡/🔴 | |
| Row action: {action} | ✅/🟡/🔴 | |

## Create / Edit Form

| Requirement | Status | Notes |
|-------------|--------|-------|
| Field: {label} ({type}, {required?}) | ✅/🟡/🔴 | |

## Detail View

| Requirement | Status | Notes |
|-------------|--------|-------|
| Tab: {name} | ✅/🟡/🔴 | |
| Header field: {name} | ✅/🟡/🔴 | |

## Workflows & Business Rules

| Requirement | Status | Notes |
|-------------|--------|-------|
| Status: {name} | ✅/🟡/🔴 | |
| Transition: {from} → {to} | ✅/🟡/🔴 | |
| Rule: {description} | ✅/🟡/🔴 | |

## Integrations

| Requirement | Status | Notes |
|-------------|--------|-------|

## Known Guardrails (from Incident Log)

List any patterns from incident log that apply to implementation of missing items.

## Implementation Priority

Ordered list of what to build next, highest impact first.
```

---

### Step 6: Generate TASKS.md

Write `PRPs/$ARGUMENTS/TASKS.md` based on the audit gaps — ordered by dependency:

```markdown
# $ARGUMENTS Implementation Tasks

**Source:** AUDIT.md — {date}
**Status:** {X done / Y total}

## Progress
- [ ] Schema changes
- [ ] API layer
- [ ] UI: List view
- [ ] UI: Create/Edit form
- [ ] UI: Detail view
- [ ] Workflows
- [ ] Integrations
- [ ] Testing

---

## Phase 1: Schema

- [ ] {migration description}
- [ ] {add column to table}

## Phase 2: API Layer

- [ ] {endpoint}: {what it does}

## Phase 3: UI — List View

- [ ] Add column: {name}
- [ ] Add toolbar action: {name}
- [ ] Add tab: {name}

## Phase 4: UI — Forms

- [ ] Add field: {label} ({type}, {required?})

## Phase 5: UI — Detail View

- [ ] Add tab: {name} with {content description}

## Phase 6: Workflows

- [ ] Implement status transition: {from} → {to}
- [ ] Implement business rule: {description}

## Phase 7: Integrations

- [ ] {integration description}

## Phase 8: Testing

- [ ] See PRPs/$ARGUMENTS/TEST-SCENARIOS.md

---

## Session Log

| Date | Work Done | Remaining |
|------|-----------|-----------|
```

---

## Quality Gates

Before marking audit complete:

- [ ] Every PRP requirement has a status (✅/🟡/🔴)
- [ ] Schema gaps documented with specific missing columns/tables
- [ ] All existing files found and evaluated
- [ ] AUDIT.md written to `PRPs/$ARGUMENTS/AUDIT.md`
- [ ] TASKS.md generated and ordered by dependency
- [ ] Incident log reviewed for applicable guardrails
- [ ] Ready for `/prp:prp-test-scenarios` and `/prp:prp-execute`
