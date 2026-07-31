# FM Global and ASRS Domain

Status: Current implementation and migration reference

## Purpose

This document describes the FM Global / ASRS sprinkler-design domain: what each
table represents, what the PM APP implementation currently does, and the
strategy that led to the current shape. It separates verified current behavior
from historical direction and from work that is still missing.

The domain is now copied to the dedicated ASRS Supabase project. That copy is a
data-domain migration only: the application remains connected to PM APP until a
deliberate cutover migrates the required RPCs and changes application settings.

## Current User-Facing Functionality

### Public intake and preliminary matching

`/fm-global/form` is a public ASRS sprinkler-details form. A submission:

1. Validates storage, rack, ASRS, commodity, and system inputs.
2. Calls `find_sprinkler_requirements` to find FM table/configuration matches.
3. Resolves linked FM tables, sprinkler configurations, and related figures.
4. Calls `generate_optimization_recommendations` for rule-based suggestions.
5. Stores the input, matches, contact/project details, and recommendations in
   `fm_form_submissions`.

It is an estimator/intake workflow, not a sealed engineering-design or code
compliance decision. The selected configuration can be stored against the
submission, and the public confirmation page renders the submitted information.

### Internal reference and review surfaces

- `/fm-global` browses and filters FM Global tables and figures.
- `/fm-global/fm_global_tables` exposes the table directory with search,
  filtering, sorting, and export.
- `/fm-global/submissions` lists public submissions, supports search and delete,
  and links to a submission detail page.
- `/fm-global/submissions/[submissionId]` shows the contact, project, input,
  lead status, and matched table IDs for a submission.

### Important implementation limits

- The public form's K-factor overload is deliberately best-effort: its source
  RPC references columns that no longer exist on `fm_global_tables`. The form
  logs the failure and continues with height-based matches.
- `get_asrs_figure_options` references a missing `asrs_figures` table. It is not
  a working ASRS option source.
- There is no current ASRS decision-engine route, ASRS RAG chat UI, or dedicated
  backend service in this checkout. The ASRS rule/logic tables are data assets,
  not an end-to-end product capability.
- The dashboard's “Tables Directory” link points to `/fm_global_tables`, while
  the actual page is `/fm-global/fm_global_tables`; this link should be repaired
  before treating the internal browse flow as fully polished.

## Data Model

| Table | Role | Current use / status |
| --- | --- | --- |
| `fm_global_tables` | Canonical extracted FM sprinkler-protection tables: classification, system/protection scheme, height, commodity, rack, and figure references. | Active source for the public matcher and both browse surfaces. |
| `fm_global_figures` | Extracted FM diagrams, decision trees, layouts, captions, structured claims, and embeddings. | Active for matching-result context and internal browsing. |
| `fm_sprinkler_configs` | Height- and table-specific sprinkler configuration details: count, K-factor, pressure, spacing, orientation, and conditions. | Used by the height-based matcher; currently has no rows, so it cannot produce configuration-level results until populated. |
| `fm_form_submissions` | Durable record of public intake: inputs, parsed requirements, matches, selected configuration, contact/project information, lead state, cost analysis, and recommendations. | Active public intake and internal review source. |
| `fm_optimization_rules` | Structured optimization-rule catalogue. | Stored domain asset; the current recommendation RPC uses hard-coded rules rather than reading this table. |
| `fm_optimization_suggestions` | Per-submission persisted optimization suggestions. | Schema is ready and linked to submissions; current form stores recommendations in `fm_form_submissions.recommendations` instead. |
| `fm_cost_factors` | Cost assumptions, unit costs, complexity multipliers, and regional adjustments. | Data asset for future cost-aware recommendations; no direct current code reference. |
| `fm_documents` | Source FM document text, metadata, status, related table IDs, and document embedding. | RAG-oriented source asset; one document is present, but no current FM RAG UI consumes it. |
| `fm_sections` | Hierarchical FM document sections with page ranges, slugs, paths, and visibility. | Structural source asset for content browsing/retrieval; no direct current UI query. |
| `fm_blocks` | Ordered FM document blocks: paragraph, note, table, figure, equation, or heading; includes full-text search vector. | Structural/retrieval asset; no direct current UI query. |
| `fm_text_chunks` | Searchable FM clauses/chunks with citations, topics, requirements, costs, and vector embedding. | RAG-oriented source asset; no current FM RAG UI consumes it. |
| `fm_table_vectors` | Embeddings and normalized content for FM table semantic search. | RAG-oriented source asset; used by database search functions, not by a visible current UI. |
| `asrs_sections` | Hierarchical ASRS reference sections. | Imported reference corpus; no direct application route currently consumes it. |
| `asrs_blocks` | Ordered ASRS source blocks with text, HTML, block type, and metadata. | Imported reference corpus; parent for `block_embeddings`. |
| `block_embeddings` | Vector embedding for each ASRS block. | Retrieval-ready support table; currently empty and has no direct UI consumer. |
| `asrs_configurations` | Named ASRS configuration patterns, height limit, container types, applications, and cost multiplier. | Seed/reference asset; no direct current code reference. |
| `asrs_decision_matrix` | Parameterized decision rows mapping ASRS/container/depth/spacing to figures and sprinkler results. | Intended deterministic-decision input; currently empty and unused. |
| `asrs_logic_cards` | Structured rule cards with preconditions, inputs, decisions, citations, and linked tables/figures. | Intended explainable decision-engine input; currently empty and unused. |
| `asrs_protection_rules` | ASRS protection-rule rows by configuration, commodity, height, sprinkler scheme, K-factor, density, area, and pressure. | Intended deterministic-decision input; currently empty and unused. |

