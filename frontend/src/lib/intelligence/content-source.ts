/**
 * Content Source — the ONE module that owns "get me the content for project X
 * in window Y at granularity G."
 *
 * Today that operation is reimplemented in six shallow copies (brandon-daily-
 * update, daily-executive-brief.mjs, source-specific-rag, canonical-operating-
 * packet, operational tools, daily-deep-read-promotion), each independently
 * choosing: which Supabase project, which table, which date-window predicate,
 * and how to resolve project_id → name. That is why the "RAG → full transcripts"
 * switch had to be made six times, and why the copies nobody remembered froze.
 *
 * This module absorbs all four decisions behind one interface. Switching a
 * source (chunks ↔ full transcript ↔ summary) becomes one `granularity` flag.
 *
 * Design: `docs/architecture/content-source-and-operating-record-design.md`.
 * Vocabulary: /codebase-design. Domain terms: CONTEXT.md.
 *
 * Dependencies are INJECTED (see `ContentSourceDeps`) so the module is testable
 * through its interface with fake clients — no live DB required for unit tests.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";
// `import type` → erased at runtime, so this does NOT pull the AI SDK into the
// static graph; it only borrows the OpenAI client's type from getOpenAI.
import type { getOpenAI } from "@/lib/ai/tools/tool-utils";
import { createServiceClient } from "@/lib/supabase/service";
import { withoutLeadershipRestricted } from "@/lib/ai/leadership-restriction";

type OpenAIClient = ReturnType<typeof getOpenAI>;
import {
  isWithinWindow,
  type ContentWindow,
  type RecencyRow,
} from "@/lib/intelligence/content-window";

// NOTE: `retrieveChunks` + `getOpenAI` (and thus the whole AI SDK) are
// dynamically imported inside `getChunkContent` only. Keeping them out of the
// module's static import graph means the metadata/window path — the common case
// and the parity target — is testable through the interface without loading the
// AI SDK. The heavy dependency stays local to the branch that needs it.

export type { ContentWindow } from "@/lib/intelligence/content-window";
export { businessDaysAgoWindow } from "@/lib/intelligence/content-window";

/** COMPLETE transcript, embedding excerpts, or lossy auto-summary. */
export type ContentGranularity = "chunks" | "full" | "summary";

/** The corpus lanes, mapped internally to `document_metadata` filters. */
export type SourceType = "meeting" | "email" | "teams" | "document";

export interface ContentQuery {
  /** int8 in Postgres — coerced ONCE, here. */
  projectId?: number | null;
  window: ContentWindow;
  granularity: ContentGranularity;
  /** Defaults to all lanes. */
  sourceTypes?: SourceType[];
  /** Required for granularity:"chunks" — the semantic query text. */
  query?: string;
  /** Per-lane row cap (coarse prefilter). Default 200. */
  limit?: number;
}

/** One unit of project content, granularity-agnostic to the caller. */
export interface ProjectContentItem {
  documentId: string;
  projectId: number | null;
  projectName: string | null;
  sourceType: SourceType;
  title: string | null;
  occurredAt: string | null;
  text: string;
  url: string | null;
  /**
   * The underlying `document_metadata` row, for consumers that do their own
   * presentation mapping (e.g. the executive brief's item builder) and need
   * more columns than the normalized fields above. Undefined for `chunks`.
   * This is the typed escape hatch that lets rich consumers drop their own
   * window/DB/table/id-resolution code and route through this module.
   */
  raw?: ContentRow;
}

/** Injected collaborators. Omit in production; the module creates real ones. */
export interface ContentSourceDeps {
  pmClient?: SupabaseClient<Database>;
  ragClient?: SupabaseClient<RagDatabase>;
  openai?: OpenAIClient;
}

/**
 * The `document_metadata` columns the module reads. Superset of what the rich
 * consumers (executive brief item builder, source-specific RAG) select today,
 * so migrating them onto `raw` needs no second query.
 */
const CONTENT_SELECT =
  "id,title,project,project_id,date,created_at,captured_at,source_system,source,type,category,summary,overview,content,raw_text,url,source_web_url,action_items,summary_bullets,decisions,key_topics,topics_discussed";

export interface ContentRow extends RecencyRow {
  id: string;
  title: string | null;
  project: string | null;
  project_id: number | null;
  source: string | null;
  source_system: string | null;
  summary: string | null;
  overview: string | null;
  content: string | null;
  raw_text: string | null;
  url: string | null;
  source_web_url: string | null;
  action_items: string | null;
  summary_bullets: unknown;
  decisions: unknown;
  key_topics: unknown;
  topics_discussed: unknown;
}

/** How each lane is selected on `document_metadata`. One filter per lane. */
const LANE_FILTER: Record<SourceType, { column: "type" | "category"; value: string }> = {
  meeting: { column: "type", value: "meeting" },
  email: { column: "category", value: "email" },
  teams: { column: "category", value: "teams_message" },
  document: { column: "category", value: "document" },
};

const ALL_LANES: SourceType[] = ["meeting", "email", "teams", "document"];

function textForGranularity(row: ContentRow, granularity: ContentGranularity): string {
  if (granularity === "summary") return row.summary ?? row.overview ?? "";
  // "full": the row's complete stored text. Fireflies meetings carry the full
  // transcript in `content`. (A follow-up may assemble from `document_chunks`
  // when the row text is thin — kept out of slice 1 to preserve parity.)
  return row.content ?? row.raw_text ?? row.summary ?? row.overview ?? "";
}

/**
 * The one definition of "a real project id."
 *
 * `int8` is returned as a JS string by some drivers (the "all projects render
 * Unassigned" regression — a string key never matches a numeric lookup), and
 * `document_metadata.project_id = 0` is the "unassigned" sentinel, not an FK.
 * Both truths live here so no caller re-learns them: coerce to number, and only
 * a positive integer counts as a project.
 */
