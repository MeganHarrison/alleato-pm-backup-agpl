# Procore Module Reverse-Engineering System

## Purpose

This repository implements a **structured reverse-engineering system** for analyzing, understanding, and rebuilding Procore modules (Scheduling, Commitments, Budget, etc.) with **high fidelity and intentional design**.

This system is **not**:

* a simple web scraper
* a UI clone
* a pixel-parity exercise

It **is** a:

> **Product Decompiler → System Blueprint Generator**

The goal is to convert observable Procore UI behavior into a **canonical, queryable system specification** that can be used to:

* Rebuild functionality accurately
* Design cleaner internal data models
* Drive AI agents safely
* Measure feature parity objectively
* Avoid guess-driven implementation

---

## Core Philosophy

**We do not rebuild pages.
We rebuild capabilities, actions, data models, and state transitions.**

Pages are treated as *implementation details*, not system boundaries.

This system prioritizes, in order:

1. What exists
2. What actions can be taken
3. What data is affected
4. What rules govern state changes

Only **after** these are understood do we consider:

* Permissions
* Roles
* UI design
* UX polish
* Optimization

---

## High-Level Architecture

```text
Procore UI
    ↓
Playwright Crawler (Observation Only)
    ↓
Structured Metadata (JSON)
    ↓
ETL → Supabase (System Intelligence Model)
    ↓
Spec Generation (Commands, Schema, Mutations, Forms)
    ↓
Human + AI Analysis
    ↓
Rebuild with Confidence
```
---

## Key Conceptual Distinctions (CRITICAL)

### System Actions vs Domain Commands

**System Actions**

* Raw, observed UI behaviors
* Examples: “Edit”, “Bulk Edit”, “Set Deadline”
* Captured directly from menus, modals, and interactions
* Stored in `app_system_actions`
* Descriptive, noisy, redundant

System Actions answer:

> *“What did the user click?”*

---

**Domain Commands**

* Canonical, normalized operations
* Examples: `edit_task`, `set_deadline`, `bulk_edit_tasks`
* Derived by grouping and interpreting system actions
* Stored in `app_commands`
* Stable, intentional, implementation-agnostic

Domain Commands answer:

> *“What capability did the system execute?”*

**Domain Commands are the authoritative functional API of the product.**

---

### Observation vs Interpretation

* Crawlers **observe**
* ETL **structures**
* Specs **interpret**
* Rebuild **implements**

Skipping or blending these steps introduces errors.

---

## Repository Structure

```text
/scripts/playwright-crawl/
├── scripts/
│   ├── crawl-procore-module.js         # Generic Playwright crawler
│   ├── init-procore-module.js          # Initialize a new module
│   ├── generate-crawl-summary.js       # Post-crawl aggregation
│   └── generate-procore-module-spec.js # Generate specs from Supabase
│
├── module-configs/                      # Per-tool crawler configurations
│   ├── scheduling.json
│   └── submittals.json
│
├── etl_ingest_procore_crawl.js          # Ingest crawler data into Supabase
│
├── procore-crawls/                      # Crawl output (one dir per module)
│   ├── scheduling/
│   │   ├── screenshots/               # One screenshot per page
│   │   ├── dom/                       # DOM snapshots + metadata per page
│   │   │   └── <page-name>/
│   │   │       ├── dom.html
│   │   │       ├── metadata.json
│   │   │       └── network.json       # Intercepted API requests
│   │   ├── reports/
│   │   └── spec/
│   │
│   └── submittals/
│       ├── screenshots/
│       ├── dom/
│       └── reports/
│
├── .env
└── README.md
```

---

## What the Crawler Captures

For each module page, the crawler records:

### Visual & Structural

* Full-page screenshot
* Raw DOM snapshot
* Page title and heading

### UI Inventory

* Buttons
* Inputs
* Tables
* Menus and dropdowns
* Modals
* Navigation links

### System Actions (Primary Signal)

* Context menu items
* Modal actions
* Clickable controls
* Navigation behaviors

This data is **descriptive only**.
No interpretation occurs at crawl time.

---

## Supabase Schema (System Intelligence Model)

Crawler output is normalized into a Supabase schema prefixed with `app_` to clearly separate:

> **Observed product intelligence**
> from
> **Rebuilt domain data**

Key tables include:

* `app_crawl_sessions` — versioned crawl runs
* `app_pages` — UI entry points
* `app_ui_components` — visual elements
* `app_ui_tables` / `app_ui_table_columns` — inferred data surfaces
* `app_system_actions` — raw behavioral actions
* `app_page_links` — navigation graph
* `app_commands` — canonical domain commands
* `app_system_states` — inferred lifecycle states (future)
* `app_state_transitions` — state changes (future)

Supabase is treated as the **single source of truth** for system intelligence.

---

## Spec Artifacts (Authoritative)

Each module generates a `/spec` folder containing:

### `COMMANDS.md`

