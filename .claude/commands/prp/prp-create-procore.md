---
description: "PROCORE PARITY FEATURES ONLY. Research Procore functionality and create a PRP defining what to replicate. Sources: manifest + RAG (authoritative), planning artifacts (supplemental). For internal/custom features not sourced from Procore, use /prp:prp-create-internal instead."
argument-hint: "<procore-feature-name>"
---

# Create Procore Feature PRP

## Feature: $ARGUMENTS

## Mission

Create a comprehensive PRP that defines **exactly what to build** based on authoritative
Procore research. This document answers: "What does Procore do and what do we need to replicate?"

**This phase does NOT:**
- Review the current codebase
- Query the database schema
- Analyze what's already built

That happens in `prp-audit`. Keep the phases clean.

**Authority stack:**
1. **Procore Manifest** (`.claude/procore-manifests/{feature}/`) — authoritative for UI structure
2. **Procore Docs RAG** (`procore-docs-rag` skill) — authoritative for business rules and workflows
3. **Planning Artifacts** (`_bmad-output/planning-artifacts/{feature}/`) — supplemental context only

When manifest and RAG conflict with planning artifacts, **manifest + RAG win**.

---

## Research Process

> Spawn subagents in parallel wherever possible. Optimize for completeness, not speed.

### Step 1: Load Planning Artifacts (Supplemental Context)

Read these as background — they inform your queries but do not override manifest or RAG.

```bash
# Check what planning artifacts exist
ls _bmad-output/planning-artifacts/$ARGUMENTS/
ls _bmad-output/planning-artifacts/$ARGUMENTS/crawl/ 2>/dev/null
ls _bmad-output/planning-artifacts/$ARGUMENTS/implementation/ 2>/dev/null
```

Key files to skim (do not treat as authoritative):
- `implementation/ui-{feature}.md` — UI notes from earlier research
- `implementation/schema-{feature}.md` — data model notes
- `implementation/forms-{feature}.md` — form field notes
- `crawl/` — any earlier crawl data

Note gaps and questions to answer via manifest + RAG.

---

### Step 2: Read Procore Manifest (PRIMARY — UI Structure)

The manifest contains live DOM captures from the actual Procore UI. This is the
authoritative source for columns, fields, tabs, dropdown options, and required flags.

```bash
# Read the structured manifest
Read .claude/procore-manifests/$ARGUMENTS/manifest.json
```

#### Completeness check — verify these fields are non-empty arrays

| Field | What it tells you |
|-------|------------------|
| `states.list.columns` | List view column headers |
| `states.list.rowActions` | Per-row actions (Edit, Delete, View, etc.) |
| `states.list.toolbarActions` | Create button options, Export, Import, Print |
| `states.list.tabs` | View tabs on the list page |
| `states.list.filters` | Filter options |
| `states.create-form.formSections` | Create form fields and sections |

**If any of these are empty arrays `[]` → the manifest is incomplete. Recrawl before continuing:**

```bash
cd scripts/playwright-crawl
node procore-deep-crawl.js $ARGUMENTS
```

Then re-read the manifest and confirm fields are populated.

#### What to extract from the manifest

- Every column in the list view (exact label, what data it shows)
- Every field in the create/edit form (label, type, required, options/placeholder)
- Every tab on the detail view (name, what content it contains)
- Every toolbar action (Create options, Export, Import, Bulk actions)
- Every row-level action (Edit, Delete, Duplicate, Status changes, etc.)
- Header/summary fields on the detail view

If field detail is sparse in `manifest.json`, read the raw DOM:

```bash
Read .claude/procore-manifests/$ARGUMENTS/dom/list.html
Read .claude/procore-manifests/$ARGUMENTS/dom/create-form.html
```

---

### Step 3: Run Procore Docs RAG (PRIMARY — Business Rules & Workflows)

Use the `procore-docs-rag` skill to query the 560-article Procore knowledge base.
This is the authoritative source for: status workflows, business rules, financial
calculations, field validation logic, and how this tool relates to other tools.

Run from project root:

```bash
node scripts/procore-docs-query.js "<query>"
node scripts/procore-docs-query.js "<query>" 12   # topK=12 for broad topics
```

#### Mandatory queries for every feature

Always run these four — they catch things that topic-specific queries miss:

```bash
node scripts/procore-docs-query.js "$ARGUMENTS toolbar actions create button options"
node scripts/procore-docs-query.js "$ARGUMENTS export pdf csv print"
node scripts/procore-docs-query.js "$ARGUMENTS list view tabs navigation"
node scripts/procore-docs-query.js "$ARGUMENTS row actions menu options"
```

#### Score thresholds

| Score | Action |
|-------|--------|
| ≥ 80% | Authoritative. Use directly. |
| 60–79% | Good. Use with article title as context. |
| 40–59% | Partial. Supplement with Tier 3 (WebFetch). |
| < 40% | Rephrase, then escalate to WebFetch. |

#### Feature-specific queries to run

Spawn subagents to run these in parallel. For `$ARGUMENTS`, run at minimum:

