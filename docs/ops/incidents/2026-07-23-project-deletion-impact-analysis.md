# What Breaks When You Delete a Project — Impact Analysis

**Incident:** 2026-07-23 — ~28 of the most active projects were hard-deleted directly
against the production database (Supabase dashboard / raw SQL, not through the app; the
app's delete only soft-archives). This document explains, grounded in the live schema,
exactly what that destroyed, what it merely unlinked, and why deleting a *project* is far
more damaging than deleting a project's *contents*.

**The one-sentence lesson:** deleting a project doesn't just remove its budgets and
change orders — it severs the entire knowledge graph (meetings, emails, Teams messages,
documents, AI intelligence, progress reports, assistant memory) from that project, and
most of that damage cannot be undone. If the goal was "reset this project's financials
and start over," the right move was to delete the *children* and keep the project shell.

---

## How a project delete actually behaves

`projects.id` is referenced by **186 foreign keys**. The database handles a delete three
completely different ways depending on how each FK was defined — which is why the damage
was so uneven and so hard to see:

| Behavior | # of tables | What happens on `DELETE FROM projects` |
|---|---:|---|
| **CASCADE** | **124** | The child rows are **destroyed** along with the project. |
| **SET NULL** | **40** | The child rows **survive**, but their `project_id` is wiped — they become orphans that no longer know which project they belong to. |
| **NO ACTION / RESTRICT** | 21 | These *should* block the delete if rows exist. They didn't fire here, which means those tables happened to be empty for these projects. |
| SET DEFAULT | 1 | `project_resources` reset to a default. |

There is no single "delete a project" behavior. It's a patchwork, and the two damaging
modes do very different kinds of harm.

---

## Tier 1 — Destroyed and unrecoverable (the worst damage)

124 tables cascade-delete with the project. The incident-response restore only recovered
**~31 of them** — the financial and field tables that happened to be covered by the
`db_audit_log` audit trigger (budgets, contracts, commitments, direct costs, invoices,
change events, RFIs, submittals, drawings, tasks, directory). Everything else in the
cascade had **no audit record**, so those rows are simply gone with no way to reconstruct
them.

Verified live: even for the 24 projects that were restored, these all now read **0 rows** —
they were destroyed, never audited, and cannot be brought back:

- **AI Progress Reports** — `project_progress_reports`, versions, photos, suggestions
- **Project Intelligence** — `project_current_state`, `project_intelligence_packet_items`,
  `project_synopsis_history`, `project_operating_snapshots`, `intelligence_targets`,
  `project_intelligence_timeline_events`
- **Meetings index** — `meetings`, `meeting_series` (the app-side meeting records; the
  transcripts themselves survived but are unlinked — see Tier 3)
- **Project email links** — `project_emails`
- **Estimates & takeoffs** — `estimates`, `qtos`, `qto_items`
- **Field records** — `notes`, `issues`, `observations`, `punch_items`, `photos`,
  `daily_logs`, `inspections`
- **Schedule** — baselines, revisions, resources, leveling runs, calendars
- **Specifications** — divisions, sections, areas

These are the reports and intelligence your team actually reads. They're the hardest to
notice as missing (nothing errors — the page just shows empty), and they're the ones with
no recovery path.

## Tier 2 — Destroyed but recovered

The ~31 audited financial/field tables listed above were rebuilt from `db_audit_log` and
re-attached to the restored projects. This is the only slice of the cascade that had a
safety net, and only because a generic audit trigger had been added weeks earlier.

## Tier 3 — Survived but orphaned (the silent breakage)

40 tables use `SET NULL`: the rows still exist, but the delete wiped their `project_id`.
The data is intact yet disconnected — and **restoring the project row does not re-link
them.** These are still orphaned right now:

- **`document_metadata`** — the single most important one. This is where **meeting
  transcripts, emails, Teams messages, and SharePoint/OneDrive documents** live
  (~40k rows total). Deleting the projects nulled the `project_id` on **~2,500** of them.
  Because this table was not audited at the time, there is no record of which document
  belonged to which project — the links can only be *re-derived* by re-running the
  attribution pipeline, and for Teams/email/SharePoint content (matched by
  content/participants/folder-path, not title) that re-derivation is low-fidelity.
- **`tasks`** — extracted action items, unlinked from their project.
- **AI assistant memory** — `ai_memories`, `ai_skills`, `agent_learnings`,
  `ai_retrieval_weights`, `ai_agent_runs`. The assistant's accumulated per-project
  knowledge and tuning, orphaned.
- **Executive layer** — `executive_attention_items`, `executive_claim_conflicts`.
- **Acumatica ERP mirror** — `acumatica_ap_bills`, `ar_invoices`, `purchase_orders`,
  `subcontracts`, `project_budgets`, `payments`. The accounting system's financial data
  for these jobs, unlinked from the app project.
- **`outlook_email_intake`**, **`files`**, **`document_attribution_candidates`**.

---

## The downstream systems that broke as a result

Because so much of the platform keys off `project_id`, unlinking the corpus broke the
features built on top of it — even where the underlying rows survived:

- **AI Assistant / RAG retrieval** — project-scoped questions ("what's the status of Union
  Collective?", "summarize the Exol Morrisville meetings") filter `document_metadata` /
  `document_chunks` by `project_id`. With ~2,500 docs unlinked, that content no longer
  surfaces for those projects. The assistant answers as if the history doesn't exist.
- **Project Intelligence** — the compiled current-state / synopsis / packet views were
  cascade-destroyed. Even after restoring the project, they're empty until recompiled —
  and recompilation reads from the same unlinked source docs, so it can't fully rebuild
  until the links are restored first.
- **AI Progress Reports** — destroyed outright, no record.
- **Executive briefs & attention items** — orphaned; the project drops out of the
  executive rollups.
- **Assistant memory & learnings** — the assistant loses its per-project context and
  accumulated tuning.
- **ERP reconciliation** — the Acumatica financial mirror for these jobs no longer maps
  to the app project.

The pattern: **the source data mostly survived, but everything that made it useful — the
links and the compiled intelligence — did not.**

---

## The better approach: reset the contents, keep the shell

The safe way to "start a project over" is to delete its *children*, never the project row
itself. Keeping the `projects` row alive preserves `project_id` everywhere, so the entire
knowledge graph stays intact:

- Meetings, emails, Teams messages, documents (`document_metadata`) stay linked → RAG and
  the assistant keep working.
- AI progress reports, project intelligence, executive briefs keep their anchor and keep
  regenerating.
- Assistant memory, learnings, and the ERP mirror stay attached.

You reset the financials **without severing the history.**

### Safe-reset recipe (what should have happened)

To wipe a project's financial/field contents and start clean, while keeping everything
else linked:

1. Keep the `projects` row.
2. Delete only the specific child data you want to reset — e.g. `change_events` /
   `prime_contracts` / `subcontracts` / `purchase_orders` / `direct_costs` / `budget_lines`
   / `submittals` / `drawings`. Their own line-item children cascade off *those* deletes,
   which is correct and contained.
3. Everything on `SET NULL` (documents, meetings' source, tasks, AI memory, ERP) is never
   touched, because you never deleted the project.

The difference in blast radius: deleting the project row hits all 186 FKs (124 destroyed,
40 orphaned). Deleting the financial children hits only those subtrees — a few hundred
rows, fully intended, with zero collateral to the knowledge graph.

---

## Current state (as of 2026-07-24)

- **24 real projects restored** with their audited financial/field children, marked
  `is_development` and hidden from the portfolio (visible only to the developer account).
- **Tier 1 intelligence/report data for those projects is still gone** — it was never
  audited and has no recovery path short of full recomputation (which itself needs the
  document links back first).
- **~2,500 document links (Tier 3) are still severed** — re-linking requires re-running
  the attribution pipeline, with the fidelity caveats above.

## What's now protected

The strategy is **"let the corpus survive, don't fight the delete"** — because guarding
the documents/meetings would only pressure an operator to delete them first. Instead:

- **The corpus survives a delete with a re-linkable reference.**
  `document_metadata.project_id` is `ON DELETE SET NULL` (documents are unlinked, never
  deleted). A trigger (`trg_document_metadata_project_reference`) now keeps every linked
  document's former project **name** (`project`) and **id** (`previous_project_id`, a plain
  integer with no FK, so it is never itself nulled) populated. After any future project
  deletion, an unlinked document still shows "was: <name>" and can be re-linked exactly.
  All 11,995 currently-linked documents were backfilled.
- **Link changes are audited.** `trg_audit_project_link` records every `project_id` change
  into `db_audit_log`, so a future unlink also leaves a precise record.
- **A deliberate-action speed bump on deletes.** `trg_guard_project_hard_delete` blocks a
  raw `DELETE FROM projects` while **direct costs** are attached — chosen precisely because
  direct costs are disposable (they re-sync from Acumatica), so the "clear it first" escape
  costs nothing valuable. It deliberately does **not** block on documents/meetings/
  intelligence. Override for an intended delete: `SET LOCAL app.allow_project_hard_delete =
  'on'` in the same transaction.
- The app's own delete has always been a soft-archive, not a hard delete.

Net effect: the knowledge graph is now **resilient to a project delete rather than
protected from it** — if someone deletes a project again, the documents/meetings survive,
still know what they belonged to, and can be reconnected.

### Still worth doing

- **Re-link the ~2,500 already-orphaned documents** from the 2026-07-23 incident. They
  predate the reference-preservation trigger, so they carry no `previous_project_id` and
  need the attribution pipeline to re-derive their project (low-fidelity for Teams/email).
- The `previous_project_id` pattern could be extended to the other `SET NULL` tables
  (tasks, AI memory, ERP mirror) if their orphaning proves painful.
