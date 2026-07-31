# CONTEXT — domain glossary & architecture vocabulary

The shared names for concepts in this codebase. Architecture reviews and the
`/improve-codebase-architecture`, `/codebase-design`, and `/domain-modeling` skills use
this file as the source of truth for domain terms. When a deepened module is named after a
concept, its term goes here.

Architecture vocabulary (module, interface, depth, seam, adapter, leverage, locality)
comes from the `/codebase-design` skill — this file only defines the **domain**.

---

## Invoicing / payment applications

**Payment application** — an AIA G702/G703 application for payment: a schedule-of-values
(SOV) rollup that certifies how much is due on a contract for a billing period. The same
9-line certificate schedule applies to both subcontractor invoices and owner/prime
payment applications.

**Invoice financials** — the money calculation behind a payment application: per-line
figures (completed/stored, retainage) plus the 9-line rollup. Owned by one deep module,
`frontend/src/lib/invoicing/payment-application.ts`, and consumed by the subcontractor
invoice route, the SOV editor tabs, the PDF, and (fast-follow) the prime side. Before this
module the math was forked across four call sites that disagreed on Lines 8 and 9.

**The G702 nine lines** (the canonical certificate schedule):
1. Original Contract Sum
2. Net Change by Change Orders
3. Contract Sum to Date (1 ± 2)
4. Total Completed & Stored to Date
5. Retainage (5a % of completed work + 5b % of stored material)
6. Total Earned Less Retainage (4 − 5)
7. Less Previous Certificates for Payment
8. **Current Payment Due** (6 − 7)
9. **Balance to Finish, Including Retainage** (3 − 6)

**Retainage** — a withheld portion of a contract amount (commonly 5–10%) held until work
is satisfactorily complete. Tracked per line for work and stored materials, split into
this-period / previous / released.

**Retainage release** — a first-class Procore subcontractor-invoice type where previously
withheld retainage is paid out. On a release, Current Payment Due (Line 8) is the released
amount rather than the standard `6 − 7`. The module must handle this case; the prime-side
calc historically did not.

**SOV line item (`SovLineItem`)** — one schedule-of-values row on a payment application.
Per-line stored figures (`net_amount_this_period`, `total_completed_stored`) are Postgres
GENERATED columns — the database is the single source of truth for stored per-line values;
the module recomputes them only for edit **preview** and is pinned to the DB expression by
a parity test.

---

## Data access / Supabase project routing

**Service data router** — the one module that answers "for this table, which Supabase
project, which service-role client, and which generated-types generic?" Exposed as
`serviceDb.from(table)` (planned home: `frontend/src/lib/supabase/service-db.ts`). It owns
the table→project decision *by construction*: it selects the client and calls `.from()`
itself, returning the native Supabase query builder already bound to the right project — so
the table you route on is the table you query, and querying the wrong project is
unrepresentable. The same map drives the return type (`<Database>` for PM-APP tables,
`<RagDatabase>` for AI-DB tables), so a client can no longer be typed for the wrong project
(the `createOutlookIntakeServiceClient` mistype). Scope is the **service-role** surface only
(~470 call sites): RAG is reached exclusively via service-role, so RLS cookie/browser paths
are always PM-APP, already correct, and are left untouched. Two adapters sit behind the
seam — the PM-app service client and the RAG service client (today's `createServiceClient` /
`createRagServiceClient`), constructed once and hidden. Before this module the
project choice was leaked across ~1,300 call sites and re-derived from developer memory,
a lint array, and a DB trigger — the recurring "wrong DB" incident class.

**RAG table registry** — the single exported allowlist of tables that physically live in the
**AI Database** (`document_chunks`, `rag_document_metadata`, `rag_pipeline_state`,
`outlook_email_intake*`, and their siblings). It is the one source of truth the Service data
router routes on, replacing the three scattered copies that exist today: the
`KNOWN_EXTERNAL_TABLES` array in `scripts/audits/check-no-phantom-doc-tables.mjs` (used only
to silence a linter), the "rule of thumb" prose in `CLAUDE.md`, and every developer's memory.
A completeness test pins it to `RagDatabase["public"]["Tables"]` so it can't drift when
types regenerate. Note the legacy overlap: `document_chunks` / `rag_pipeline_state` still
exist in the PM-APP project as trigger-protected read-only copies, so membership is an
explicit allowlist, not "is it absent from the PM-APP types."

**RAG-unconfigured = loud throw (never PM-APP fallback)** — when a RAG table is routed but
`RAG_SUPABASE_URL` is missing, the router throws a specific error rather than falling back to
the PM-APP client. Silent fallback is what "makes the inbox look empty even when sync is
healthy" (the reason `createOutlookIntakeServiceClient` was added as a workaround). The
router owns this drift check; the Python side already has the equivalent
(`rag_supabase_configured()`).