## Dependencies and Database Behavior

The domain has two meaningful layers.

```text
FM source corpus
  fm_sections -> fm_blocks
  fm_documents / fm_text_chunks / fm_table_vectors
  fm_global_figures <- fm_global_tables <- fm_sprinkler_configs
                                  ^
                    fm_form_submissions -> fm_optimization_suggestions

ASRS source corpus and intended rules
  asrs_sections -> asrs_blocks -> block_embeddings
  asrs_sections -> asrs_logic_cards / asrs_protection_rules
  asrs_configurations + asrs_decision_matrix
```

The following database functions are part of the PM APP behavior and are not
yet part of the dedicated ASRS project:

- `find_sprinkler_requirements` — the height-based implementation joins
  `fm_global_tables` to `fm_sprinkler_configs` and returns exact/interpolated
  matches.
- `generate_optimization_recommendations` — deterministic rules that return
  recommendations based on height, container type, rack depth, system type,
  heating, and commodity class.
- `hybrid_search_fm_global`, `match_fm_documents`, `match_fm_global_vectors`,
  `match_fm_tables`, and `search_fm_global_all` — database retrieval helpers
  over the FM embeddings and text assets.

Moving the tables without these functions is intentional for the first phase:
it proves that the new project owns a complete, integrity-checked data domain.
It does not make the new project a drop-in runtime replacement yet.

## Strategy: Then, Now, Next

### Historical direction

The prior direction was to adapt the existing FM Global form rather than create
a second ASRS product surface: keep a client-facing, low-chrome intake form;
retain real match/submission behavior; and use the FM tables and figures as the
authoritative source layer. Older references to a separate dashboard/repository
are not treated as the implementation source of truth.

The intended long-term system has three complementary capabilities:

1. **Deterministic design logic first.** Use explicit, source-linked rules and
   tables for classification and sprinkler-protection decisions.
2. **Retrieval for context and explainability.** Use chunks, blocks, figures,
   and embeddings to show the relevant FM source material and answer questions;
   do not let unconstrained retrieval replace a rules-based result.
3. **A client-to-operator loop.** Capture an intake, calculate/prepare a
   preliminary result, let internal staff review it, and preserve the record and
   recommendation context for follow-up.

### Current state

The first and third capabilities are partially implemented in PM APP: a public
form persists submissions, an internal submission review exists, and table/
figure browsing is live. The retrieval and explicit ASRS decision-engine layers
remain data-model foundations rather than complete workflows.

The dedicated ASRS Supabase project now owns the complete 19-table domain copy
with matching row counts and validated foreign keys. PM APP remains the runtime
owner until cutover work is completed.

### Recommended next sequence

1. Repair and migrate the authoritative runtime contracts: the K-factor RPC,
   `get_asrs_figure_options`, and the required matching/retrieval functions.
2. Point the public form and internal FM surfaces at the ASRS project only after
   a live submission → match → save → review replay passes.
3. Populate and validate `fm_sprinkler_configs`, then treat height/K-factor
   matching as a first-class, test-covered engineering-assistance workflow.
4. Build the ASRS decision engine against `asrs_decision_matrix`,
   `asrs_logic_cards`, and `asrs_protection_rules`, returning source citations
   and explicit “insufficient evidence” states.
5. Add a retrieval interface only after the deterministic path is reliable;
   surface exact table/figure/clause provenance with every explanation.

## Migration Boundary

The dedicated ASRS project contains the 19 tables in this document plus their
required indexes, constraints, RLS policies, trigger functions, triggers,
sequences, and the `vector` extension. It deliberately excludes:

- PM application tables and environment configuration;
- `design_recommendations` and `design_violations`, whose foreign keys point to
  PM-specific project and Auth identities;
- a Supabase Auth-user migration;
- the application RPCs/views listed above; and
- deletion of source data.

This boundary prevents a table move from becoming an accidental identity or
application cutover. A future cutover should be a separately verified change,
with source/destination parity, function tests, RLS review, and an end-to-end
browser replay.
