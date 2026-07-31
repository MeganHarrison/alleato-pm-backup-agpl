# Deepening the project-intelligence pipeline (historical design notes)

> **Status update — 2026-07-21:** This document preserves the 2026-07-09
> migration analysis and proposed interfaces. It is not the production operating
> reference. Read [`PROJECT-INTELLIGENCE.md`](./PROJECT-INTELLIGENCE.md) for
> deployed artifact authority, complete-source requirements, scheduling,
> recovery, projections, and verification.

**Status:** design · 2026-07-09
**Vocabulary:** `module / interface / deep / shallow / seam / adapter / leverage / locality` (from `/codebase-design`); domain terms in `CONTEXT.md`.
**Why:** the 2026-06/07 "RAG → full transcripts" switch broke the AI assistant, the daily-brief pages, and `/[projectId]/intelligence`. Root cause is not bad code — it is a **missing deep module**. "Get me the content for project X in window Y" lives in six shallow copies, so a source swap fans out into six edits and the copies nobody remembers freeze.

This doc locks the interfaces for the two Strong candidates (A, B) so migration is mechanical.

---

## Candidate A — the Content Source module

One deep module owns the four decisions every copy makes today: **which DB · which table · which window predicate · project-name resolution.**

### The interface

```ts
// frontend/src/lib/intelligence/content-source.ts

/** COMPLETE transcript, embedding excerpts, or lossy auto-summary. */
export type ContentGranularity = "chunks" | "full" | "summary";

/** Normalized retrieval window. Owns the date-column tangle once. */
export interface ContentWindow {
  /** inclusive lower bound, ISO. */ since: string;
  /** inclusive upper bound, ISO. Defaults to now. */ until?: string;
}

export interface ContentQuery {
  projectId?: number | null;   // int8 — coerced ONCE, here
  window: ContentWindow;
  granularity: ContentGranularity;
  sourceTypes?: SourceType[];   // meeting | email | teams | document
  /** only for granularity:"chunks" — the semantic query. */ query?: string;
  limit?: number;
}

/** One unit of project content, granularity-agnostic to the caller. */
export interface ProjectContentItem {
  documentId: string;
  projectId: number | null;
  projectName: string | null;   // resolved here, never by the caller
  sourceType: SourceType;
  title: string | null;
  occurredAt: string | null;
  /** the text at the requested granularity. */ text: string;
  url: string | null;
}

/**
 * The one operation. Absorbs: PM-APP vs AI-DB client choice, the
 * document_metadata / rag_document_metadata / document_chunks / Storage
 * decision, the window predicate, and project_id → name resolution.
 * Throws loudly (Sentry) on failure — never silently returns [].
 */
export function getProjectContent(q: ContentQuery): Promise<ProjectContentItem[]>;
```

### What it hides (the depth)

| Decision leaked today | Where it lives now | After |
|---|---|---|
| PM-APP vs AI-DB client | ~40 call sites pick `createServiceClient` / `createRagServiceClient`; scripts open raw `pg` | internal |
| table: `document_metadata` vs `rag_document_metadata` vs `document_chunks` vs Storage `.md` | per-caller | selected by `granularity` |
| window predicate: `date/created_at/captured_at .gte` ladder vs `coalesce(...)` vs `source_occurred_at` | 5 copies | one `ContentWindow` → one predicate |
| `project_id → name` + **int8-as-string coercion** | `resolveProjectNames`, `fetchProjectNames` (fixed twice, will break a 3rd time) | one coercion, one lookup |

### Seam discipline — the two-DB choice

The two-DB split is a **real seam** (two adapters exist: PM-APP reads for `document_metadata`/`projects`, AI-DB reads for `document_chunks`/Storage), so it is justified — but it must sit *inside* `content-source`, not at every caller. `granularity` picks the adapter:
- `full`/`summary` → PM-APP `document_metadata` (or AI-DB Storage for meetings) 
- `chunks` → AI-DB `document_chunks` (delegates to the existing deep `retrieveChunks` when `query` is set)

`retrieveChunks` stays as-is and becomes an **internal** collaborator of `content-source` for the `chunks` path — it is already deep; we are not rebuilding it, we are giving it a home for the window/project/name concerns it never owned.

### The six copies this replaces

- `lib/executive/brandon-daily-update.ts:1440,1549,1575,1602,1656,2669`
- `scripts/intelligence/daily-executive-brief.mjs:293,353`
- `lib/executive/canonical-operating-packet.ts:48,88`
- `lib/ai/tools/operational.ts:2321,2389`
- `lib/executive/daily-deep-read-promotion.ts:253,269`

### Deletion test
Delete any one copy → its window+resolve logic reappears in the next transcript feature. It earns its keep — so it exists **once**.

---