---

## Identity resolution

**Identity resolution** — the operation "given the authenticated user, what are their id
shapes?". Owned by `frontend/src/lib/auth/identity.ts`: `resolvePersonId(user)` and
`resolveIdentity(user) → { authUserId, profileId, personId }`. Two distinct ids identify a
user, and stamping the wrong one into a write column — which RLS then silently hides — is a
recurring bug class:
- **`authUserId`** — Supabase `auth.users.id`. Equal to **`user_profiles.id`** by
  construction (routes read the profile via `.eq("id", authUserId)`), so
  `profileId === authUserId`.
- **`personId`** — `people.id`, a SEPARATE id bridged from the auth uid via
  `users_auth.auth_user_id → person_id`. Required by `people`-FK write columns.

The bridge walk (users_auth → `people.auth_user_id` → `people.email` → auto-provision) has
ONE home, `resolvePersonId`. Before it, the walk was a private copy in `auth-guard.ts` plus
~6 inline hand-rolled forward walks (in `api/commitments`, `api/auth/admin-check`,
`api/projects` ×2, and two `directory/people/.../notifications` routes) that skip the
fallback chain and so behave differently for un-backfilled accounts. Those forks should
adopt `resolvePersonId`.

**Write id-shape contract** — which id a "who did this" column wants is a per-`{table,
column}` fact, NOT per-column-name (`submitted_by` / `reviewed_by` / `assigned_by` each
mean BOTH shapes across different tables). Only 15 such columns carry a real FK; the rest
are unconstrained free text holding the auth uid. The 6 FK→`people.id` columns
(`subcontractor_sov_submissions.submitted_by`/`reviewed_by`, `project_role_members.
assigned_by`, `project_vendors.added_by`, `project_report_suggestions.reviewed_by`,
`user_schedule_notifications.resource_tasks_assigned_to_id`) are the danger set — one
careless `added_by: user.id` is a silent RLS-hidden row. Full map:
`docs/patterns/identity-id-shape-contract.md`. As of 2026-07-10 there are ZERO live
mismatches, but the safety is incidental (nulls / user-supplied ids), not enforced.

## Project intelligence / content retrieval

**Daily Source Corpus** — the complete, date-bounded set of eligible meeting transcripts,
emails, Teams messages, and documents used by one Daily Brief. Completeness means every
eligible source row was enumerated from one stable database snapshot and every character
of every materialized source was presented to the synthesis process. A source count,
character count, and zero-truncation receipt are part of the corpus; a capped query or a
sample is not a Daily Source Corpus.

**Executive Intelligence Run** — the indivisible morning workflow that turns one Daily
Source Corpus into the Daily Brief and its required project-intelligence projections. A
run is **staged** while synthesis and projections execute and **completed** only after
corpus completeness, full-content reading, candidate, project state, task, and progress-
report read-backs pass. Only a completed run may replace the current Daily Brief. A failed
run leaves the previous completed brief current.

### Project Intelligence artifact authority

**Project Intelligence** is the governed daily operating system produced by an Executive
Intelligence Run. The durable **Extended Executive Report** is the source-of-truth
analysis artifact. The `/daily-brief` page is a concise presentation projection of that
report; it must never replace or truncate the persisted report. A **Product Intelligence
Packet** is the cumulative, project-scoped projection of completed runs, retaining
lineage to the report and its original source records. Tasks, project synopses, weekly
reports, and proactive recommendations are downstream projections, not independent
sources of truth.

The run state contract is:

- `queued` — accepted for execution but not started;
- `running` — source collection, synthesis, or projections are in progress;
- `blocked_retryable` — an external or transient dependency failed and the run has a
  recorded `nextAttemptAt`;
- `needs_review` — execution produced a review-required condition and must not resume
  automatically;
- `completed` — corpus, synthesis, projection writes, and independent read-backs all
  passed;
- `failed_permanent` — the run cannot complete without a changed contract or human
  intervention.

Only `completed` may publish a current report or advance cumulative Product Intelligence.
Every claim-bearing artifact must retain a source reference (`sourceId`, source lane,
canonical URL when available, and the run/report lineage). Facts, inferences, and
recommendations remain distinguishable in every projection.

## AI chat

**Chat-turn research contract** — the complete research obligation for one Chat turn: which source families the user requested, which evidence may support which conclusions, and which source outcomes must be present before the answer may claim complete coverage. Source selection, availability, execution, trace, citation, and quality checks are projections of this one contract; no later step may independently add, remove, or reinterpret a requested source.

**Research receipt** — the per-source proof produced for a Chat-turn research contract. It distinguishes a successful read with evidence, a successful read with no matches, access denied, source unavailable, timeout, and retrieval failure. A missing receipt is itself a failure. Communication receipts may support operating/process findings but cannot establish an FMDS engineering conclusion.

