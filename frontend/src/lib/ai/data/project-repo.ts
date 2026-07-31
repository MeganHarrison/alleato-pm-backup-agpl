/**
 * ProjectRepo — a deep module for project-scoped reads.
 *
 * Tool factories used to inline the same Supabase queries in many places, with
 * drift between copies (e.g. the "open RFIs by due date" pattern appeared 3×,
 * with inconsistent closed-status filtering). ProjectRepo concentrates those
 * read patterns behind one small interface so the column lists, ordering, and —
 * critically — the *semantics* ("what counts as an open RFI") live in one place.
 *
 * It accepts a ToolContext (the data seam), so it is testable without touching a
 * real client: pass a fake ctx and assert on the query the repo builds.
 *
 * Scope note: this intentionally centralizes the genuinely-shared/duplicated
 * read patterns, not every one-off query. A query used by a single tool stays in
 * that tool; moving it here would only relocate complexity, not concentrate it.
 */

import type { ToolContext } from "@/lib/ai/tools/tool-context";

// Canonical RFI status semantics. DB statuses verified 2026-06-26 on the PM APP
// project (`rfis.status`): closed | open | answered | draft | closed-draft — all
// lowercase. `closed-draft` is written when an RFI is closed while still in draft
// state; every app surface (respond page, table, header actions) treats it as closed.
// "Open" = anything not in the closed set (open, answered, draft are all actionable).
// This is the single source of truth for the open/closed split; update the set below
// if the status vocabulary ever changes, instead of in each tool.
export const CLOSED_RFI_STATUS = "closed" as const;

/** All status values the app treats as closed — single source of truth for the predicate and DB queries. */
const CLOSED_RFI_STATUS_SET = new Set<string>([CLOSED_RFI_STATUS, "closed-draft"]);

export function isOpenRfiStatus(status: unknown): boolean {
  if (typeof status !== "string") return false;
  return !CLOSED_RFI_STATUS_SET.has(status.trim().toLowerCase());
}

/** Columns the briefing/alert surfaces need for an open-RFI row. */
const OPEN_RFI_COLUMNS =
  "id, number, subject, status, due_date, ball_in_court" as const;

export interface RfiListOptions {
  /** Optional fuzzy status filter (ilike), e.g. "open". */
  status?: string;
  limit?: number;
}

export interface OpenRfiQuery {
  /** One or more project ids to scope to (already access-checked by the caller). */
  projectIds: number[];
  /** When true, restrict to RFIs whose due_date is before `asOf` (overdue). */
  overdueOnly?: boolean;
  /** ISO date (YYYY-MM-DD) used as the overdue cutoff. Required if overdueOnly. */
  asOf?: string;
  limit?: number;
}

export type ProjectRepo = ReturnType<typeof createProjectRepo>;

export function createProjectRepo(ctx: ToolContext) {
  const db = ctx.db;

  return {
    /**
     * Full RFI list for one project, newest first, with an optional fuzzy status
     * filter. Backs `getRFIStatus`. Throws on a DB error (callers shape the
     * message) — never returns an empty array to mask a failure.
     */
    async rfisForProject(projectId: number, opts: RfiListOptions = {}) {
      let query = db
        .from("rfis")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(opts.limit ?? 200);

      if (opts.status) {
        query = query.ilike("status", `%${opts.status}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },

    /**
     * Open (not-closed) RFIs across one or more projects, ordered by due date.
     * This is the pattern that was duplicated with drift across briefing,
     * overdue-alert, and recent-summary tools. `overdueOnly` adds the
     * `due_date < asOf` cutoff used by the overdue-RFI alert.
     */
    async openRfisByDueDate(opts: OpenRfiQuery) {
      let query = db
        .from("rfis")
        .select(OPEN_RFI_COLUMNS)
        .in("project_id", opts.projectIds)
        .neq("status", "closed")
        .neq("status", "closed-draft")
        .order("due_date", { ascending: true })
        .limit(opts.limit ?? 20);

      if (opts.overdueOnly) {
        if (!opts.asOf) {
          throw new Error("openRfisByDueDate: asOf is required when overdueOnly is true");
        }
        query = query.lt("due_date", opts.asOf);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  };
}