```bash
# Statuses and workflows
node scripts/procore-docs-query.js "what statuses does a $ARGUMENTS go through"
node scripts/procore-docs-query.js "$ARGUMENTS approval workflow steps"
node scripts/procore-docs-query.js "$ARGUMENTS status transitions allowed"

# Fields and validation
node scripts/procore-docs-query.js "what fields are required when creating a $ARGUMENTS"
node scripts/procore-docs-query.js "$ARGUMENTS field definitions and descriptions"

# Relationships to other tools
node scripts/procore-docs-query.js "how does $ARGUMENTS relate to budget"
node scripts/procore-docs-query.js "how does $ARGUMENTS relate to change orders"
node scripts/procore-docs-query.js "how does $ARGUMENTS relate to prime contracts"

# Financial/calculation rules (if applicable)
node scripts/procore-docs-query.js "$ARGUMENTS financial calculations markup"
node scripts/procore-docs-query.js "$ARGUMENTS budget impact when approved"

# Permissions and roles
node scripts/procore-docs-query.js "$ARGUMENTS permissions who can create edit approve"
```

Add more queries based on what gaps you found in the planning artifacts (Step 1).

#### What to extract from RAG results

- Exact status names and allowed transitions
- Business rules (what triggers what)
- Field validation rules (required conditions, format rules)
- Financial calculation logic
- Integration points with other Procore tools
- Procore's exact terminology (use it verbatim in the PRP)

---

### Step 4: WebFetch — Fill Remaining Gaps (Tier 3)

If RAG results are partial (< 60%) for any critical topic, fetch the full article:

```bash
WebFetch <URL from RAG result>
```

Or browse the Procore support site directly:

```bash
WebFetch https://v2.support.procore.com/
```

Use this for: complex workflows that got cut off in RAG chunks, specific calculation
formulas, or edge cases not covered by manifest or RAG.

---

### Step 5: Synthesize Research

Before writing, consolidate your findings:

1. **Reconcile conflicts** — if manifest says one thing and RAG says another, RAG wins for
   business rules; manifest wins for UI structure. Note any conflicts.
2. **Identify gaps** — topics where neither manifest nor RAG gave strong answers.
   Mark these explicitly in the PRP as "unclear / needs verification."
3. **Use Procore's exact terminology** — copy field names, status names, and tab names
   verbatim from the manifest and RAG results.

---

## PRP Generation

### Template

Use `.claude/templates/prp_template_procore.md` as the base structure.

### Required Sections

#### 1. Feature Overview
- What this tool does in Procore (1-2 paragraphs using RAG findings)
- How it fits into the broader Procore workflow
- Key relationships to other tools (budget, change orders, prime contracts, etc.)

#### 2. Procore Data Model
- All entities and their fields (from manifest + RAG)
- Field names (exact labels from manifest), types, required/optional
- Status values and transitions
- Do NOT map to our DB schema — that's prp-audit's job

#### 3. List View Specification
- Columns (exact labels, data shown, sortable?)
- Tabs (names, what filter/scope each applies)
- Toolbar actions (Create options, Export, Import, Print, Bulk)
- Row actions (Edit, Delete, Duplicate, status changes, etc.)
- Filters available

#### 4. Create / Edit Form Specification
- All form sections (exact section names from manifest)
- Every field: label, type, required, options/placeholder
- Conditional fields (shown only when X is true)
- Validation rules (from RAG)

#### 5. Detail View Specification
- Header/summary fields
- Tabs and their content
- Actions available on detail view

#### 6. Workflows & Business Rules
- Status lifecycle (diagram or list)
- Allowed status transitions
- What triggers budget impact / financial changes
- Integration points with other tools
- Permission rules (who can do what)

#### 7. User Flows
- Step-by-step: Create a {feature}
- Step-by-step: Edit / update
- Step-by-step: Status change workflows
- Any approval flows

#### 8. Procore Research Sources
- Which RAG queries returned strong results (≥ 80%)
- Which manifest sections were used
- Any WebFetch URLs consulted
- Any gaps / uncertainties explicitly noted

### Output Files

```
PRPs/{feature-name}/
├── prp-{feature-name}.md      # Main PRP (static reference — what Procore does)
└── TASKS.md                    # Placeholder (populated by prp-audit)
```

---

## Quality Gates

Before marking complete:

- [ ] Manifest read and all key sections verified non-empty
- [ ] Mandatory 4 RAG queries run + feature-specific queries
- [ ] Every list column documented with exact label
- [ ] Every form field documented: label, type, required, options
- [ ] Every detail tab documented with content description
- [ ] All status values and transitions documented
- [ ] Financial/calculation rules documented (if applicable)
- [ ] Relationships to other tools documented
- [ ] Gaps and uncertainties explicitly noted in PRP
- [ ] Procore's exact terminology used throughout (not paraphrased)
- [ ] `prp-{feature}.md` created
- [ ] Ready for `/prp:prp-audit`

## Confidence Score

Rate 1–10: how completely does this PRP capture Procore's actual functionality?
**Minimum 8/10 required.** If lower, identify what's missing and run more queries.