**Chat turn** — one user request and its single recorded outcome. The outcome is
immutable for the turn and includes the user message, answer or failure state,
source evidence, tool execution trace, quality verdict, provider path, and
timestamps. The chat-turn module is the sole persistence seam: streamed,
deterministic, specialist, and failed paths all project into this one record.
The first deepening slice uses the existing `chat_history` storage shape; a
schema change is deferred until a field cannot be represented without loss.

**Specialist work** — delegated AI work performed outside the primary chat-turn
implementation, such as Microsoft mailbox work, research, or app help. A
specialist result is evidence inside a chat turn; it must preserve whether the
result is live, indexed, degraded, unavailable, or failed rather than being
flattened into response text.

**Project content source** — the operation "get me the `document_metadata` content for
project X in window Y at granularity G." Owned by `frontend/src/lib/intelligence/content-
source.ts`, `getProjectContent(...)`, which absorbs the PM-APP client, the
`document_metadata` table, the date/created_at/captured_at window predicate, and
project_id → name resolution (with its int8-as-string coercion) behind one interface.
This is why the 2026-06/07 "RAG → full transcripts" change broke the assistant, the
daily-brief pages, and `/intelligence`: the switch had to be made in every copy. The seam
now owns the **`document_metadata` retrieval-and-window** decision; `brandon-daily-update`
routes through it and `canonical-operating-packet` reuses its exported `resolveProjectNames`.

**Scope of the content-source seam (ADR-0001).** A 2026-07-10 analysis corrected the
original "six shallow copies of one operation" framing: most of the apparent copies are
**legitimately different operations** that read different tables and MUST NOT be folded in,
or the module becomes a bloated multi-source god-module. Specifically OUT of scope:
`source_signal_candidates` readers (`canonical-operating-packet`, `daily-deep-read-
promotion` — RAG DB, `source_occurred_at`, and a *write* workflow), `rag_document_metadata`
readers (`daily-executive-brief.mjs` — RAG DB, `last_*` ingestion ladder), the per-source
RAG *answer builder* (`source-specific-rag` — live Graph merges, scope gating, ranking), and
financial/RFI readers (`financial.ts`, `project-data-tools.ts` — not content). The only true
`document_metadata` forks are in `ai/tools/project-tools.ts`; migrating them is a
**deliberate, verified behavior change** (the module's meeting lane is `type=meeting`-only and
always windows), NOT a mechanical swap — see ADR-0001 before re-attempting it.

**Content granularity** — the axis the content source is parameterised on, replacing the
implicit storage choice each caller hardcodes today:
- `chunks` — embedding-searched excerpts (the current `retrieveChunks` path).
- `full` — the COMPLETE transcript: concatenated `document_chunks` in `chunk_index` order,
  or the Storage `transcripts/*.md` markdown. The "full transcripts instead of RAG" path.
- `summary` — the lossy `document_metadata.summary`/`overview` auto-summary.

**Content window** — the normalized date range for a retrieval. The single source of truth
for the `date`/`created_at`/`captured_at`/`source_occurred_at`/`coalesce(...)` predicates
currently forked per caller. Owned by the content source, so project-name resolution
(and its int8-as-string coercion) happens exactly once.

**Operating record** — the full per-project intelligence row in `project_current_state`
(`current_summary`, `health_status`, `active_risks`, `open_decisions`, `needs_attention`,
`financial_read`, `schedule_read`, `field_read`, `source_confidence`, …), plus its sibling
snapshot/timeline projections. Written by ONE deep module,
`backend/.../intelligence/compiler.py::apply_source_operating_record_projection`. The
`/[projectId]/intelligence` page reads the whole record. The Daily Deep Read packet must
feed this writer through a **packet → operating-record adapter**, not a shallow `.mjs` that
updates only `current_summary` and leaves the rest of the record stale.

## CRM

**CRM-native lead** — a pre-customer relationship created directly in the CRM. It has
an organization name, optional primary-contact details, an internal owner, activity,
deals, and follow-up tasks. It does not require or create an Acumatica-backed
`companies` row.

**CRM account** — a relationship overlay for an existing `companies` record. Company
records remain owned by the ERP/directory boundary; CRM account profiles add
relationship lifecycle, health, ownership, and follow-up state without changing that
ownership.

**Relationship target** — exactly one CRM-native lead or CRM account associated with a
deal or activity. CRM follow-up tasks may target either kind of relationship and use
the existing shared `tasks` system.

**Lead conversion** — the explicit act of linking a CRM-native lead to an approved
`companies` record after the prospect becomes a real customer or otherwise belongs in
the company directory. Creating a lead is never an implicit conversion.