## Candidate B — the packet → operating-record adapter

Fixes the visible breakage: `/[projectId]/intelligence` renders a **fresh `current_summary` on top of stale `health_status` / `active_risks` / `financial_read`**, because the new transcript path routes around the deep writer.

### The problem, precisely
- `backend/.../intelligence/compiler.py::apply_source_operating_record_projection` (:2243) is **deep** — one call writes the whole operating record + snapshot + timeline + change-candidates, each field guarded by `_safe_summary` / `_publishable_signals`. **Keep it.**
- The RAG-era driver `project_synthesizer.run_synthesis_sweep` fed it — but it is suspended (crashed on `.gte('target_id', 0)` against a UUID column) and is the wrong driver for a transcript world.
- The new `scripts/intelligence/daily-deep-read-consumers.mjs:636–679` is **shallow glue**: it regex-parses the packet's markdown (`**Name:** body`), fuzzy-matches a project, and UPDATEs **only** `current_summary`. Every other field is orphaned.

### The interface

```ts
/** Structured, per-project record the packet must EMIT (stop re-parsing markdown). */
export interface PacketOperatingRecord {
  projectId: number;
  currentSummary: string;
  healthStatus: "on_track" | "at_risk" | "critical" | "unknown";
  whatChangedSinceLastUpdate: string | null;
  needsAttention: string[];
  openDecisions: string[];
  activeRisks: string[];
  financialRead: string | null;
  scheduleRead: string | null;
  fieldRead: string | null;
  sourceConfidence: number | null;
  packetId: string;   // uuid — the durable key, NOT a business date
}

/** Adapter: canonical packet → the deep projection writer's input. One place. */
export function packetToOperatingRecords(
  packet: CanonicalDailyBriefPacket,
): PacketOperatingRecord[];
```

The daily deep-read compiler emits `PacketOperatingRecord[]` as structured JSON in the packet (not prose in a markdown section). The adapter hands each record to `apply_source_operating_record_projection`. No consumer re-parses markdown; no consumer writes a single column and leaves the rest stale.

### Deletion test
Delete the `.mjs` writer → no complexity reappears (pure pass-through). Delete the projection writer → snapshot + timeline + guarded record vanish across callers. The shallow one goes; the deep one gets fed.

---

## Candidates C / D / E (follow-ons, unlock after A/B)

- **C — one packet contract both sides:** the alias resolver exists in 3 places (`daily-deep-read-consumers.mjs:142`, `source-links.ts:57`, unmerged `daily-brief-findings.mjs`). Once B makes the packet emit structured records, the markdown stops being load-bearing and two resolvers delete.
- **D — deepen `retrieveChunks`:** its main caller `operational.semanticSearch:1538` bypasses it (needs `ranking_mode` / `search_all_knowledge`), so the embedding guardrail protects the cold path. Absorb those args; route the caller through. Independent of A/B; small.
- **E — guard at the seam:** `_safe_summary` (producer) and `looksLikeRawSource`/`isCleanCard` (page) duplicate the same scrub across an untrusted seam. Fold into the C adapter. Depends on C.

---

## Migration sequence (parity-gated, nothing else breaks)

Each slice is verified end-to-end as the real user before the next (BATCHING-GATE). No consumer moves until the module proves parity against it.

1. **Build A, wire zero consumers.** Ship `content-source.ts` + a **parity test**: `getProjectContent({granularity:"full"})` returns the same document set as `loadRecentMeetingTranscriptItems` for a live window. Additive, non-breaking.
2. **Migrate one read at a time, prove parity each.** Order by blast radius, lowest first: `operational.searchMeetings` → `canonical-operating-packet` → `brandon-daily-update` → the two `.mjs` scripts (these keep their `pg` transport but call a shared window/resolve helper). Delete each copy as its caller flips.
3. **B: packet emits `PacketOperatingRecord[]`.** Add the structured block to the deep-read compiler; add `packetToOperatingRecords`; point it at `apply_source_operating_record_projection`. Verify `/intelligence` shows health/risks/financials refreshing **together** with the summary. Retire the `current_summary`-only `.mjs` write.
4. **Retire or repurpose the Python synthesis sweep** once B drives the record. Remove the suspended cron or repoint it.
5. **C/D/E** as mechanical cleanups.

**Guardrails added (Core Principles):**
- parity test per migrated copy (would have caught the int8-as-string "all Unassigned" regression pre-deploy);
- the int8 coercion lives once, in `ContentWindow` resolution, and is unit-tested (prevents recurrence);
- `getProjectContent` throws loudly on empty/failure (no silent `[]` — the failure mode that let `/intelligence` go stale unnoticed);
- staleness monitor already exists (`project_intelligence_staleness_check.py`) — B makes it meaningful again.