export function normalizeProjectId(
  raw: number | string | null | undefined,
): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Resolve project_id → display name in ONE query. Only positive-integer ids are
 * looked up (see `normalizeProjectId`). Exported so consumers stop hand-rolling
 * their own copy (which drift on the int8→number coercion — the "all projects
 * render Unassigned" regression).
 */
export async function resolveProjectNames(
  pmClient: SupabaseClient<Database>,
  projectIds: Array<number | string | null | undefined>,
): Promise<Map<number, string>> {
  const unique = Array.from(
    new Set(
      projectIds
        .map((id) => normalizeProjectId(id))
        .filter((id): id is number => id != null),
    ),
  );
  if (unique.length === 0) return new Map();
  const { data, error } = await pmClient
    .from("projects")
    .select("id,name")
    .in("id", unique);
  if (error) {
    throw new Error(`Content Source: project name resolution failed: ${error.message}`);
  }
  const map = new Map<number, string>();
  for (const row of (data ?? []) as Array<{ id: number | string; name: string | null }>) {
    const id = normalizeProjectId(row.id);
    if (id != null && row.name) map.set(id, row.name);
  }
  return map;
}

async function loadLaneRows(
  pmClient: SupabaseClient<Database>,
  lane: SourceType,
  q: ContentQuery,
): Promise<ContentRow[]> {
  const filter = LANE_FILTER[lane];
  const sinceIso = q.window.since;
  // Content Source has no per-user scope (consumers are automated briefs), so
  // leadership-restricted docs (Annual Reviews) are excluded unconditionally.
  let query = withoutLeadershipRestricted(
    pmClient
      .from("document_metadata")
      .select(CONTENT_SELECT)
      .eq(filter.column, filter.value)
      // Coarse prefilter: any recency column in-window. `isWithinWindow` below is
      // the precise Eastern-business-day gate.
      .or(`date.gte.${sinceIso},created_at.gte.${sinceIso},captured_at.gte.${sinceIso}`),
    false,
  )
    .order("date", { ascending: false })
    .limit(q.limit ?? 200);

  if (q.projectId != null) query = query.eq("project_id", q.projectId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Content Source: ${lane} retrieval failed: ${error.message}`);
  }
  return ((data ?? []) as unknown as ContentRow[]).filter((row) =>
    isWithinWindow(row, q.window),
  );
}

async function getMetadataContent(
  q: ContentQuery,
  deps: ContentSourceDeps,
): Promise<ProjectContentItem[]> {
  const pmClient = deps.pmClient ?? createServiceClient();
  const lanes = q.sourceTypes && q.sourceTypes.length > 0 ? q.sourceTypes : ALL_LANES;

  const perLane = await Promise.all(
    lanes.map(async (lane) => {
      const rows = await loadLaneRows(pmClient, lane, q);
      return rows.map((row) => ({ lane, row }));
    }),
  );
  const flat = perLane.flat();

  const nameMap = await resolveProjectNames(
    pmClient,
    flat.map((r) => r.row.project_id),
  );

  return flat.map(({ lane, row }) => {
    const projectId = normalizeProjectId(row.project_id);
    return {
      documentId: row.id,
      projectId,
      projectName: projectId != null ? nameMap.get(projectId) ?? null : null,
      sourceType: lane,
      title: row.title,
      occurredAt: row.date ?? row.captured_at ?? row.created_at ?? null,
      text: textForGranularity(row, q.granularity),
      url: row.url ?? row.source_web_url ?? null,
      raw: row,
    };
  });
}

async function getChunkContent(
  q: ContentQuery,
  deps: ContentSourceDeps,
): Promise<ProjectContentItem[]> {
  if (!q.query || q.query.trim().length === 0) {
    throw new Error('Content Source: granularity "chunks" requires a `query`.');
  }
  const [{ retrieveChunks }, { getOpenAI }] = await Promise.all([
    import("@/lib/ai/retrieval/retrieve-chunks"),
    import("@/lib/ai/tools/tool-utils"),
  ]);
  const openai = deps.openai ?? getOpenAI();
  const rows = await retrieveChunks({
    query: q.query,
    openai,
    ragClient: deps.ragClient,
    projectId: q.projectId ?? null,
    matchCount: q.limit ?? 10,
    errorLabel: "content-source:chunks",
  });

  // Chunks lack project names in a stable column; resolve any we can.
  const pmClient = deps.pmClient ?? createServiceClient();
  const projectIds = rows
    .map((r) => (r.doc_metadata?.project_id as number | string | undefined))
    .filter((v): v is number | string => v != null);
  const nameMap = await resolveProjectNames(pmClient, projectIds);

  return rows.map((row) => {
    const projectId = normalizeProjectId(
      row.doc_metadata?.project_id as number | string | undefined,
    );
    return {
      documentId: row.document_id ?? row.id ?? "",
      projectId,
      projectName: projectId != null ? nameMap.get(projectId) ?? null : null,
      sourceType: "meeting" as SourceType,
      title: row.doc_title ?? null,
      occurredAt: null,
      text: row.chunk_text ?? "",
      url: null,
    };
  });
}

/**
 * The one operation. Absorbs the PM-APP vs AI-DB client choice, the table
 * choice, the window predicate, and project_id → name resolution. Throws loudly
 * on failure — never silently returns [] (the failure mode that let
 * /intelligence go stale unnoticed).
 */
export async function getProjectContent(
  q: ContentQuery,
  deps: ContentSourceDeps = {},
): Promise<ProjectContentItem[]> {
  if (q.granularity === "chunks") return getChunkContent(q, deps);
  return getMetadataContent(q, deps);
}
