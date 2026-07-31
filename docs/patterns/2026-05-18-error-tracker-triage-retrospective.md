---
title: 2026-05-18 / error-tracker triage retrospective
description: A retrospective of the three-round error-tracker triage. Identifies the seven recurring patterns that account for every fix, and links to the pattern + solution docs created from them.
---

# Retrospective: Error-Tracker Triage (2026-05-18 → 2026-05-19)

The `/errors` admin page had been silently collecting events for weeks without anyone looking. When we did look, there were **973 grouped error patterns spanning 3,638 events**, and 969 of them were still in `new` status.

Three rounds of parallel sub-agent fixes later: the queue is workable, 614+ noise events are filtered, and **seven distinct patterns** account for every bug we fixed.

---

## The Three Rounds

| Round | Commit | Focus | Files |
|---|---|---|---|
| 1 | `aca196aa6` | Six high-severity bug groups | 14 |
| 2 | `0bf0c5878` | Suppress 401/403 from telemetry | 2 |
| 3 | `3e9931613` | Four more bugs + locks/4xx noise filters | 15 |

Total: **31 files changed across the codebase**, 18 error groups closed out (235+ events), 645+ existing noise groups backfilled to `ignored`.

---

## The Seven Patterns

Every fix in this triage falls into exactly one of these classes. **The first three account for 9 of the 14 bug fixes** — killing them would have prevented most of this whole session.

### 1. [Nil-UUID cascade](errors/nil-uuid-cascade.md)

Parent-not-loaded React hooks fire requests with the nil UUID, flooding the API with 404s and 500s.

**Solution:** [assertNonNilUuid helper](solutions/assert-non-nil-uuid.md) at the server + `enabled: !!parent.id` gating on the client.

**Affected:** 3 distinct error groups; commitments PUT, change-events line-items, commitment-pcos routes.

### 2. [Generic error swallow](errors/generic-error-swallow.md)

API routes throw "Unexpected error" or "Failed to load X" instead of the real Supabase/exception message.

**Solution:** [Error message fidelity](solutions/error-message-fidelity.md) — two patches, one in `asGuardrailError` (handles plain-object PostgrestError), one at throw sites (interpolate `error.message`).

**Affected:** Every API route silently — the universal-helper variant returned `"Unexpected error"` for **every** Supabase DB failure across the entire codebase.

### 3. [PostgREST embed and select quirks](errors/postgrest-embed-ambiguity.md)

PostgREST's select parser silently accepts syntax that Postgres rejects at runtime. Two flavors: multi-FK ambiguity (multiple relationships between same tables) and quoted-identifiers-with-spaces.

**Solution:** [PostgREST FK disambiguation](solutions/postgrest-fk-disambiguation.md) — use `!fk_name` hints and snake_case column names.

**Affected:** `people`→`companies` embeds across 5 files; `"job number"` column across 4 files.

### 4. [Telemetry noise classification](errors/telemetry-noise-classification.md)

Expected behaviors (auth failures, library lock contention, 4xx user-validation) were being logged as application errors. The telemetry pipeline had no concept of "noise."

**Solution:** [Telemetry suppress-list](solutions/telemetry-suppress-list.md) at both server (`withApiGuardrails`) and client (`apiFetch`) write points.

**Affected:** 645+ existing groups backfilled to `ignored`. ~264 events of 401/403 alone before round 2.

### 5. [apiFetch null passthrough](errors/apifetch-null-passthrough.md)

`apiFetch<T>` returns `null` at runtime for 204/empty responses despite typing as `T`. Nulls flow into array operations and crash the renderer.

**Solution:** Defensive call-site filtering today; durable wrapper fix open.

**Affected:** Prime contract overview tab crashed when an estimate-import modal pushed null line items into state.

### 6. [Schema rename drift](errors/schema-rename-drift.md)

Column rename leaves stragglers in `.select()` string literals that don't typecheck. Postgres error 42703 is the only signal.

**Solution:** Sweep every literal reference after a rename; future-proof with a column-rename registry + CI gate (proposed).

**Affected:** `"job number"` → `project_number` rename had 4 stragglers, silently broken for 5 days.

### 7. [Status endpoint sequential I/O](errors/status-endpoint-sequential-io.md)

A status or health endpoint runs 10+ sequential DB queries with no caching, exceeding the upstream timeout.

**Solution:** In-process cache with double-checked locking at the source; graceful degradation at the proxy.

**Affected:** `/api/admin/source-sync/status` — 39 events of repeated 504s, broken admin UI.

---

## What Made This Tractable

**Sub-agent parallelism.** Each bug class lived in different files, so 5–6 sub-agents could work independently with no merge conflicts. The main thread orchestrated; agents did the depth-first work.

**Telemetry was already capturing.** The `/errors` page, `app_error_events` table, and the classification + fix-packet generators had all been built months ago. We just hadn't been using them.

**The patterns emerged from the work, not the other way.** I didn't go in with a thesis. I dispatched fixes, watched what the agents reported, and recognized that the second time `instanceof Error` came up across different files, it was a systemic issue, not a one-off.

---

## What Almost Killed This

**Pre-existing uncommitted work in the tree.** The first git stage round picked up files from prior agent sessions. Took a hard `git reset` and explicit per-file `git add` to keep each commit clean. **Lesson:** when multiple agent sessions run against the same repo, always verify staged file lists explicitly before committing.

**A stale phantom-table parser.** The CI gate's regex for parsing `database.types.ts` failed because a different session had added an `email_filter_rules` entry. Solved by running `npm run db:types` to regenerate. **Lesson:** make `db:types` run on session start, not just before DB code changes.

**A pre-commit lint rule that caught a pre-existing raw `fetch()`.** Agent J added the nil-UUID guard but didn't migrate the existing fetch to `apiFetch`. The `require-api-client` rule fired on staged changed lines. Fixed inline. **Lesson:** when an agent modifies a file, brief it explicitly on the project's lint rules for that file.

---

## What To Do Next

In priority order:

1. **Fix `apiFetch` at the wrapper** so empty bodies throw when `T` doesn't permit null. Eliminates pattern #5 across the whole codebase in one PR.
2. **Build the column-rename registry + CI gate**. Eliminates pattern #6 going forward.
3. **Write the ESLint rules** proposed in patterns #2 and #3. Each rule kills its class.
4. **Triage the remaining ~300 `new` groups**. Most are now real bugs (since the noise is gone). Recommend in batches of ~10, prioritizing high-severity + high-event-count.

---

## Index of New Pattern Docs (2026-05-19)

| Error pattern | Solution doc (if any) |
|---|---|
| [`nil-uuid-cascade`](errors/nil-uuid-cascade.md) | [`assert-non-nil-uuid`](solutions/assert-non-nil-uuid.md) |
| [`generic-error-swallow`](errors/generic-error-swallow.md) | [`error-message-fidelity`](solutions/error-message-fidelity.md) |
| [`postgrest-embed-ambiguity`](errors/postgrest-embed-ambiguity.md) | [`postgrest-fk-disambiguation`](solutions/postgrest-fk-disambiguation.md) |
| [`telemetry-noise-classification`](errors/telemetry-noise-classification.md) | [`telemetry-suppress-list`](solutions/telemetry-suppress-list.md) |
| [`apifetch-null-passthrough`](errors/apifetch-null-passthrough.md) | — (durable fix open) |
| [`schema-rename-drift`](errors/schema-rename-drift.md) | — (registry proposed) |
| [`status-endpoint-sequential-io`](errors/status-endpoint-sequential-io.md) | — (inline in error doc) |

All registered in `docs/patterns/index.json`.