* Canonical list of domain commands
* One row per capability
* Stable functional surface

### `FORMS.md`

* UI forms implied by commands
* Field-level requirements
* Intentionally incomplete (design happens here)

### `MUTATIONS.md`

* **Authoritative behavior specs**
* Defines:

  * Inputs
  * Validation rules
  * State mutations
  * Side effects
  * Failure conditions

All implementations must conform to these specs.

### `schema.sql`

* Executable domain schema
* Creation order matters
* No prose, no ambiguity

### `implementation.html`

* Human-readable execution plan
* Phased build strategy
* Designed for review, planning, and AI context loading

---

## Execution Workflow (DO NOT SKIP OR REORDER)

```bash
# 1. Initialize a new module (creates directories + starter config)
node scripts/init-procore-module.js <module-name>

# 2. Edit module-configs/<module-name>.json
#    Set the correct startUrl and add page-specific interactions

# 3. Run the generic crawler
PROCORE_MODULE=<module-name> node scripts/crawl-procore-module.js

# 4. Ingest data into Supabase
PROCORE_MODULE=<module-name> node etl_ingest_procore_crawl.js

# 5. Generate crawl summary
PROCORE_MODULE=<module-name> node scripts/generate-crawl-summary.js

# 6. Generate spec artifacts
PROCORE_MODULE=<module-name> node scripts/generate-procore-module-spec.js

# 7. Review specs
# 8. Define mutation behavior
# 9. Only then: implement
```
Skipping steps increases rework and error risk.

---

## Module Config Format

Each module needs a JSON config in `module-configs/<module>.json`:

```json
{
  "module": "submittals",
  "startUrl": "https://us02.procore.com/.../tools/submittals",
  "pages": [
    {
      "name": "submittals-list",
      "label": "Submittals List",
      "category": "submittals",
      "interactions": [
        {
          "type": "right-click",
          "selector": "tr.submittal-row",
          "description": "Right-click row for context menu",
          "captureMenuItems": true
        },
        {
          "type": "click",
          "selector": "button:has-text('Create')",
          "description": "Open create dialog",
          "waitMs": 2000,
          "captureAfterClick": true
        }
      ]
    }
  ]
}
```

### Interaction Types

| Type | Options | Description |
|------|---------|-------------|
| `right-click` | `captureMenuItems` | Right-click element, capture context menu items |
| `double-click` | `captureModalButtons` | Double-click element, capture modal buttons |
| `click` | `captureAfterClick`, `goBack`, `waitMs` | Click element, optionally capture results |
| `hover` | `captureTooltip`, `waitMs` | Hover element, optionally capture tooltip |

### Network Interception

The generic crawler automatically intercepts all API requests during navigation and interactions. Captured data is saved to `dom/<page>/network.json` and includes:

* Request URL, method, status code
* Request body for mutations (POST/PUT/PATCH/DELETE)
* Response shape (structural description without actual data values)
* Timing information

This enables downstream API contract inference without additional tooling.

---

## Current Execution Phase

**Phase 2: Structure Ingestion and Normalization**

### Active Focus

* Ingest crawler output
* Normalize system actions
* Promote domain commands
* Generate specs

### Active Modules

* **Scheduling** — fully crawled and promoted
* **Submittals** — Phase 0 crawl complete (empty-state, rich API data captured)
* **Commitments** — initialized

### Explicitly Not Doing Yet

* Permissions / RBAC
* Auth modeling
* UI rebuilding
* Performance optimization
* Role-specific behavior

This restraint is intentional.

---

## How AI Agents Should Use This Repository

AI agents should:

* Treat crawler output as **ground truth observation**
* Treat Supabase as **canonical system intelligence**
* Treat spec artifacts as **authoritative intent**
* Avoid inventing:

  * permissions
  * roles
  * UI flows
* Focus on:

  * commands
  * state transitions
  * data integrity
  * capability abstraction

Agents should always ask:

> “What does the system do?”
> before asking
> “How should it look?”

---

## When to Stop and Ask for Human Input

After spec generation (COMMANDS, FORMS, MUTATIONS, schema):

AI agents **must pause** before:

* Writing SQL mutations
* Implementing APIs
* Designing UI
* Adding permissions

Human review is required to:

* Validate domain intent
* Approve mutation behavior
* Confirm data model boundaries

---

## Non-Goals (For Now)

This system is **not** attempting to:

* Clone Procore pixel-for-pixel
* Rebuild all modules simultaneously
* Solve authentication or billing
* Implement permissions prematurely

Those come later, cleanly.

---

## Future Extensions

Planned additions include:

* Multi-role crawl diffing
* State transition modeling
* Parity scoring
* AI Product Interpreter Agent
* Automated rebuild scaffolding

---

## Final Note

This system exists to make **complex SaaS understandable and rebuildable**.

If it feels slow, verbose, or highly structured:
That is by design.

**Clarity precedes speed.**
