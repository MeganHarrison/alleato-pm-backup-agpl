# ADR-0001: The Content Source seam owns `document_metadata` retrieval only

Date: 2026-07-10
Status: Accepted
Owner: Engineering

## Context

`frontend/src/lib/intelligence/content-source.ts` (`getProjectContent(...)`) was built to be
the one owner of "get me the content for project X in window Y at granularity G," after the
2026-06/07 "RAG → full transcripts" switch broke the assistant, the daily-brief pages, and
`/intelligence` because the retrieval logic was forked across many callers.

An architecture review flagged the module as "materially incomplete": only one production
consumer (`brandon-daily-update`) routed through it, while ~5 other "forks" still did their
own content retrieval. The implied remaining work was "migrate the other forks onto
`getProjectContent`."

A 2026-07-10 deep analysis (three parallel agents, one per fork cluster) specced every
candidate call site against the module's actual interface. The finding contradicts the
"six copies of one operation" premise:

- **`canonical-operating-packet.ts`, `daily-deep-read-promotion.ts`** read
  `source_signal_candidates` (RAG DB), windowed by `source_occurred_at`. The promotion path
  is a **write** workflow (candidate → task/insight_card), not a windowed read.
- **`scripts/intelligence/daily-executive-brief.mjs`** reads `rag_document_metadata` (RAG DB)
  windowed by a `coalesce(last_content_loaded_at, last_indexed_at, last_synced_at, updated_at,
  created_at)` ingestion ladder.
- **`source-specific-rag.ts`** is a per-source RAG *answer builder*: live Microsoft Graph
  merges, `ToolScope`/allow-list gating, ranking, HTML sanitization, formatted output. Its
  `document_metadata` reads are a small part of a larger, different responsibility.
- **`financial.ts`, `read/project-data-tools.ts`** window `direct_costs` / `rfis` /
  `submittals` / `prime_contract_change_orders` — financial and workflow tables, not content.

The only genuine `document_metadata` forks are the ~10 sites in `ai/tools/project-tools.ts`.
Even the two closest (Sites 4 and 10) cannot be migrated without (a) extending the module
(e.g. adding `participants` to its select) AND (b) accepting real behavior changes on
production AI tools: the module's meeting lane is `type=meeting`-only (the tools also match
`category=meeting` and `source=fireflies`, so migrating drops Fireflies rows), and the module
always applies a window (the tools return unbounded latest-N and keep null-`date` rows). The
rest are blocked by array-`projectId` scope, missing columns, or predicates the module has no
equivalent for (full-text search, ILIKE, document_type FK, two-key ordering).

## Decision

The Content Source seam owns exactly one operation: **`document_metadata` retrieval within a
`date`/`created_at`/`captured_at` window**, at `chunks | full | summary` granularity, for a
single project or all projects.

- Readers of **other tables** (`source_signal_candidates`, `rag_document_metadata`) and of
  **financial/workflow tables** are legitimately **different operations** and are explicitly
  **out of scope**. They will not be folded into `getProjectContent`.
- `source-specific-rag.ts` stays a distinct answer-builder; it may *call* the seam for its
  metadata lane, but only as a later, verified change (see below).
- Migrating the `project-tools.ts` `document_metadata` sites onto the seam is a **deliberate,
  verified behavior-change project** (it changes which rows the assistant retrieves), not part
  of "finishing the seam." It requires before/after evaluation of assistant output, and is
  tracked separately — it is NOT to be attempted as a mechanical migration.
- **The Python retrievers stay separate — a TS module cannot own a Python read.** The backend
  intelligence retrievers (`backend/src/services/intelligence/project_synthesizer.py`,
  `project_intelligence.py`, `domain_compiler.py`) each have their own recency ladder over
  `document_metadata` / `rag_document_metadata`. `getProjectContent` is a TypeScript module;
  Python cannot import it, so a shared owner would require either a network service both call
  or a Python port kept in contract-test lockstep with the TS window semantics. That is a
  distinct infrastructure decision, out of scope here. Until then, the recency-window
  semantics are duplicated across the language boundary by necessity; if they must converge,
  the lowest-risk step is a shared **contract test** asserting the Python `_coalesce_doc_date`
  ladder and the TS `getRecencyAnchor` agree on a fixture battery — not a code merge.

The concrete deepening delivered under this ADR: the duplicate `resolveProjectNames` in
`canonical-operating-packet.ts` (which lacked the module's int8→number coercion and so carried
the "all projects render Unassigned" regression) was deleted and replaced by the module's
exported resolver (PR #916).

## Alternatives Considered

- **Migrate all forks onto `getProjectContent` (the review's implied plan).** Rejected: most
  "forks" read different tables; folding them in requires adding a `source_signal_candidates`
  lane, a `rag_document_metadata` source, a source_occurred_at column and an ingestion-recency
  ladder, array-`projectId`, a windowless mode, full-text search, etc. — turning a deep module
  into a shallow multi-source god-module with a huge interface. That is the opposite of the
  seam's purpose.
- **Extend the module minimally and migrate the two closest `project-tools.ts` sites now.**
  Deferred, not rejected: it is viable but changes production AI-retrieval behavior (lane
  narrowing, windowing) with no safe automated verification. It belongs in its own
  evaluated change, not in a "finish the seam" pass.

## Consequences

- Positive: the module stays deep (small interface, one clear responsibility). Future reviews
  have a written boundary and will not re-flag the separate operations as "unfinished forks."
  The one real duplication (project-name resolution) is removed.
- Negative: `getProjectContent` adoption stays low (2 consumers). The RAG-DB and financial
  readers keep their own retrieval — accepted, because they are different operations.
- Operational impact: none. No runtime behavior changed by this ADR; PR #916 is a
  behavior-preserving dedup (plus a fix where `project_id` arrives as a string).

## Rollback Plan

This ADR records a scoping decision; there is no deployed artifact to roll back. If a future
need makes a genuine multi-source content seam worthwhile, supersede this ADR with one that
specifies the added lanes/recency columns and the AI-output evaluation gate for the
`project-tools.ts` migration. PR #916's dedup can be reverted independently if the exported
resolver ever needs to diverge per caller (it should not).
