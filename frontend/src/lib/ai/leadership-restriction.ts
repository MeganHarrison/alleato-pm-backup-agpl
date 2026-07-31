/**
 * Leadership-restricted content guardrails for the AI tool layer.
 *
 * Meetings categorized "Annual Review" carry document_metadata.access_level =
 * 'leadership' (stamped by a DB trigger — see migration
 * 20260723230000_leadership_restricted_meetings.sql). RLS hides those rows from
 * non-leadership users on every user-scoped query, but the AI tools run on
 * SERVICE-ROLE clients that bypass RLS entirely. Every AI code path that reads
 * document_metadata meeting rows or RAG document_chunks MUST apply these
 * helpers with the requesting user's ToolScope.isLeadership.
 *
 * Default posture is deny: chunk filtering in retrieveChunks runs unless the
 * caller explicitly opts in as leadership.
 */

export const LEADERSHIP_ACCESS_LEVEL = "leadership";

/**
 * Meeting categories that are leadership-restricted. Must stay in sync with
 * the DB trigger stamp_leadership_access_level() in migration
 * 20260723230000_leadership_restricted_meetings.sql.
 */
export const LEADERSHIP_RESTRICTED_CATEGORIES = ["annual review"] as const;

/**
 * True when a document category is leadership-restricted. Use for result rows
 * (e.g. RPC outputs) that carry category but not access_level.
 */
export function isLeadershipRestrictedCategory(category: unknown): boolean {
  return (
    typeof category === "string" &&
    (LEADERSHIP_RESTRICTED_CATEGORIES as readonly string[]).includes(
      category.trim().toLowerCase(),
    )
  );
}

type OrFilterable = { or(filters: string): unknown };

/**
 * Excludes leadership-restricted rows from a document_metadata PostgREST
 * query unless the requesting user is leadership.
 *
 * Uses an OR of `is.null` + `neq` because a bare `.neq()` would also drop
 * rows whose access_level is NULL (SQL three-valued logic).
 */
export function withoutLeadershipRestricted<T extends OrFilterable>(
  query: T,
  isLeadership: boolean,
): T {
  if (isLeadership) return query;
  return query.or(
    `access_level.is.null,access_level.neq.${LEADERSHIP_ACCESS_LEVEL}`,
  ) as T;
}

/** True when a RAG chunk's metadata carries the leadership restriction stamp. */
export function isLeadershipRestrictedChunkMetadata(
  metadata: unknown,
): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    (metadata as Record<string, unknown>).access_level ===
      LEADERSHIP_ACCESS_LEVEL
  );
}

/**
 * Drops leadership-restricted chunks from RAG search results unless the
 * requesting user is leadership. The stamp is written into chunk metadata by
 * the embedding pipeline (backend embedder) and backfilled for existing
 * Annual Review chunks.
 */
export function filterLeadershipRestrictedChunks<
  T extends { doc_metadata?: Record<string, unknown> | null },
>(rows: T[], isLeadership: boolean): T[] {
  if (isLeadership) return rows;
  return rows.filter(
    (row) => !isLeadershipRestrictedChunkMetadata(row.doc_metadata ?? null),
  );
}
